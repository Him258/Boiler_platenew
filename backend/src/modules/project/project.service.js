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
    
    // Define all default permissions for the new project
    const defaultPerms = [
      { key: 'database.create', name: 'Create Database', category: 'database', desc: 'Create tables and schemas' },
      { key: 'database.read', name: 'Read Database', category: 'database', desc: 'Read table records' },
      { key: 'database.update', name: 'Update Database', category: 'database', desc: 'Update table records' },
      { key: 'database.delete', name: 'Delete Database', category: 'database', desc: 'Delete table records' },

      { key: 'storage.create', name: 'Create Storage Object', category: 'storage', desc: 'Create buckets/objects' },
      { key: 'storage.read', name: 'Read Storage Object', category: 'storage', desc: 'Read buckets/objects' },
      { key: 'storage.update', name: 'Update Storage Object', category: 'storage', desc: 'Update buckets/objects' },
      { key: 'storage.delete', name: 'Delete Storage Object', category: 'storage', desc: 'Delete buckets/objects' },

      { key: 'auth.users.read', name: 'Read Users', category: 'auth', desc: 'Read user profiles' },
      { key: 'auth.users.create', name: 'Create Users', category: 'auth', desc: 'Create user profiles' },
      { key: 'auth.users.update', name: 'Update Users', category: 'auth', desc: 'Update user profiles' },
      { key: 'auth.users.delete', name: 'Delete Users', category: 'auth', desc: 'Delete user profiles' },

      { key: 'rbac.roles.read', name: 'Read Roles', category: 'rbac', desc: 'Read roles' },
      { key: 'rbac.roles.create', name: 'Create Roles', category: 'rbac', desc: 'Create custom roles' },
      { key: 'rbac.roles.update', name: 'Update Roles', category: 'rbac', desc: 'Update custom roles' },
      { key: 'rbac.roles.delete', name: 'Delete Roles', category: 'rbac', desc: 'Delete custom roles' },

      { key: 'rbac.permissions.read', name: 'Read Permissions', category: 'rbac', desc: 'Read permissions' },
      { key: 'rbac.permissions.assign', name: 'Assign Permissions', category: 'rbac', desc: 'Assign permissions to roles' },

      { key: 'project.read', name: 'Read Project', category: 'project', desc: 'Read project settings' },
      { key: 'project.update', name: 'Update Project', category: 'project', desc: 'Update project settings' },
      { key: 'project.delete', name: 'Delete Project', category: 'project', desc: 'Delete project' },

      // Backward compatibility wildcards & keys
      { key: 'database.*', name: 'All Database Ops', category: 'database', desc: 'All database permissions' },
      { key: 'storage.*', name: 'All Storage Ops', category: 'storage', desc: 'All storage permissions' },
      { key: 'users.*', name: 'All Users Ops', category: 'users', desc: 'All users permissions' },
      { key: 'roles.*', name: 'All Roles Ops', category: 'roles', desc: 'All roles permissions' },
      { key: 'project.*', name: 'All Project Ops', category: 'project', desc: 'All project permissions' },
      { key: 'database.write', name: 'Write Database', category: 'database', desc: 'Insert/Update database records' },
      { key: 'storage.upload', name: 'Upload Storage', category: 'storage', desc: 'Upload files' },
      { key: 'storage.download', name: 'Download Storage', category: 'storage', desc: 'Download files' },
      { key: 'storage.write', name: 'Write Storage (Compat)', category: 'storage', desc: 'Write storage' },
      { key: 'users.manage', name: 'Manage Users', category: 'users', desc: 'Manage user profiles' },
      { key: 'roles.manage', name: 'Manage Roles', category: 'roles', desc: 'Manage roles' },
      { key: 'project.settings', name: 'Project Settings', category: 'project', desc: 'Update project settings' }
    ];

    // Seed all permissions
    const permMap = {};
    for (const item of defaultPerms) {
      const perm = await tx.permission.create({
        data: {
          projectId: proj.id,
          permissionKey: item.key,
          displayName: item.name,
          description: item.desc,
          category: item.category,
          status: 'Active'
        }
      });
      permMap[item.key] = perm.id;
    }

    // Define all default roles and their permission keys
    const rolesToCreate = [
      { name: 'Admin', type: 'System', perms: defaultPerms.map(p => p.key) },
      { name: 'Developer', type: 'System', perms: [
        'database.*', 'database.create', 'database.read', 'database.update', 'database.delete', 'database.write',
        'storage.*', 'storage.create', 'storage.read', 'storage.update', 'storage.delete', 'storage.upload', 'storage.download', 'storage.read', 'storage.write',
        'auth.users.read',
        'rbac.roles.read', 'rbac.roles.create', 'rbac.roles.update', 'rbac.roles.delete', 'roles.manage',
        'rbac.permissions.read', 'rbac.permissions.assign',
        'project.read'
      ]},
      { name: 'Manager', type: 'System', perms: [
        'database.*', 'database.create', 'database.read', 'database.update', 'database.delete', 'database.write',
        'storage.*', 'storage.create', 'storage.read', 'storage.update', 'storage.delete', 'storage.upload', 'storage.download', 'storage.read', 'storage.write',
        'auth.users.read', 'auth.users.create', 'auth.users.update', 'auth.users.delete', 'users.manage',
        'project.read', 'project.update', 'project.settings'
      ]},
      { name: 'User', type: 'System', perms: [
        'database.create', 'database.read', 'database.update', 'database.write',
        'storage.create', 'storage.read', 'storage.update', 'storage.upload', 'storage.download', 'storage.read', 'storage.write',
        'project.read'
      ]},
      { name: 'authenticated', type: 'System', perms: [
        'database.create', 'database.read', 'database.update', 'database.write',
        'storage.create', 'storage.read', 'storage.update', 'storage.upload', 'storage.download', 'storage.read', 'storage.write',
        'project.read'
      ]},
      { name: 'Viewer', type: 'System', perms: [
        'database.read',
        'storage.read',
        'project.read'
      ]}
    ];

    let adminRole = null;
    for (const roleDef of rolesToCreate) {
      const role = await tx.role.create({
        data: {
          projectId: proj.id,
          roleName: roleDef.name,
          name: roleDef.name,
          type: roleDef.type,
          createdBy: creatorId || 'System',
          status: 'Active'
        }
      });

      if (roleDef.name === 'Admin') {
        adminRole = role;
      }

      const uniquePermKeys = Array.from(new Set(roleDef.perms));
      const rolePermData = uniquePermKeys
        .map(key => permMap[key])
        .filter(Boolean)
        .map(permId => ({
          roleId: role.id,
          permissionId: permId
        }));

      if (rolePermData.length > 0) {
        await tx.rolePermission.createMany({
          data: rolePermData
        });
      }
    }

    // G. Assign the project creator to the Admin role
    if (creatorId && adminRole) {
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
