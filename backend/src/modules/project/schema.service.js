const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { getClientForProject } = require('./projectConnection');

const SCHEMA_PATH = path.join(__dirname, 'resources', 'base_schema.sql');
const SYSTEM_TABLES = ['users', 'sessions', 'buckets', 'objects', 'auth_audit_logs'];

exports.bootstrapSchema = async ({ dbHost, dbPort, dbName, dbUsername, dbPassword }) => {
  // Read schema SQL file
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`Schema file not found at path: ${SCHEMA_PATH}`);
  }

  const sqlContent = fs.readFileSync(SCHEMA_PATH, 'utf8');

  // Split into clean SQL statements
  const statements = sqlContent
    .split(';')
    .map(stmt => {
      return stmt
        .split('\n')
        .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
        .join('\n')
        .trim();
    })
    .filter(stmt => stmt.length > 0);

  // Dynamically initialize client connecting as the newly created user
  const dbUrl = `mysql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
  const projectPrisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  });

  try {
    console.log(`[SchemaService] Connecting dynamically to project database: ${dbName}`);
    await projectPrisma.$connect();

    console.log(`[SchemaService] Executing ${statements.length} DDL statements...`);
    for (const stmt of statements) {
      // Execute each statement raw
      await projectPrisma.$executeRawUnsafe(stmt);
    }
    
    console.log(`[SchemaService] Schema successfully bootstrapped for ${dbName}`);
  } catch (error) {
    console.error(`[SchemaService] Failed to bootstrap schema on ${dbName}:`, error);
    throw error;
  } finally {
    await projectPrisma.$disconnect();
  }
};

/**
 * Validates a table or column name to prevent SQL injection.
 * Only allows alphanumeric characters and underscores.
 */
const validateIdentifier = (name) => {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid database identifier: "${name}". Only alphanumeric characters and underscores are allowed.`);
  }
};

/**
 * Validates the column data types to prevent raw SQL type injection.
 */
function validateType(type) {
  if (typeof type !== 'string') return false;
  const normalized = type.trim().toUpperCase();

  // Parameterized type validations: e.g. VARCHAR(255)
  if (/^VARCHAR\(\d+\)$/.test(normalized)) return true;
  // Parameterized DECIMAL: e.g. DECIMAL(10,2) or DECIMAL(10)
  if (/^DECIMAL\(\d+(,\d+)?\)$/.test(normalized)) return true;

  const allowedTypes = [
    'VARCHAR', 'TEXT', 'INT', 'INTEGER', 'BIGINT', 'BOOLEAN', 
    'DATE', 'DATETIME', 'DECIMAL', 'FLOAT', 'DOUBLE', 
    'JSON', 'LONGTEXT', 'STRING', 'UUID', 'TIMESTAMP', 'CHAR', 'NUMBER'
  ];
  return allowedTypes.includes(normalized);
}

/**
 * Creates a dynamic database table in a project's isolated database schema.
 */
exports.createTable = async (project, tableName, columns) => {
  validateIdentifier(tableName);

  if (SYSTEM_TABLES.includes(tableName.toLowerCase())) {
    throw new Error(`Table name "${tableName}" is a restricted system table.`);
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('Table creation requires at least one column.');
  }

  const reservedNames = ['id', 'created_at', 'updated_at'];
  const normalizedCols = [];

  for (const col of columns) {
    if (!col.name || !col.type) {
      throw new Error('Column name and type are required.');
    }

    validateIdentifier(col.name);
    
    if (reservedNames.includes(col.name.toLowerCase())) {
      throw new Error(`Column name "${col.name}" is a reserved system field.`);
    }

    if (!validateType(col.type)) {
      throw new Error(`Unsupported database type: "${col.type}".`);
    }

    normalizedCols.push({
      name: col.name,
      type: mapTypeToMySQL(col.type),
      required: col.required === true || col.nullable === false
    });
  }

  // Construct table CREATE statement
  const colDefs = normalizedCols.map(col => {
    const nullability = col.required ? 'NOT NULL' : 'DEFAULT NULL';
    return `\`${col.name}\` ${col.type} ${nullability}`;
  });
  
  const sql = `
    CREATE TABLE \`${tableName}\` (
      \`id\` CHAR(36) PRIMARY KEY,
      ${colDefs.join(',\n')}${colDefs.length > 0 ? ',' : ''}
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const client = getClientForProject(project);
  await client.$executeRawUnsafe(sql);
};

/**
 * Lists all user-created tables in the project's isolated database schema,
 * ignoring internal system tables.
 */
exports.listTables = async (project) => {
  const client = getClientForProject(project);
  console.log(`[listTables DEBUG] Current project.dbName: ${project.dbName}`);
  console.log(`[listTables DEBUG] Dynamic connection info: host=${project.dbHost}, port=${project.dbPort}, user=${project.dbUsername}`);
  
  const selectDb = await client.$queryRawUnsafe('SELECT DATABASE() as db');
  console.log(`[listTables DEBUG] SELECT DATABASE() returned:`, selectDb);

  const sql = `SELECT TABLE_NAME as tableName 
     FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME NOT IN (${SYSTEM_TABLES.map(() => '?').join(',')})`;
  console.log(`[listTables DEBUG] Executing SQL: ${sql} with params:`, [project.dbName, ...SYSTEM_TABLES]);

  // Select non-system tables belonging to the tenant database
  const rows = await client.$queryRawUnsafe(
    sql,
    project.dbName,
    ...SYSTEM_TABLES
  );

  console.log(`[listTables DEBUG] Number of tables returned from query: ${rows.length}, tables:`, rows.map(r => r.tableName));
  return rows.map(r => r.tableName);
};

/**
 * Returns column details (names and types) of a table.
 */
exports.describeTable = async (project, tableName) => {
  validateIdentifier(tableName);
  const client = getClientForProject(project);

  const rows = await client.$queryRawUnsafe(
    `SELECT COLUMN_NAME as name, COLUMN_TYPE as type 
     FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
     ORDER BY ORDINAL_POSITION`,
    project.dbName,
    tableName
  );

  if (!rows || rows.length === 0) {
    throw new Error(`Table "${tableName}" does not exist.`);
  }

  return rows.map(r => ({
    name: r.name,
    type: r.type.toLowerCase()
  }));
};

/**
 * Drops a dynamic table from the project's isolated database schema.
 */
exports.dropTable = async (project, tableName) => {
  validateIdentifier(tableName);
  const client = getClientForProject(project);

  const sql = `DROP TABLE \`${tableName}\`;`;
  await client.$executeRawUnsafe(sql);
};

/**
 * Checks if a table exists and is not a restricted system table.
 */
const checkTableExistsAndUserCreated = async (client, dbName, tableName) => {
  validateIdentifier(tableName);
  if (SYSTEM_TABLES.includes(tableName.toLowerCase())) {
    throw new Error(`Access to system table "${tableName}" is restricted.`);
  }
  const rows = await client.$queryRawUnsafe(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    dbName,
    tableName
  );
  if (!rows || rows.length === 0) {
    throw new Error(`Table "${tableName}" does not exist in project database.`);
  }
};

/**
 * Maps standard API data types to MySQL data types.
 */
function mapTypeToMySQL(type) {
  if (typeof type !== 'string') {
    throw new Error('Type must be a string.');
  }
  const normalized = type.trim().toLowerCase();
  switch (normalized) {
    case 'string':
    case 'varchar':
      return 'VARCHAR(255)';
    case 'text':
      return 'TEXT';
    case 'integer':
    case 'int':
    case 'number':
      return 'INT';
    case 'bigint':
      return 'BIGINT';
    case 'float':
      return 'FLOAT';
    case 'double':
      return 'DOUBLE';
    case 'decimal':
      return 'DECIMAL(10,2)';
    case 'boolean':
      return 'TINYINT(1)';
    case 'date':
      return 'DATE';
    case 'datetime':
      return 'DATETIME';
    case 'timestamp':
      return 'TIMESTAMP';
    case 'uuid':
    case 'char':
      return 'CHAR(36)';
    case 'json':
      return 'JSON';
    default:
      if (validateType(type)) {
        return type.trim().toUpperCase();
      }
      throw new Error(`Unsupported data type: "${type}".`);
  }
}

/**
 * Builds MySQL column definition from name, type, and options.
 */
function buildColumnDefinition(name, type, options = {}) {
  let mappedType = mapTypeToMySQL(type);
  
  // Handle unsigned attribute for numeric columns
  const numericTypes = ['int', 'bigint', 'float', 'double', 'decimal', 'tinyint'];
  const mappedLower = mappedType.toLowerCase();
  const isNumeric = numericTypes.some(nt => mappedLower.includes(nt));
  
  if (options.unsigned === true && isNumeric) {
    const parts = mappedType.split(' ');
    parts.splice(1, 0, 'UNSIGNED');
    mappedType = parts.join(' ');
  }

  let definition = `\`${name}\` ${mappedType}`;

  if (options.nullable === false) {
    definition += ' NOT NULL';
  } else {
    definition += ' NULL';
  }

  if (options.defaultValue !== undefined && options.defaultValue !== null) {
    if (typeof options.defaultValue === 'string') {
      const upperVal = options.defaultValue.trim().toUpperCase();
      if (upperVal === 'CURRENT_TIMESTAMP' || upperVal === 'NOW()') {
        definition += ` DEFAULT CURRENT_TIMESTAMP`;
      } else {
        const escaped = options.defaultValue.replace(/'/g, "''");
        definition += ` DEFAULT '${escaped}'`;
      }
    } else if (typeof options.defaultValue === 'boolean') {
      definition += ` DEFAULT ${options.defaultValue ? 1 : 0}`;
    } else if (typeof options.defaultValue === 'number') {
      definition += ` DEFAULT ${options.defaultValue}`;
    } else if (typeof options.defaultValue === 'object') {
      const jsonStr = JSON.stringify(options.defaultValue).replace(/'/g, "''");
      definition += ` DEFAULT ('${jsonStr}')`;
    }
  }

  if (options.autoIncrement === true && isNumeric) {
    definition += ' AUTO_INCREMENT';
  }

  if (options.primaryKey === true) {
    definition += ' PRIMARY KEY';
  }

  if (options.comment) {
    const escapedComment = options.comment.replace(/'/g, "''");
    definition += ` COMMENT '${escapedComment}'`;
  }

  return definition;
};

/**
 * Checks if a column is part of a foreign key constraint to prevent schema damage.
 */
const checkForeignKeyUsage = async (client, dbName, tableName, columnName) => {
  const rows = await client.$queryRawUnsafe(
    `SELECT CONSTRAINT_NAME as constraintName, TABLE_NAME as tableName, COLUMN_NAME as columnName
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND (
         (TABLE_NAME = ? AND COLUMN_NAME = ?)
         OR (REFERENCED_TABLE_NAME = ? AND REFERENCED_COLUMN_NAME = ?)
       )
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    dbName,
    tableName, columnName,
    tableName, columnName
  );
  if (rows && rows.length > 0) {
    throw new Error(
      `Cannot alter/drop column "${columnName}" because it is referenced in a foreign key constraint: ${rows[0].constraintName} on table ${rows[0].tableName}(${rows[0].columnName}).`
    );
  }
};

/**
 * Lists all columns of a user table including detailed descriptors.
 */
exports.listColumns = async (project, tableName) => {
  const client = getClientForProject(project);
  await checkTableExistsAndUserCreated(client, project.dbName, tableName);

  const columns = await client.$queryRawUnsafe(
    `SELECT 
       COLUMN_NAME as name,
       DATA_TYPE as dataType,
       COLUMN_TYPE as columnType,
       IS_NULLABLE as isNullable,
       COLUMN_DEFAULT as defaultValue,
       COLUMN_COMMENT as comment,
       EXTRA as extra,
       COLUMN_KEY as columnKey
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    project.dbName,
    tableName
  );

  const indexes = await client.$queryRawUnsafe(
    `SELECT COLUMN_NAME as columnName, NON_UNIQUE as nonUnique
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    project.dbName,
    tableName
  );

  return columns.map(col => {
    const isNullable = col.isNullable === 'YES';
    const unique = indexes.some(idx => idx.columnName === col.name && idx.nonUnique === 0);
    const indexed = indexes.some(idx => idx.columnName === col.name);
    const isPrimaryKey = col.columnKey === 'PRI';
    
    let defaultValue = col.defaultValue;
    if (defaultValue !== null) {
      if (defaultValue === 'NULL' || defaultValue === 'NULL_to_be_filtered') {
        defaultValue = null;
      } else if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
        defaultValue = defaultValue.slice(1, -1);
      }
    }

    return {
      name: col.name,
      type: col.dataType,
      columnType: col.columnType,
      nullable: isNullable,
      defaultValue: defaultValue,
      unique: unique,
      indexed: indexed,
      primaryKey: isPrimaryKey,
      comment: col.comment || '',
      autoIncrement: col.extra.toLowerCase().includes('auto_increment'),
      unsigned: col.columnType.toLowerCase().includes('unsigned')
    };
  });
};

/**
 * Dynamically adds a new column to a user table.
 */
exports.addColumn = async (project, tableName, columnData) => {
  const client = getClientForProject(project);
  await checkTableExistsAndUserCreated(client, project.dbName, tableName);

  const { name, type, options = {} } = columnData;
  if (!name || !type) {
    throw new Error('Column name and type are required.');
  }

  validateIdentifier(name);

  // Prevent duplicate names
  const existing = await client.$queryRawUnsafe(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    project.dbName,
    tableName,
    name
  );
  if (existing && existing.length > 0) {
    throw new Error(`Column "${name}" already exists in table "${tableName}".`);
  }

  const colDef = buildColumnDefinition(name, type, options);
  const sql = `ALTER TABLE \`${tableName}\` ADD COLUMN ${colDef};`;
  
  await client.$executeRawUnsafe(sql);

  // Handle index creation
  if (options.unique === true) {
    const uniqueSql = `ALTER TABLE \`${tableName}\` ADD UNIQUE INDEX \`idx_unique_${tableName}_${name}\` (\`${name}\`);`;
    await client.$executeRawUnsafe(uniqueSql);
  } else if (options.indexed === true) {
    const indexSql = `ALTER TABLE \`${tableName}\` ADD INDEX \`idx_${tableName}_${name}\` (\`${name}\`);`;
    await client.$executeRawUnsafe(indexSql);
  }
};

/**
 * Dynamically updates an existing column name, type, options or indexing.
 */
exports.updateColumn = async (project, tableName, columnName, columnData) => {
  const client = getClientForProject(project);
  await checkTableExistsAndUserCreated(client, project.dbName, tableName);

  validateIdentifier(columnName);

  // Ensure target column exists
  const existing = await client.$queryRawUnsafe(
    `SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    project.dbName,
    tableName,
    columnName
  );
  if (!existing || existing.length === 0) {
    throw new Error(`Column "${columnName}" does not exist in table "${tableName}".`);
  }

  // Prevent modifying system columns
  const systemColumns = ['id', 'created_at', 'updated_at'];
  if (systemColumns.includes(columnName.toLowerCase())) {
    throw new Error(`Cannot modify system column "${columnName}".`);
  }

  const { name: newName, type, options = {} } = columnData;
  if (newName) validateIdentifier(newName);

  const targetName = newName || columnName;

  // Prevent duplicate naming collision
  if (newName && newName !== columnName) {
    const conflict = await client.$queryRawUnsafe(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      project.dbName,
      tableName,
      newName
    );
    if (conflict && conflict.length > 0) {
      throw new Error(`Column "${newName}" already exists in table "${tableName}".`);
    }
  }

  // Validate constraint modifications
  await checkForeignKeyUsage(client, project.dbName, tableName, columnName);

  const colDef = buildColumnDefinition(targetName, type || existing[0].DATA_TYPE, options);
  const sql = `ALTER TABLE \`${tableName}\` CHANGE COLUMN \`${columnName}\` ${colDef};`;
  await client.$executeRawUnsafe(sql);

  // Sync index states
  const existingIndexes = await client.$queryRawUnsafe(
    `SELECT INDEX_NAME as indexName, NON_UNIQUE as nonUnique
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    project.dbName,
    tableName,
    columnName
  );

  for (const idx of existingIndexes) {
    if (idx.indexName !== 'PRIMARY') {
      try {
        const dropIdxSql = `ALTER TABLE \`${tableName}\` DROP INDEX \`${idx.indexName}\`;`;
        await client.$executeRawUnsafe(dropIdxSql);
      } catch (err) {
        console.warn(`[SchemaService] Failed to drop index ${idx.indexName}:`, err.message);
      }
    }
  }

  if (options.unique === true) {
    const uniqueSql = `ALTER TABLE \`${tableName}\` ADD UNIQUE INDEX \`idx_unique_${tableName}_${targetName}\` (\`${targetName}\`);`;
    await client.$executeRawUnsafe(uniqueSql);
  } else if (options.indexed === true) {
    const indexSql = `ALTER TABLE \`${tableName}\` ADD INDEX \`idx_${tableName}_${targetName}\` (\`${targetName}\`);`;
    await client.$executeRawUnsafe(indexSql);
  }
};

/**
 * Dynamically drops a column from a user table.
 */
exports.dropColumn = async (project, tableName, columnName) => {
  const client = getClientForProject(project);
  await checkTableExistsAndUserCreated(client, project.dbName, tableName);

  validateIdentifier(columnName);

  // Verify column exists
  const existing = await client.$queryRawUnsafe(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    project.dbName,
    tableName,
    columnName
  );
  if (!existing || existing.length === 0) {
    throw new Error(`Column "${columnName}" does not exist in table "${tableName}".`);
  }

  // Prevent dropping system columns
  const systemColumns = ['id', 'created_at', 'updated_at'];
  if (systemColumns.includes(columnName.toLowerCase())) {
    throw new Error(`Cannot drop system column "${columnName}".`);
  }

  // Validate constraints
  await checkForeignKeyUsage(client, project.dbName, tableName, columnName);

  const sql = `ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\`;`;
  await client.$executeRawUnsafe(sql);
};


