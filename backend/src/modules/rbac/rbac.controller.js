const rbacService = require('./rbac.service');
const { sendSuccess, sendError } = require('../../core/response');

class RbacController {
  async getRoles(req, res) {
    try {
      const projectId = req.query.projectId || req.query.project || (req.project ? req.project.id : null);
      const roles = await rbacService.getRoles(projectId);
      return sendSuccess(res, 'Roles retrieved successfully', roles);
    } catch (error) {
      return sendError(res, error.message || 'Failed to retrieve roles', 'INTERNAL_ERROR', [], 500);
    }
  }

  async createRole(req, res) {
    try {
      const body = req.body;
      const projectId = req.query.projectId || (req.project ? req.project.id : null);

      // Handle Bulk Creation
      if (Array.isArray(body)) {
        if (body.length === 0) {
          return sendError(res, 'Roles array cannot be empty', 'VALIDATION_ERROR', [], 400);
        }

        const namesSeen = new Set();
        for (const roleData of body) {
          if (!roleData || typeof roleData !== 'object') {
            return sendError(res, 'Invalid role payload structure', 'VALIDATION_ERROR', [], 400);
          }
          if (!roleData.name || typeof roleData.name !== 'string' || !roleData.name.trim()) {
            return sendError(res, 'Role name is required', 'VALIDATION_ERROR', [], 400);
          }
          
          const normalizedName = roleData.name.trim().toLowerCase();
          if (namesSeen.has(normalizedName)) {
            return sendError(res, `Duplicate role name "${roleData.name}" detected in the request`, 'VALIDATION_ERROR', [], 400);
          }
          namesSeen.add(normalizedName);
        }

        const createdRoles = await rbacService.createRolesBulk(projectId, body);
        return sendSuccess(res, 'Roles created successfully', {
          roles: createdRoles,
          count: createdRoles.length
        }, null, 201);
      } 
      
      // Handle Single Creation
      else if (body && typeof body === 'object') {
        const { name, description } = body;
        const resolvedProjectId = body.projectId || projectId;

        if (!name || typeof name !== 'string' || !name.trim()) {
          return sendError(res, 'Role name is required', 'VALIDATION_ERROR', [], 400);
        }

        const role = await rbacService.createRole({ projectId: resolvedProjectId, name: name.trim(), description });
        return sendSuccess(res, 'Role created successfully', role, null, 201);
      } 
      
      else {
        return sendError(res, 'Invalid request payload', 'VALIDATION_ERROR', [], 400);
      }
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
      }
      return sendError(res, error.message || 'Failed to create role', 'INTERNAL_ERROR', [], 500);
    }
  }

  async getPermissions(req, res) {
    try {
      const projectId = req.query.projectId || (req.project ? req.project.id : null);
      const permissions = await rbacService.getPermissions(projectId);
      return sendSuccess(res, 'Permissions retrieved successfully', permissions);
    } catch (error) {
      return sendError(res, error.message || 'Failed to retrieve permissions', 'INTERNAL_ERROR', [], 500);
    }
  }

  async getPermissionById(req, res) {
    try {
      const { id } = req.params;
      const permission = await rbacService.getPermissionById(id);
      if (!permission) {
        return sendError(res, 'Permission not found', 'NOT_FOUND', [], 404);
      }
      return sendSuccess(res, 'Permission retrieved successfully', permission);
    } catch (error) {
      return sendError(res, error.message || 'Failed to retrieve permission', 'INTERNAL_ERROR', [], 500);
    }
  }

  async createPermission(req, res) {
    try {
      const body = req.body;
      const projectId = req.query.projectId || (req.project ? req.project.id : null);

      // Handle Bulk Creation
      if (Array.isArray(body)) {
        if (body.length === 0) {
          return sendError(res, 'Permissions array cannot be empty', 'VALIDATION_ERROR', [], 400);
        }

        const keysSeen = new Set();
        for (const pData of body) {
          if (!pData || typeof pData !== 'object') {
            return sendError(res, 'Invalid permission payload structure', 'VALIDATION_ERROR', [], 400);
          }
          if (!pData.permissionKey || typeof pData.permissionKey !== 'string' || !pData.permissionKey.trim()) {
            return sendError(res, 'Permission key is required', 'VALIDATION_ERROR', [], 400);
          }

          const normalizedKey = pData.permissionKey.trim().toLowerCase();
          if (keysSeen.has(normalizedKey)) {
            return sendError(res, `Duplicate permission key "${pData.permissionKey}" detected in the request`, 'VALIDATION_ERROR', [], 400);
          }
          keysSeen.add(normalizedKey);
        }

        const createdPermissions = await rbacService.createPermissionsBulk(projectId, body);
        return sendSuccess(res, 'Permissions created successfully', {
          permissions: createdPermissions,
          count: createdPermissions.length
        }, null, 201);
      }

      // Handle Single Creation
      else if (body && typeof body === 'object') {
        const { permissionKey, displayName, description, category, status } = body;
        const resolvedProjectId = body.projectId || projectId;

        if (!permissionKey || typeof permissionKey !== 'string' || !permissionKey.trim()) {
          return sendError(res, 'Permission key is required', 'VALIDATION_ERROR', [], 400);
        }

        const perm = await rbacService.createPermission({
          projectId: resolvedProjectId,
          permissionKey: permissionKey.trim(),
          displayName,
          description,
          category,
          status
        });
        return sendSuccess(res, 'Permission created successfully', perm, null, 201);
      }

      else {
        return sendError(res, 'Invalid request payload', 'VALIDATION_ERROR', [], 400);
      }
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
      }
      return sendError(res, error.message || 'Failed to create permission', 'INTERNAL_ERROR', [], 500);
    }
  }

  async updatePermission(req, res) {
    try {
      const { id } = req.params;
      const perm = await rbacService.updatePermission(id, req.body);
      return sendSuccess(res, 'Permission updated successfully', perm);
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        return sendError(res, error.message, 'NOT_FOUND', [], 404);
      }
      return sendError(res, error.message || 'Failed to update permission', 'INTERNAL_ERROR', [], 500);
    }
  }

  async deletePermission(req, res) {
    try {
      const { id } = req.params;
      await rbacService.deletePermission(id);
      return sendSuccess(res, 'Permission deleted successfully');
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        return sendError(res, error.message, 'NOT_FOUND', [], 404);
      }
      return sendError(res, error.message || 'Failed to delete permission', 'INTERNAL_ERROR', [], 500);
    }
  }

  async assignPermissionToRole(req, res) {
    try {
      const { id } = req.params; // Role ID
      
      let permissionIds = [];
      if (Array.isArray(req.body)) {
        permissionIds = req.body.map(item => typeof item === 'object' ? (item.permissionId || item.id) : item).filter(Boolean);
      } else if (req.body && typeof req.body === 'object') {
        if (Array.isArray(req.body.permissionIds)) {
          permissionIds = req.body.permissionIds;
        } else if (req.body.permissionId) {
          permissionIds = [req.body.permissionId];
        }
      }

      if (permissionIds.length === 0) {
        return sendError(res, 'Permission ID(s) are required', 'VALIDATION_ERROR', [], 400);
      }

      const association = await rbacService.assignPermissionsToRole(id, permissionIds);
      return sendSuccess(res, 'Permission(s) assigned to role successfully', {
        roleId: id,
        count: association.length
      }, null, 201);
    } catch (error) {
      return sendError(res, error.message || 'Failed to assign permission to role', 'INTERNAL_ERROR', [], 500);
    }
  }

  async getRolePermissions(req, res) {
    try {
      const { id } = req.params; // Role ID
      const permissions = await rbacService.getRolePermissions(id);
      return sendSuccess(res, 'Role permissions retrieved successfully', permissions);
    } catch (error) {
      return sendError(res, error.message || 'Failed to retrieve role permissions', 'INTERNAL_ERROR', [], 500);
    }
  }

  async removePermissionFromRole(req, res) {
    try {
      const { id, permissionId } = req.params;
      await rbacService.removePermissionFromRole(id, permissionId);
      return sendSuccess(res, 'Permission removed from role successfully');
    } catch (error) {
      return sendError(res, error.message || 'Failed to remove permission from role', 'INTERNAL_ERROR', [], 500);
    }
  }

  async assignUserRole(req, res) {
    try {
      const { userId } = req.params;
      const projectId = req.body.projectId || req.query.projectId || (req.project ? req.project.id : null);

      let roleIds = [];
      if (Array.isArray(req.body)) {
        roleIds = req.body.map(item => typeof item === 'object' ? (item.roleId || item.id) : item).filter(Boolean);
      } else if (req.body && typeof req.body === 'object') {
        if (Array.isArray(req.body.roleIds)) {
          roleIds = req.body.roleIds;
        } else if (req.body.roleId) {
          roleIds = [req.body.roleId];
        }
      }

      if (roleIds.length === 0) {
        return sendError(res, 'Role ID(s) are required', 'VALIDATION_ERROR', [], 400);
      }

      const association = await rbacService.assignUserRoles({ userId, roleIds, projectId });
      return sendSuccess(res, 'Role(s) assigned to user successfully', association, null, 201);
    } catch (error) {
      return sendError(res, error.message || 'Failed to assign role to user', 'INTERNAL_ERROR', [], 500);
    }
  }

  async removeUserRole(req, res) {
    try {
      const { userId, roleId } = req.params;
      const projectId = req.query.projectId || (req.project ? req.project.id : null);
      await rbacService.removeUserRole(userId, roleId, projectId);
      return sendSuccess(res, 'Role removed from user successfully');
    } catch (error) {
      return sendError(res, error.message || 'Failed to remove role from user', 'INTERNAL_ERROR', [], 500);
    }
  }

  async getUserRoles(req, res) {
    try {
      const { userId } = req.params;
      const projectId = req.query.projectId || req.query.project || (req.project ? req.project.id : null);
      const userRoles = await rbacService.getUserRoles(userId, projectId);
      return sendSuccess(res, 'User roles retrieved successfully', userRoles);
    } catch (error) {
      return sendError(res, error.message || 'Failed to retrieve user roles', 'INTERNAL_ERROR', [], 500);
    }
  }
}

module.exports = new RbacController();
