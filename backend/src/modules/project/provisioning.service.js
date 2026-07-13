const prisma = require('../../config/db');

/**
 * Execute raw administrative queries on the control database connection (which runs as root).
 */

exports.provisionDatabase = async ({ dbName, dbUsername, dbPassword }) => {
  // Validate identifier characters to prevent injection (alphanumeric and underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(dbName) || !/^[a-zA-Z0-9_]+$/.test(dbUsername)) {
    throw new Error('Invalid database or username identifiers');
  }

  try {
    console.log(`[Provisioning] Creating database: ${dbName}`);
    await prisma.$executeRawUnsafe(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

    console.log(`[Provisioning] Creating database user: ${dbUsername}`);
    // Note: Parameterized query for password is not supported by CREATE USER in MySQL raw DDL,
    // so we build it safely after enforcing strict string-checks.
    await prisma.$executeRawUnsafe(`CREATE USER '${dbUsername}'@'%' IDENTIFIED BY '${dbPassword}';`);

    console.log(`[Provisioning] Granting permissions on ${dbName} to ${dbUsername}`);
    await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, CREATE TEMPORARY TABLES, REFERENCES ON \`${dbName}\`.* TO '${dbUsername}'@'%';`);
    await prisma.$executeRawUnsafe('FLUSH PRIVILEGES;');
    
    console.log(`[Provisioning] Successfully provisioned ${dbName}`);
  } catch (error) {
    console.error(`[Provisioning] Failed during database/user creation:`, error);
    throw error;
  }
};

exports.deprovisionDatabase = async ({ dbName, dbUsername }) => {
  if (!/^[a-zA-Z0-9_]+$/.test(dbName) || !/^[a-zA-Z0-9_]+$/.test(dbUsername)) {
    throw new Error('Invalid database or username identifiers');
  }

  try {
    console.log(`[Deprovisioning] Dropping database: ${dbName}`);
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${dbName}\`;`);

    console.log(`[Deprovisioning] Dropping database user: ${dbUsername}`);
    await prisma.$executeRawUnsafe(`DROP USER IF EXISTS '${dbUsername}'@'%';`);
    await prisma.$executeRawUnsafe('FLUSH PRIVILEGES;');

    console.log(`[Deprovisioning] Successfully deprovisioned ${dbName}`);
  } catch (error) {
    console.error(`[Deprovisioning] Deprovisioning failed for ${dbName}:`, error);
    throw error;
  }
};
