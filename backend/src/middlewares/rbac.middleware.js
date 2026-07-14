const prisma = require('../config/db');

/**
 * Core Permission Resolution Engine middleware
 * Resolves project-isolated permissions dynamically, supports wildcards, and caches resolved permissions on req object.
 */
const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // 1. Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User authentication context is required.'
        });
      }

      // 2. Ensure project context is present
      if (!req.project || !req.project.id) {
        return res.status(403).json({
          success: false,
          message: 'Project context is required for authorization.',
          error: {
            code: 'FORBIDDEN',
            message: 'Project context is required for authorization.'
          }
        });
      }

      const projectId = req.project.id;

      // 3. Service Role API Key bypasses checks
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['apikey'] || req.query.apikey || (authHeader && !authHeader.startsWith('Bearer ') ? authHeader : null);

      if (apiKey) {
        const apiKeyRecord = await prisma.projectApiKey.findUnique({
          where: { keyToken: apiKey }
        });
        if (apiKeyRecord && apiKeyRecord.keyType === 'service_role') {
          return next();
        }
      }

      // 4. Resolve and Cache Permissions
      if (!req.resolvedPermissions) {
        const permissionKeys = new Set();
        let userRoleName = 'Guest';

        if (req.user.userId) {
          // CASE A: Control Plane User (Developer / Owner)
          const userId = req.user.userId;
          const userRoleMappings = await prisma.userRole.findMany({
            where: { userId, projectId },
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: { permission: true }
                  }
                }
              }
            }
          });

          // Super Admin or Owner gets universal wildcard
          if (req.user.role === 'Super Admin' || req.user.roleId === 'Super Admin') {
            permissionKeys.add('*');
          }

          userRoleName = userRoleMappings.map(urm => urm.role.name || urm.role.roleName).join(', ') || 'none';

          for (const mapping of userRoleMappings) {
            if (mapping.role.name === 'Admin' || mapping.role.roleName === 'Admin') {
              permissionKeys.add('*');
            }
            for (const rp of mapping.role.rolePermissions) {
              if (rp.permission.status === 'Active') {
                permissionKeys.add(rp.permission.permissionKey);
              }
            }
          }
        } else if (req.user.sub) {
          // CASE B: Project Plane User
          const roleNames = Array.isArray(req.user.role) 
            ? req.user.role 
            : [req.user.role || 'authenticated'];

          userRoleName = roleNames.join(', ');

          const roles = await prisma.role.findMany({
            where: {
              projectId,
              OR: [
                { name: { in: roleNames } },
                { roleName: { in: roleNames } }
              ]
            },
            include: {
              rolePermissions: {
                include: { permission: true }
              }
            }
          });

          for (const role of roles) {
            if (role.name === 'Admin' || role.roleName === 'Admin') {
              permissionKeys.add('*');
            }
            for (const rp of role.rolePermissions) {
              if (rp.permission.status === 'Active') {
                permissionKeys.add(rp.permission.permissionKey);
              }
            }
          }
        } else if (apiKey) {
          // CASE C: API Key Authentication
          const apiKeyRecord = await prisma.projectApiKey.findUnique({
            where: { keyToken: apiKey }
          });
          if (apiKeyRecord && apiKeyRecord.keyType === 'anon') {
            userRoleName = 'anon';
            const anonRole = await prisma.role.findFirst({
              where: {
                projectId,
                OR: [
                  { name: 'anon' },
                  { roleName: 'anon' }
                ]
              },
              include: {
                rolePermissions: {
                  include: { permission: true }
                }
              }
            });

            if (anonRole) {
              for (const rp of anonRole.rolePermissions) {
                if (rp.permission.status === 'Active') {
                  permissionKeys.add(rp.permission.permissionKey);
                }
              }
            }
          }
        }

        req.resolvedPermissions = Array.from(permissionKeys);
        req.userRoleName = userRoleName;
      }

      // 5. Evaluate Permission Match
      const hasPermission = req.resolvedPermissions.some(permKey => {
        // Universal wildcard match
        if (permKey === '*' || permKey === '*.*') {
          return true;
        }
        // Perfect match
        if (permKey === requiredPermission) {
          return true;
        }
        // Wildcard match (e.g. database.* matches database.create)
        if (permKey.endsWith('.*')) {
          const prefix = permKey.slice(0, -2);
          if (requiredPermission.startsWith(prefix + '.')) {
            return true;
          }
        }
        return false;
      });

      if (hasPermission) {
        return next();
      }

      console.warn(`[RBAC] Access Denied. Project: ${projectId}, Role: ${req.userRoleName}, Required: ${requiredPermission}`);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions.'
        }
      });
    } catch (error) {
      console.error('[requirePermission] Authorization check failed:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during permission authorization.'
      });
    }
  };
};

/**
 * Directly evaluates whether a user has the required permission.
 * Loads all roles and their permissions from the database and applies wildcard matching.
 *
 * @param {string} userId - The control-plane user ID to check.
 * @param {string} permissionKey - The required permission key (e.g. "database.create").
 * @param {string|null} projectId - Optional project scope filter.
 * @returns {Promise<boolean>} true if the user is allowed, false otherwise.
 */
const userHasPermission = async (userId, permissionKey, projectId = null) => {
  try {
    // Fetch the user to check for Super Admin role
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    // Super Admin gets universal access
    if (user.role === 'Super Admin') return true;

    const where = { userId };
    if (projectId) where.projectId = projectId;

    const userRoles = await prisma.userRole.findMany({
      where,
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true }
            }
          }
        }
      }
    });

    const permissionKeys = new Set();

    for (const mapping of userRoles) {
      const role = mapping.role;
      if (!role) continue;

      // Admin role gets universal wildcard
      if (role.name === 'Admin' || role.roleName === 'Admin') {
        permissionKeys.add('*');
      }

      for (const rp of role.rolePermissions) {
        if (rp.permission && rp.permission.status === 'Active') {
          permissionKeys.add(rp.permission.permissionKey);
        }
      }
    }

    return Array.from(permissionKeys).some(permKey => {
      if (permKey === '*' || permKey === '*.*') return true;
      if (permKey === permissionKey) return true;
      if (permKey.endsWith('.*')) {
        const prefix = permKey.slice(0, -2);
        if (permissionKey.startsWith(prefix + '.')) return true;
      }
      return false;
    });
  } catch (err) {
    console.error('[userHasPermission] Error:', err);
    return false;
  }
};

/**
 * Dual-mode helper:
 *
 * Mode 1 — Route middleware factory (existing behaviour, unchanged):
 *   checkPermission('database', 'create')  →  returns Express middleware
 *
 * Mode 2 — Direct async permission evaluator:
 *   await checkPermission(userId, 'database.create')          → boolean
 *   await checkPermission(userId, 'database.create', projId)  → boolean
 *
 * Detection: if arg1 looks like a UUID (contains hyphens and length > 20),
 * it is treated as a userId and the call enters Mode 2.
 */
const checkPermission = (arg1, arg2, arg3 = null) => {
  // Mode 2: direct async check — checkPermission(userId, permissionKey, projectId?)
  if (typeof arg1 === 'string' && arg1.includes('-') && arg1.length > 20) {
    return userHasPermission(arg1, arg2, arg3);
  }
  // Mode 1: middleware factory — checkPermission(resource, action)
  return requirePermission(`${arg1}.${arg2}`);
};

module.exports = {
  checkPermission,
  requirePermission,
  userHasPermission
};
