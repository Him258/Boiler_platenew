/**
 * Repair Script: Fix broken TestProject (proj_testproject_cd091c93)
 *
 * This script:
 *  1. Loads the project row from the control plane
 *  2. Decrypts the stored DB password
 *  3. Tests if the stored credentials actually work
 *  4. If auth fails → drops old MySQL user, recreates it with the stored password
 *  5. Re-grants all required privileges on the project database
 *  6. Flushes privileges
 *  7. Verifies the database and all base tables exist (creates if missing)
 *  8. Runs the same auth column migration as migrate_auth_columns.js
 *  9. Reports the final state
 *
 * Usage:
 *   node scripts/repair_project.js [projectName]
 *
 * Example:
 *   node scripts/repair_project.js TestProject
 *   (defaults to "TestProject" if no arg given)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const encryptionService = require('../src/core/services/encryption.service');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEMA_PATH = path.join(__dirname, '../src/modules/project/resources/base_schema.sql');

// Root connection (no password — XAMPP default)
const rootClient = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

// ──────────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────────

const getExistingColumns = async (client, dbName, tableName) => {
  const rows = await client.$queryRawUnsafe(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    dbName, tableName
  );
  return new Set(rows.map(r => r.COLUMN_NAME));
};

const tableExists = async (client, dbName, tableName) => {
  const rows = await client.$queryRawUnsafe(
    'SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    dbName, tableName
  );
  return Number(rows[0].cnt) > 0;
};

/**
 * Try connecting to the project database with stored credentials.
 * Returns true if connection + simple query succeeds, false otherwise.
 */
const testConnection = async (project, plainPassword) => {
  const { PrismaClient: PC } = require('@prisma/client');
  const url = `mysql://${project.dbUsername}:${plainPassword}@${project.dbHost}:${project.dbPort}/${project.dbName}`;
  const testClient = new PC({ datasources: { db: { url } } });
  try {
    await testClient.$connect();
    await testClient.$queryRawUnsafe('SELECT 1');
    await testClient.$disconnect();
    return true;
  } catch {
    try { await testClient.$disconnect(); } catch {}
    return false;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Auth column migration definitions (same as migrate_auth_columns.js)
// ──────────────────────────────────────────────────────────────────────────────

const EXPECTED_USER_COLUMNS = [
  { name: 'phone',           ddl: "ADD COLUMN `phone` VARCHAR(50) DEFAULT NULL AFTER `role`" },
  { name: 'provider',        ddl: "ADD COLUMN `provider` VARCHAR(50) DEFAULT 'local' AFTER `phone`" },
  { name: 'email_confirmed', ddl: "ADD COLUMN `email_confirmed` TINYINT(1) DEFAULT 0 AFTER `provider`" },
  { name: 'status',          ddl: "ADD COLUMN `status` VARCHAR(50) DEFAULT 'active' AFTER `email_confirmed`" },
  { name: 'last_login',      ddl: "ADD COLUMN `last_login` DATETIME DEFAULT NULL AFTER `status`" },
];

const EXPECTED_SESSION_COLUMNS = [
  { name: 'ip_address', ddl: "ADD COLUMN `ip_address` VARCHAR(45) DEFAULT NULL AFTER `token`" },
  { name: 'browser',    ddl: "ADD COLUMN `browser` VARCHAR(100) DEFAULT NULL AFTER `ip_address`" },
  { name: 'device',     ddl: "ADD COLUMN `device` VARCHAR(100) DEFAULT NULL AFTER `browser`" },
];

const CREATE_AUDIT_LOGS = `
  CREATE TABLE IF NOT EXISTS \`auth_audit_logs\` (
    \`id\`         VARCHAR(36)  NOT NULL,
    \`user_id\`    VARCHAR(36)  DEFAULT NULL,
    \`email\`      VARCHAR(255) DEFAULT NULL,
    \`action\`     VARCHAR(50)  NOT NULL,
    \`ip_address\` VARCHAR(45)  DEFAULT NULL,
    \`device\`     VARCHAR(255) DEFAULT NULL,
    \`status\`     VARCHAR(50)  NOT NULL,
    \`created_at\` DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

// ──────────────────────────────────────────────────────────────────────────────
// Main repair flow
// ──────────────────────────────────────────────────────────────────────────────

const run = async () => {
  const targetName = process.argv[2] || 'TestProject';
  console.log(`\n🔧 Kiaan Core — Project Repair Tool`);
  console.log(`   Target: "${targetName}"\n`);

  // Step 1: Load project from control plane
  console.log('Step 1: Loading project from control plane...');
  await rootClient.$connect();

  const rows = await rootClient.$queryRawUnsafe(
    'SELECT * FROM `Project` WHERE `name` = ? LIMIT 1',
    targetName
  );

  if (!rows || rows.length === 0) {
    console.error(`  ✗ Project "${targetName}" not found in control plane.`);
    console.error('    Available projects:');
    const all = await rootClient.$queryRawUnsafe('SELECT name, status FROM `Project`');
    all.forEach(p => console.error(`      - ${p.name} (${p.status})`));
    await rootClient.$disconnect();
    process.exit(1);
  }

  const project = rows[0];
  console.log(`  ✓ Found project: ${project.name}`);
  console.log(`    ID         : ${project.id}`);
  console.log(`    Status     : ${project.status}`);
  console.log(`    DB Host    : ${project.dbHost}:${project.dbPort}`);
  console.log(`    DB Name    : ${project.dbName}`);
  console.log(`    DB User    : ${project.dbUsername}`);

  // Step 2: Decrypt stored password
  console.log('\nStep 2: Decrypting stored DB credentials...');
  let plainPassword;
  try {
    plainPassword = encryptionService.decrypt(project.dbPasswordEncrypted);
    console.log(`  ✓ Decryption successful. Password length: ${plainPassword.length} chars`);
  } catch (e) {
    console.error('  ✗ Decryption FAILED:', e.message);
    console.error('    The encrypted password blob is corrupted or the ENCRYPTION_KEY changed.');
    await rootClient.$disconnect();
    process.exit(1);
  }

  // Step 3: Test if the stored credentials work
  console.log('\nStep 3: Testing connectivity with stored credentials...');
  const canConnect = await testConnection(project, plainPassword);

  if (canConnect) {
    console.log('  ✓ Connection succeeded with stored credentials.');
    console.log('    The stored password is correct. Issue was transient or already resolved.');
  } else {
    console.log('  ✗ Connection FAILED with stored credentials.');
    console.log('    Proceeding to repair MySQL user...');

    // Step 4: Check if the database actually exists
    console.log('\nStep 4: Verifying database existence via root connection...');
    const dbRows = await rootClient.$queryRawUnsafe(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      project.dbName
    );
    const dbExists = dbRows && dbRows.length > 0;
    console.log(`  Database \`${project.dbName}\`: ${dbExists ? '✓ EXISTS' : '✗ MISSING — will create'}`);

    if (!dbExists) {
      console.log(`\n  Creating database \`${project.dbName}\`...`);
      await rootClient.$executeRawUnsafe(
        `CREATE DATABASE \`${project.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      console.log('  ✓ Database created.');
    }

    // Step 5: Drop old user if it exists, then recreate
    console.log('\nStep 5: Recreating MySQL user with stored password...');
    
    const userRows = await rootClient.$queryRawUnsafe(
      "SELECT User FROM mysql.user WHERE User = ? AND Host = '%'",
      project.dbUsername
    );
    
    if (userRows && userRows.length > 0) {
      console.log(`  Found existing user '${project.dbUsername}'@'%' — dropping it first...`);
      await rootClient.$executeRawUnsafe(`DROP USER '${project.dbUsername}'@'%'`);
      console.log(`  ✓ Dropped old user.`);
    } else {
      console.log(`  User '${project.dbUsername}'@'%' does not exist — creating fresh.`);
    }

    await rootClient.$executeRawUnsafe(
      `CREATE USER '${project.dbUsername}'@'%' IDENTIFIED BY '${plainPassword}'`
    );
    console.log(`  ✓ User '${project.dbUsername}'@'%' created.`);

    // Step 6: Grant all required privileges
    console.log('\nStep 6: Granting privileges...');
    await rootClient.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, CREATE TEMPORARY TABLES, REFERENCES ON \`${project.dbName}\`.* TO '${project.dbUsername}'@'%'`
    );
    await rootClient.$executeRawUnsafe('FLUSH PRIVILEGES');
    console.log(`  ✓ GRANT ALL on \`${project.dbName}\`.* TO '${project.dbUsername}'@'%'`);
    console.log('  ✓ FLUSH PRIVILEGES done.');

    // Step 7: Re-test connection now
    console.log('\nStep 7: Re-testing connectivity after repair...');
    const canConnectNow = await testConnection(project, plainPassword);
    if (!canConnectNow) {
      console.error('  ✗ Connection STILL fails after recreating user. Manual intervention needed.');
      console.error(`    Credentials: mysql -u ${project.dbUsername} -p'${plainPassword}' ${project.dbName}`);
      await rootClient.$disconnect();
      process.exit(1);
    }
    console.log('  ✓ Connection now succeeds with stored credentials.');
  }

  // Step 8: Bootstrap schema on the project database (apply base_schema.sql)
  console.log('\nStep 8: Bootstrapping base schema (applying base_schema.sql)...');
  const { PrismaClient: PC } = require('@prisma/client');
  const projectUrl = `mysql://${project.dbUsername}:${plainPassword}@${project.dbHost}:${project.dbPort}/${project.dbName}`;
  const projectClient = new PC({ datasources: { db: { url: projectUrl } } });

  try {
    await projectClient.$connect();

    const sqlContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const statements = sqlContent
      .split(';')
      .map(s => s.split('\n').filter(l => !l.trim().startsWith('--') && l.trim().length > 0).join('\n').trim())
      .filter(s => s.length > 0);

    let created = 0, skipped = 0;
    for (const stmt of statements) {
      try {
        await projectClient.$executeRawUnsafe(stmt);
        created++;
      } catch (e) {
        // Table already exists → not an error
        if (e.message && e.message.includes('already exists')) {
          skipped++;
        } else {
          console.warn(`    ⚠ DDL warning: ${e.message}`);
        }
      }
    }
    console.log(`  ✓ Schema bootstrap done. Statements: ${created} applied, ${skipped} already existed.`);
  } catch (e) {
    console.error('  ✗ Schema bootstrap failed:', e.message);
    await projectClient.$disconnect();
    await rootClient.$disconnect();
    process.exit(1);
  }

  // Step 9: Auth column migration (idempotent)
  console.log('\nStep 9: Running auth column migration...');

  const appliedCols = [];
  const skippedCols = [];

  const userCols = await getExistingColumns(projectClient, project.dbName, 'users');
  for (const col of EXPECTED_USER_COLUMNS) {
    if (!userCols.has(col.name)) {
      await projectClient.$executeRawUnsafe(`ALTER TABLE \`users\` ${col.ddl}`);
      appliedCols.push(`users.${col.name}`);
    } else {
      skippedCols.push(`users.${col.name}`);
    }
  }

  const sessionCols = await getExistingColumns(projectClient, project.dbName, 'sessions');
  for (const col of EXPECTED_SESSION_COLUMNS) {
    if (!sessionCols.has(col.name)) {
      await projectClient.$executeRawUnsafe(`ALTER TABLE \`sessions\` ${col.ddl}`);
      appliedCols.push(`sessions.${col.name}`);
    } else {
      skippedCols.push(`sessions.${col.name}`);
    }
  }

  await projectClient.$executeRawUnsafe(CREATE_AUDIT_LOGS);
  appliedCols.push('table:auth_audit_logs (CREATE IF NOT EXISTS)');

  if (appliedCols.length > 0) {
    console.log(`  Applied ${appliedCols.length} change(s):`);
    appliedCols.forEach(c => console.log(`    + ${c}`));
  }
  if (skippedCols.length > 0) {
    console.log(`  Skipped ${skippedCols.length} already-existing column(s):`);
    skippedCols.forEach(c => console.log(`    ✓ ${c}`));
  }

  // Step 10: If project status is 'error' or 'provisioning', set it to 'active'
  console.log('\nStep 10: Ensuring project status is active...');
  if (project.status !== 'active') {
    await rootClient.$executeRawUnsafe(
      "UPDATE `Project` SET `status` = 'active', `updatedAt` = NOW() WHERE `id` = ?",
      project.id
    );
    console.log(`  ✓ Project status updated: ${project.status} → active`);
  } else {
    console.log('  ✓ Project status is already active. No change needed.');
  }

  await projectClient.$disconnect();
  await rootClient.$disconnect();

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(`🎉 Project "${project.name}" has been successfully repaired!`);
  console.log(`   Database : ${project.dbName}`);
  console.log(`   User     : ${project.dbUsername}`);
  console.log(`   Status   : active`);
  console.log(`   The Authentication Console can now load this project's data.`);
  console.log('──────────────────────────────────────────────────────────\n');
};

run().catch(e => {
  console.error('\n✗ Unhandled error during repair:', e.message);
  console.error(e.stack);
  process.exit(1);
});
