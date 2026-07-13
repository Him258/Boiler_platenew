const prisma = require('../config/db');
const { sendError } = require('../core/response');

/**
 * Reusable middleware to enforce Role-Based Access Control (RBAC).
 * Enforces permissions isolated by projectId.
 * Supports wildcards (e.g., 'database.*' resource or '*' action).
 *
 * @param {string} resource - The target resource (e.g., 'database', 'storage', 'users', 'roles')
 * @param {string} action - The action to perform (e.g., 'read', 'write', 'delete', '*')
 */
const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      // 1. Ensure project context is present
      if (!req.project || !req.project.id) {
        return sendError(res, 'Project context is required for authorization.', 'FORBIDDEN', [], 403);
      }

      const projectId = req.project.id;
      let userRoleName = 'Guest';
      let userPermissions = [];

      // 2. Resolve user permissions based on user type
      if (req.user) {
        // CASE A: Control Plane User (Developer / Owner)
        // Has req.user.userId attached by control plane authMiddleware
        if (req.user.userId) {
          const userId = req.user.userId;
          const userRoleMapping = await prisma.userRole.findFirst({
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

          if (userRoleMapping && userRoleMapping.role) {
            userRoleName = userRoleMapping.role.name || userRoleMapping.role.roleName;
            userPermissions = userRoleMapping.role.rolePermissions.map(rp => rp.permission);
          }
        }
        // CASE B: Project Plane User
        // Has req.user.sub attached by projectUserAuthMiddleware
        else if (req.user.sub) {
          const roleName = req.user.role || 'authenticated';
          userRoleName = roleName;

          // Look up permissions associated with this project-isolated role name
          const role = await prisma.role.findFirst({
            where: {
              projectId,
              OR: [
                { name: roleName },
                { roleName: roleName }
              ]
            },
            include: {
              rolePermissions: {
                include: { permission: true }
              }
            }
          });

          if (role) {
            userPermissions = role.rolePermissions.map(rp => rp.permission);
          }
        }
      } 
      // CASE C: API Key Authentication (Fallback when no JWT is provided)
      else {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['apikey'] || req.query.apikey || (authHeader && !authHeader.startsWith('Bearer ') ? authHeader : null);

        if (apiKey) {
          const apiKeyRecord = await prisma.projectApiKey.findUnique({
            where: { keyToken: apiKey }
          });

          if (apiKeyRecord) {
            if (apiKeyRecord.keyType === 'service_role') {
              // service_role has full access bypass
              return next();
            } else if (apiKeyRecord.keyType === 'anon') {
              userRoleName = 'anon';
              // Check if project has custom permissions mapped for 'anon' role
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
                userPermissions = anonRole.rolePermissions.map(rp => rp.permission);
              }
            }
          }
        }
      }

      // 3. Evaluate if user's permissions match requested resource & action
      const hasPermission = userPermissions.some(perm => {
        const resourceMatch = perm.resource === resource || perm.resource === '*';
        const actionMatch = perm.action === action || perm.action === '*';
        return resourceMatch && actionMatch;
      });

      if (hasPermission) {
        return next();
      }

      console.warn(`[RBAC] Access Denied. Project: ${projectId}, Role: ${userRoleName}, Required: ${resource}.${action}`);
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions.'
        }
      });
    } catch (error) {
      console.error('[rbacMiddleware] Authorization check failed:', error);
      return sendError(res, 'An error occurred during permission authorization.', 'INTERNAL_ERROR', [], 500);
    }
  };
};

module.exports = {
  checkPermission
};
