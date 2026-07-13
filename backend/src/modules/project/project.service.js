const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const encryptionService = require('../../core/services/encryption.service');
const provisioningService = require('./provisioning.service');
const schemaService = require('./schema.service');

// Helper to generate unique refId
const generateRefId = (name) => {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);
  const randomStr = crypto.randomBytes(4).toString('hex');
  return `${cleanName}-${randomStr}`;
};

exports.createProject = async ({ name, tenantId, creatorId }) => {
  // Check if tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const refId = generateRefId(name);
  
  const dbHost = process.env.DATABASE_HOST || 'localhost';
  const dbPort = parseInt(process.env.DATABASE_PORT || '3306', 10);
  const dbName = `proj_${refId.replace(/-/g, '_')}`;
  const dbUsername = `user_${refId.replace(/-/g, '_')}`;
  const dbPassword = crypto.randomBytes(16).toString('hex');
  const jwtSecret = crypto.randomBytes(32).toString('hex');

  // Encrypt secrets at rest
  const dbPasswordEncrypted = encryptionService.encrypt(dbPassword);
  const jwtSecretEncrypted = encryptionService.encrypt(jwtSecret);

  // 1. Create Project Metadata in Control Plane (Set status as 'provisioning')
  const project = await prisma.$transaction(async (tx) => {
    const proj = await tx.project.create({
      data: {
        tenantId,
        name,
        refId,
        dbHost,
        dbPort,
        dbName,
        dbUsername,
        dbPasswordEncrypted,
        jwtSecretEncrypted,
        status: 'provisioning'
      }
    });

    const anonToken = jwt.sign(
      { role: 'anon', projectId: proj.id, refId: proj.refId },
      jwtSecret,
      { expiresIn: '10y' }
    );

    const serviceRoleToken = jwt.sign(
      { role: 'service_role', projectId: proj.id, refId: proj.refId },
      jwtSecret,
      { expiresIn: '10y' }
    );

    await tx.projectApiKey.createMany({
      data: [
        {
          projectId: proj.id,
          name: 'anon',
          keyType: 'anon',
          keyToken: anonToken
        },
        {
          projectId: proj.id,
          name: 'service_role',
          keyType: 'service_role',
          keyToken: serviceRoleToken
        }
      ]
    });

    // --- AUTO-PROVISION RBAC FOR THE NEW PROJECT ---
    
    // A. Create the project Admin role
    const adminRole = await tx.role.create({
      data: {
        projectId: proj.id,
        roleName: 'Admin',
        name: 'Admin',
        type: 'System',
        createdBy: creatorId || 'System',
        status: 'Active'
      }
    });

    // B. Create the project authenticated role
    const authenticatedRole = await tx.role.create({
      data: {
        projectId: proj.id,
        roleName: 'authenticated',
        name: 'authenticated',
        type: 'System',
        createdBy: creatorId || 'System',
        status: 'Active'
      }
    });

    // C. Define default permissions
    const defaultPermissions = [
      // Legacy / wildcard permissions for backward compatibility
      { resource: 'database', action: '*' },
      { resource: 'storage', action: '*' },
      { resource: 'users', action: '*' },
      { resource: 'roles', action: '*' },
      { resource: 'project', action: '*' },
      { resource: 'database', action: 'write' },
      { resource: 'storage', action: 'read' },
      { resource: 'storage', action: 'write' },

      // Module 6 specified permissions
      { resource: 'database', action: 'create' },
      { resource: 'database', action: 'read' },
      { resource: 'database', action: 'update' },
      { resource: 'database', action: 'delete' },
      { resource: 'storage', action: 'upload' },
      { resource: 'storage', action: 'download' },
      { resource: 'storage', action: 'delete' },
      { resource: 'users', action: 'manage' },
      { resource: 'roles', action: 'manage' },
      { resource: 'project', action: 'settings' }
    ];

    // D. Upsert all permissions and map them by resource_action
    const permMap = {};
    for (const dp of defaultPermissions) {
      const perm = await tx.permission.upsert({
        where: {
          resource_action: {
            resource: dp.resource,
            action: dp.action
          }
        },
        update: {},
        create: {
          module: dp.resource,
          resource: dp.resource,
          action: dp.action
        }
      });
      permMap[`${dp.resource}.${dp.action}`] = perm.id;
    }

    // E. Associate ALL permissions with Admin role
    await tx.rolePermission.createMany({
      data: Object.values(permMap).map(permId => ({
        roleId: adminRole.id,
        permissionId: permId
      }))
    });

    // F. Associate permissions with authenticated role
    const authPermKeys = [
      'database.read', 'database.write', 'database.create', 'storage.read', 'storage.write'
    ];
    await tx.rolePermission.createMany({
      data: authPermKeys.map(key => ({
        roleId: authenticatedRole.id,
        permissionId: permMap[key]
      }))
    });

    // G. Assign the project creator to the Admin role
    if (creatorId) {
      await tx.userRole.create({
        data: {
          userId: creatorId,
          roleId: adminRole.id,
          projectId: proj.id
        }
      });
    }

    return proj;
  }, {
    maxWait: 15000,
    timeout: 20000
  });

  // 2. Perform Provisioning
  try {
    // A. Provision Database and User
    await provisioningService.provisionDatabase({ dbName, dbUsername, dbPassword });

    // B. Bootstrap Schema
    await schemaService.bootstrapSchema({ dbHost, dbPort, dbName, dbUsername, dbPassword });

    // C. Mark as active
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'active' }
    });
  } catch (error) {
    console.error(`[ProjectService] Provisioning failed for project ${project.id}. Rolling back/marking error:`, error);
    
    // Attempt deprovisioning rollback
    try {
      await provisioningService.deprovisionDatabase({ dbName, dbUsername });
    } catch (rollbackErr) {
      console.error(`[ProjectService] Rollback deprovisioning failed:`, rollbackErr);
    }

    // Set project status to error
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'error' }
    });
  }

  return this.getProjectById(project.id);
};

exports.retryProvisioning = async (id) => {
  const project = await prisma.project.findUnique({
    where: { id }
  });
  if (!project) {
    throw new Error('Project not found');
  }

  // Decrypt password
  const dbPassword = encryptionService.decrypt(project.dbPasswordEncrypted);

  // Set status back to provisioning
  await prisma.project.update({
    where: { id },
    data: { status: 'provisioning' }
  });

  try {
    // Attempt cleanup first
    try {
      await provisioningService.deprovisionDatabase({ dbName: project.dbName, dbUsername: project.dbUsername });
    } catch (cleanupErr) {
      console.log(`[ProjectService] Retry pre-cleanup ignored:`, cleanupErr.message);
    }

    // Provision Database and User
    await provisioningService.provisionDatabase({ 
      dbName: project.dbName, 
      dbUsername: project.dbUsername, 
      dbPassword 
    });

    // Bootstrap Schema
    await schemaService.bootstrapSchema({ 
      dbHost: project.dbHost, 
      dbPort: project.dbPort, 
      dbName: project.dbName, 
      dbUsername: project.dbUsername, 
      dbPassword 
    });

    // Mark as active
    await prisma.project.update({
      where: { id },
      data: { status: 'active' }
    });
  } catch (error) {
    console.error(`[ProjectService] Retry provisioning failed for project ${id}:`, error);

    // Attempt deprovisioning cleanup
    try {
      await provisioningService.deprovisionDatabase({ dbName: project.dbName, dbUsername: project.dbUsername });
    } catch (rollbackErr) {
      console.error(`[ProjectService] Rollback failed:`, rollbackErr);
    }

    // Set back to error
    await prisma.project.update({
      where: { id },
      data: { status: 'error' }
    });
  }

  return this.getProjectById(id);
};

exports.getProjectsByTenant = async (tenantId) => {
  const projects = await prisma.project.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' }
  });

  return projects.map(p => ({
    id: p.id,
    name: p.name,
    refId: p.refId,
    status: p.status,
    createdAt: p.createdAt
  }));
};

exports.getProjectById = async (id) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      apiKeys: true
    }
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Decrypt database password and jwt secret
  let dbPassword = null;
  let jwtSecret = null;
  try {
    dbPassword = encryptionService.decrypt(project.dbPasswordEncrypted);
    jwtSecret = encryptionService.decrypt(project.jwtSecretEncrypted);
  } catch (err) {
    console.error('Decryption failed for project secrets:', err);
  }

  return {
    id: project.id,
    tenantId: project.tenantId,
    name: project.name,
    refId: project.refId,
    status: project.status,
    createdAt: project.createdAt,
    database: {
      host: project.dbHost,
      port: project.dbPort,
      name: project.dbName,
      username: project.dbUsername,
      password: dbPassword
    },
    jwtSecret,
    apiKeys: project.apiKeys.map(k => ({
      id: k.id,
      name: k.name,
      keyType: k.keyType,
      keyToken: k.keyToken,
      createdAt: k.createdAt
    }))
  };
};

exports.deleteProject = async (id) => {
  const project = await prisma.project.findUnique({
    where: { id }
  });
  if (!project) {
    throw new Error('Project not found');
  }

  // Deprovision database and user
  try {
    await provisioningService.deprovisionDatabase({
      dbName: project.dbName,
      dbUsername: project.dbUsername
    });
  } catch (err) {
    console.error(`[ProjectService] Deprovisioning failed during deletion:`, err);
    // Continue deletion from control plane even if DB cleanup failed to avoid stuck metadata
  }

  // Delete project metadata from control database
  await prisma.project.delete({
    where: { id }
  });

  return { success: true };
};
