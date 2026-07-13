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
      const { name, description } = req.body;
      const projectId = req.body.projectId || (req.project ? req.project.id : null);
      if (!name) {
        return sendError(res, 'Role name is required', 'VALIDATION_ERROR', [], 400);
      }
      const role = await rbacService.createRole({ projectId, name, description });
      return sendSuccess(res, 'Role created successfully', role, null, 201);
    } catch (error) {
      return sendError(res, error.message || 'Failed to create role', 'INTERNAL_ERROR', [], 500);
    }
  }

  async getPermissions(req, res) {
    try {
      const permissions = await rbacService.getPermissions();
      return sendSuccess(res, 'Permissions retrieved successfully', permissions);
    } catch (error) {
      return sendError(res, error.message || 'Failed to retrieve permissions', 'INTERNAL_ERROR', [], 500);
    }
  }

  async assignPermissionToRole(req, res) {
    try {
      const { id } = req.params; // Role ID
      const { permissionId } = req.body;
      if (!permissionId) {
        return sendError(res, 'Permission ID is required', 'VALIDATION_ERROR', [], 400);
      }
      const association = await rbacService.assignPermissionToRole(id, permissionId);
      return sendSuccess(res, 'Permission assigned to role successfully', association, null, 201);
    } catch (error) {
      return sendError(res, error.message || 'Failed to assign permission to role', 'INTERNAL_ERROR', [], 500);
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
      const { roleId } = req.body;
      const projectId = req.body.projectId || (req.project ? req.project.id : null);
      if (!roleId) {
        return sendError(res, 'Role ID is required', 'VALIDATION_ERROR', [], 400);
      }
      const association = await rbacService.assignUserRole({ userId, roleId, projectId });
      return sendSuccess(res, 'Role assigned to user successfully', association, null, 201);
    } catch (error) {
      return sendError(res, error.message || 'Failed to assign role to user', 'INTERNAL_ERROR', [], 500);
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
