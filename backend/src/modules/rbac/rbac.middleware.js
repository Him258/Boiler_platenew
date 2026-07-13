const prisma = require('../../config/db');

/**
 * Reusable RBAC authorization middleware
 * Evaluates permissions assigned to User roles for a specific project.
 * 
 * Supports wildcard matching:
 * - 'database.*' matches 'database.create', 'database.read', etc.
 * - '*' or '*.*' matches any permission.
 */
function requirePermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      // 1. JWT / Auth Verify
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User authentication context is required.'
        });
      }

      // 2. Project Verify
      const project = req.project;
      if (!project || !project.id) {
        return res.status(400).json({
          success: false,
          message: 'Project context is required for authorization.'
        });
      }

      // Service Role API Key bypasses RBAC checks entirely
      if (req.headers['apikey'] || req.query.apikey) {
        const apiKeyToken = req.headers['apikey'] || req.query.apikey;
        const projectKey = project.apiKeys?.find(k => k.keyToken === apiKeyToken);
        if (projectKey && projectKey.keyType === 'service_role') {
          return next();
        }
      }

      // Parse the required permission (e.g., 'database.create')
      const [reqResource, reqAction] = requiredPermission.split('.');

      let userPermissions = [];
      let userRoleName = 'unknown';

      // 3. Load User Roles & Permissions
      if (req.user.userId) {
        // CASE A: Control Plane Developer User
        const userId = req.user.userId;
        const userRoleMappings = await prisma.userRole.findMany({
          where: {
            userId,
            projectId: project.id
          },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        });

        userRoleName = userRoleMappings.map(urm => urm.role.name || urm.role.roleName).join(', ') || 'none';
        
        userPermissions = userRoleMappings.flatMap(urm => 
          urm.role.rolePermissions.map(rp => rp.permission)
        );
      } else if (req.user.sub) {
        // CASE B: Project Plane User (sub represents user ID, role represents role name like 'authenticated')
        const roleName = req.user.role || 'authenticated';
        userRoleName = roleName;

        const role = await prisma.role.findFirst({
          where: {
            projectId: project.id,
            OR: [
              { name: roleName },
              { roleName: roleName }
            ]
          },
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        });

        if (role) {
          userPermissions = role.rolePermissions.map(rp => rp.permission);
        }
      }

      // 4. Check Permission (including wildcard)
      const hasPermission = userPermissions.some(perm => {
        const pResource = perm.resource;
        const pAction = perm.action;

        // Perfect match
        if (pResource === reqResource && pAction === reqAction) {
          return true;
        }
        // Resource wildcard match (e.g., 'database.*' matches 'database.create')
        if (pResource === reqResource && pAction === '*') {
          return true;
        }
        // Universal wildcard match (e.g. '*' or '*.*')
        if (pResource === '*' && pAction === '*') {
          return true;
        }
        return false;
      });

      // 5. Allow / Deny
      if (hasPermission) {
        return next();
      }

      console.warn(`[RBAC] Access Denied. Project: ${project.id}, Role: ${userRoleName}, Required: ${requiredPermission}`);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    } catch (error) {
      console.error('[requirePermission] Authorization check failed:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during permission authorization.'
      });
    }
  };
}

module.exports = {
  requirePermission
};
