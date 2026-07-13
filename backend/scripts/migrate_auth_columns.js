/**
 * Migration: Add Missing Auth Columns to Existing Project Databases
 *
 * Root Cause:
 * Projects provisioned before base_schema.sql was updated have an older users/sessions
 * table structure that is missing the following columns:
 *
 * users table (missing columns):
 *   - phone          VARCHAR(50) DEFAULT NULL
 *   - provider       VARCHAR(50) DEFAULT 'local'
 *   - email_confirmed TINYINT(1) DEFAULT 0
 *   - status         VARCHAR(50) DEFAULT 'active'
 *   - last_login     DATETIME DEFAULT NULL
 *
 * sessions table (missing columns):
 *   - ip_address     VARCHAR(45) DEFAULT NULL
 *   - browser        VARCHAR(100) DEFAULT NULL
 *   - device         VARCHAR(100) DEFAULT NULL
 *
 * Missing tables:
 *   - auth_audit_logs (entire table was added after initial provisioning)
 *
 * This script:
 *  1. Loads all active projects from the control plane database
 *  2. Connects to each project's isolated MySQL database
 *  3. Uses INFORMATION_SCHEMA to check which columns are actually present
 *  4. Only runs ALTER TABLE for columns that are missing (safe, idempotent)
 *  5. Creates auth_audit_logs if it does not exist
 *  6. Reports the outcome per project
 *
 * Usage:
 *   node scripts/migrate_auth_columns.js
 */

const { PrismaClient: ControlPrisma } = require('@prisma/client');
const { PrismaClient: DynamicPrisma } = require('@prisma/client');
const encryptionService = require('../src/core/services/encryption.service');

const control = new ControlPrisma();

// Columns expected in `users` table
const EXPECTED_USER_COLUMNS = [
  { name: 'phone',           ddl: "ADD COLUMN `phone` VARCHAR(50) DEFAULT NULL AFTER `role`" },
  { name: 'provider',        ddl: "ADD COLUMN `provider` VARCHAR(50) DEFAULT 'local' AFTER `phone`" },
  { name: 'email_confirmed', ddl: "ADD COLUMN `email_confirmed` TINYINT(1) DEFAULT 0 AFTER `provider`" },
  { name: 'status',          ddl: "ADD COLUMN `status` VARCHAR(50) DEFAULT 'active' AFTER `email_confirmed`" },
  { name: 'last_login',      ddl: "ADD COLUMN `last_login` DATETIME DEFAULT NULL AFTER `status`" },
];

// Columns expected in `sessions` table
const EXPECTED_SESSION_COLUMNS = [
  { name: 'ip_address', ddl: "ADD COLUMN `ip_address` VARCHAR(45) DEFAULT NULL AFTER `token`" },
  { name: 'browser',    ddl: "ADD COLUMN `browser` VARCHAR(100) DEFAULT NULL AFTER `ip_address`" },
  { name: 'device',     ddl: "ADD COLUMN `device` VARCHAR(100) DEFAULT NULL AFTER `browser`" },
];

// Full CREATE for auth_audit_logs if it doesn't exist
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

/**
 * Returns the set of existing column names for a table in a given database.
 */
const getExistingColumns = async (client, dbName, tableName) => {
  const rows = await client.$queryRawUnsafe(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    dbName,
    tableName
  );
  return new Set(rows.map(r => r.COLUMN_NAME));
};

/**
 * Migrate a single project database
 */
const migrateProject = async (project) => {
  let dbPassword;
  try {
    dbPassword = encryptionService.decrypt(project.dbPasswordEncrypted);
  } catch (e) {
    console.error(`  ✗ [${project.name}] Failed to decrypt DB password:`, e.message);
    return { project: project.name, status: 'error', reason: 'decryption failed' };
  }

  const dbUrl = `mysql://${project.dbUsername}:${dbPassword}@${project.dbHost}:${project.dbPort}/${project.dbName}`;
  const client = new DynamicPrisma({ datasources: { db: { url: dbUrl } } });

  const applied = [];
  const skipped = [];
  const errors = [];

  try {
    await client.$connect();

    // ── 1. Migrate `users` table ──────────────────────────────────────────
    const userCols = await getExistingColumns(client, project.dbName, 'users');

    for (const col of EXPECTED_USER_COLUMNS) {
      if (!userCols.has(col.name)) {
        try {
          await client.$executeRawUnsafe(`ALTER TABLE \`users\` ${col.ddl}`);
          applied.push(`users.${col.name}`);
        } catch (e) {
          errors.push(`users.${col.name}: ${e.message}`);
        }
      } else {
        skipped.push(`users.${col.name}`);
      }
    }

    // ── 2. Migrate `sessions` table ───────────────────────────────────────
    const sessionCols = await getExistingColumns(client, project.dbName, 'sessions');

    for (const col of EXPECTED_SESSION_COLUMNS) {
      if (!sessionCols.has(col.name)) {
        try {
          await client.$executeRawUnsafe(`ALTER TABLE \`sessions\` ${col.ddl}`);
          applied.push(`sessions.${col.name}`);
        } catch (e) {
          errors.push(`sessions.${col.name}: ${e.message}`);
        }
      } else {
        skipped.push(`sessions.${col.name}`);
      }
    }

    // ── 3. Ensure `auth_audit_logs` table exists ──────────────────────────
    try {
      await client.$executeRawUnsafe(CREATE_AUDIT_LOGS);
      applied.push('table:auth_audit_logs');
    } catch (e) {
      errors.push(`auth_audit_logs: ${e.message}`);
    }

    return { project: project.name, dbName: project.dbName, status: 'ok', applied, skipped, errors };
  } catch (e) {
    return { project: project.name, dbName: project.dbName, status: 'error', reason: e.message };
  } finally {
    await client.$disconnect();
  }
};

const run = async () => {
  console.log('🔧 Kiaan Core — Auth Column Migration\n');

  let projects;
  try {
    await control.$connect();
    // Use raw to avoid any generated-client issues with new fields
    projects = await control.$queryRawUnsafe(
      "SELECT id, name, refId, dbHost, dbPort, dbName, dbUsername, dbPasswordEncrypted FROM `Project` WHERE `status` = 'active'"
    );
  } catch (e) {
    console.error('✗ Failed to load projects from control plane:', e.message);
    process.exit(1);
  }

  if (!projects || projects.length === 0) {
    console.log('ℹ  No active projects found. Nothing to migrate.\n');
    await control.$disconnect();
    return;
  }

  console.log(`Found ${projects.length} active project(s) to inspect:\n`);

  const results = [];
  for (const project of projects) {
    process.stdout.write(`  → Migrating [${project.name}] (${project.dbName}) ... `);
    const result = await migrateProject(project);
    results.push(result);

    if (result.status === 'error') {
      console.log(`✗ ERROR: ${result.reason}`);
    } else {
      const addedCount = result.applied.length;
      const skippedCount = result.skipped.length;
      const errCount = result.errors ? result.errors.length : 0;
      console.log(`✓ Done  (+${addedCount} applied, ${skippedCount} already existed, ${errCount} errors)`);
      if (result.applied.length > 0) {
        result.applied.forEach(c => console.log(`       + Added: ${c}`));
      }
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(e => console.log(`       ✗ Failed: ${e}`));
      }
    }
  }

  console.log('\n── Migration Summary ──────────────────────────────────────');
  const passed = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status === 'error').length;
  console.log(`  Projects processed : ${results.length}`);
  console.log(`  Successfully migrated: ${passed}`);
  console.log(`  Failed              : ${failed}`);

  if (failed > 0) {
    console.log('\n  Failed Projects:');
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`    ✗ ${r.project}: ${r.reason}`);
    });
    console.log('\n⚠  Some projects failed to migrate. Fix the errors above and re-run.');
  } else {
    console.log('\n🎉 All projects migrated successfully!');
    console.log('   The Authentication Console should now work correctly.\n');
  }

  await control.$disconnect();
};

run().catch(e => {
  console.error('Unhandled error during migration:', e);
  process.exit(1);
});
