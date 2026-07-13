const crypto = require('crypto');
const { getClientForProject } = require('./projectConnection');

const SYSTEM_TABLES = ['users', 'sessions', 'buckets', 'objects', 'auth_audit_logs'];

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
 * Helper to check if a table exists in the database and is not restricted.
 */
const checkTableAndAuthorize = async (client, dbName, tableName) => {
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
 * Retrieves the table structure column list from MySQL schemas.
 */
const getTableColumns = async (client, dbName, tableName) => {
  const rows = await client.$queryRawUnsafe(
    `SELECT COLUMN_NAME as name, DATA_TYPE as type, COLUMN_KEY as columnKey
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    dbName,
    tableName
  );
  return rows;
};

/**
 * Inserts a new record into a dynamically created table.
 */
exports.insertRecord = async (project, tableName, payload) => {
  const client = getClientForProject(project);
  await checkTableAndAuthorize(client, project.dbName, tableName);

  const cols = await getTableColumns(client, project.dbName, tableName);
  const colNames = cols.map(c => c.name);

  // Validate request body keys
  const bodyKeys = Object.keys(payload);
  for (const key of bodyKeys) {
    validateIdentifier(key);
    if (!colNames.includes(key)) {
      throw new Error(`Column "${key}" does not exist in table "${tableName}".`);
    }
  }

  // Ensure id is generated if not present
  const recordId = payload.id || crypto.randomUUID();
  
  const insertKeys = ['id', ...bodyKeys.filter(k => k !== 'id')];
  const insertValues = [recordId, ...insertKeys.slice(1).map(k => payload[k])];

  const escapedKeys = insertKeys.map(k => `\`${k}\``).join(', ');
  const placeholders = insertKeys.map(() => '?').join(', ');
  const sql = `INSERT INTO \`${tableName}\` (${escapedKeys}) VALUES (${placeholders});`;

  console.log(`[DataService.insertRecord] Executing SQL: ${sql} with values:`, insertValues);
  await client.$executeRawUnsafe(sql, ...insertValues);

  return await exports.getRecord(project, tableName, recordId);
};

/**
 * Retrieves a single record from a dynamically created table.
 */
exports.getRecord = async (project, tableName, id) => {
  const client = getClientForProject(project);
  await checkTableAndAuthorize(client, project.dbName, tableName);

  const rows = await client.$queryRawUnsafe(
    `SELECT * FROM \`${tableName}\` WHERE \`id\` = ? LIMIT 1`,
    id
  );
  if (!rows || rows.length === 0) {
    throw new Error(`Record with ID "${id}" not found in table "${tableName}".`);
  }
  return rows[0];
};

/**
 * Updates an existing record in a dynamically created table.
 */
exports.updateRecord = async (project, tableName, id, payload) => {
  const client = getClientForProject(project);
  await checkTableAndAuthorize(client, project.dbName, tableName);

  // Validate the record exists
  await exports.getRecord(project, tableName, id);

  const cols = await getTableColumns(client, project.dbName, tableName);
  const colNames = cols.map(c => c.name);

  const bodyKeys = Object.keys(payload).filter(k => k !== 'id');
  for (const key of bodyKeys) {
    validateIdentifier(key);
    if (!colNames.includes(key)) {
      throw new Error(`Column "${key}" does not exist in table "${tableName}".`);
    }
  }

  if (bodyKeys.length === 0) {
    return await exports.getRecord(project, tableName, id);
  }

  const updateClauses = bodyKeys.map(k => `\`${k}\` = ?`).join(', ');
  const updateValues = [...bodyKeys.map(k => payload[k]), id];

  const sql = `UPDATE \`${tableName}\` SET ${updateClauses} WHERE \`id\` = ?;`;
  console.log(`[DataService.updateRecord] Executing SQL: ${sql} with values:`, updateValues);
  await client.$executeRawUnsafe(sql, ...updateValues);

  return await exports.getRecord(project, tableName, id);
};

/**
 * Deletes a record from a dynamically created table.
 */
exports.deleteRecord = async (project, tableName, id) => {
  const client = getClientForProject(project);
  await checkTableAndAuthorize(client, project.dbName, tableName);

  const record = await exports.getRecord(project, tableName, id);

  const sql = `DELETE FROM \`${tableName}\` WHERE \`id\` = ?;`;
  console.log(`[DataService.deleteRecord] Executing SQL: ${sql} with ID:`, id);
  await client.$executeRawUnsafe(sql, id);

  return record;
};

/**
 * Lists records from a dynamic table supporting filtering, sort, search and page metrics.
 */
exports.listRecords = async (project, tableName, queryOptions) => {
  const client = getClientForProject(project);
  await checkTableAndAuthorize(client, project.dbName, tableName);

  const cols = await getTableColumns(client, project.dbName, tableName);
  const colNames = cols.map(c => c.name);

  const {
    page = 1,
    limit = 20,
    offset: customOffset,
    sort = 'id',
    order = 'DESC',
    search,
    select = '*',
    filters = {}
  } = queryOptions;

  // Build Select columns
  let selectClause = '*';
  if (select !== '*') {
    const selectFields = select.split(',').map(s => s.trim());
    for (const field of selectFields) {
      validateIdentifier(field);
      if (!colNames.includes(field)) {
        throw new Error(`Select column "${field}" does not exist in table "${tableName}".`);
      }
    }
    selectClause = selectFields.map(f => `\`${f}\``).join(', ');
  }

  // Build Where clause clauses
  const whereClauses = [];
  const queryParams = [];

  // 1. Column equality filters
  const filterKeys = Object.keys(filters);
  for (const key of filterKeys) {
    validateIdentifier(key);
    if (!colNames.includes(key)) {
      throw new Error(`Filter column "${key}" does not exist in table "${tableName}".`);
    }
    whereClauses.push(`\`${key}\` = ?`);
    queryParams.push(filters[key]);
  }

  // 2. Full-text search
  if (search) {
    const searchCols = cols.filter(c => {
      const typeLower = c.type.toLowerCase();
      return typeLower.includes('char') || typeLower.includes('text') || typeLower.includes('varchar');
    });

    if (searchCols.length > 0) {
      const searchClauses = searchCols.map(c => `\`${c.name}\` LIKE ?`).join(' OR ');
      whereClauses.push(`(${searchClauses})`);
      for (let i = 0; i < searchCols.length; i++) {
        queryParams.push(`%${search}%`);
      }
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Sort settings
  const sortCol = colNames.includes(sort) ? sort : 'id';
  const sortOrder = ['ASC', 'DESC'].includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

  // Limit/offset pagination bounds (strictly parsed as integers)
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const parsedOffset = customOffset !== undefined ? parseInt(customOffset) : (Math.max(1, parseInt(page)) - 1) * parsedLimit;

  // Execute list selection
  const querySql = `SELECT ${selectClause} FROM \`${tableName}\` ${whereSql} ORDER BY \`${sortCol}\` ${sortOrder} LIMIT ${parsedLimit} OFFSET ${parsedOffset};`;
  console.log(`[DataService.listRecords] Executing SQL: ${querySql} with values:`, queryParams);
  const records = await client.$queryRawUnsafe(querySql, ...queryParams);

  // Execute counting if requested
  let totalCount = null;
  if (queryOptions.count === 'true' || queryOptions.count === true) {
    const countSql = `SELECT COUNT(*) as total FROM \`${tableName}\` ${whereSql};`;
    const countResult = await client.$queryRawUnsafe(countSql, ...queryParams);
    totalCount = countResult && countResult[0] ? Number(countResult[0].total) : 0;
  }

  return {
    records,
    total: totalCount
  };
};
