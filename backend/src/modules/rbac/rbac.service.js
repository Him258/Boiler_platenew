const prisma = require('../../config/db');

/**
 * Service to manage Role-Based Access Control (RBAC) operations
 */
class RbacService {
  /**
   * Create a new role
   */
  async createRole({ projectId, name, description }) {
    return prisma.role.create({
      data: {
        projectId: projectId || null,
        name,
        roleName: name, // Populate both name and roleName for compatibility
        description,
        type: 'Custom',
        createdBy: 'System',
        status: 'Active'
      }
    });
  }

  /**
   * Get roles, isolated by projectId
   */
  async getRoles(projectId) {
    const where = {};
    if (projectId) {
      where.projectId = projectId;
    }
    return prisma.role.findMany({
      where,
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  /**
   * Get all permissions
   */
  async getPermissions() {
    return prisma.permission.findMany();
  }

  /**
   * Assign a permission to a role
   */
  async assignPermissionToRole(roleId, permissionId) {
    return prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId
        }
      },
      update: {},
      create: {
        roleId,
        permissionId
      },
      include: {
        permission: true
      }
    });
  }

  /**
   * Remove a permission from a role
   */
  async removePermissionFromRole(roleId, permissionId) {
    return prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId
        }
      }
    });
  }

  /**
   * Assign a role to a user
   */
  async assignUserRole({ userId, roleId, projectId }) {
    // If projectId is not supplied, try to fetch it from the Role model
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      const role = await prisma.role.findUnique({
        where: { id: roleId }
      });
      resolvedProjectId = role ? role.projectId : null;
    }

    if (!resolvedProjectId) {
      throw new Error('ProjectId is required to associate a role with a user.');
    }

    return prisma.userRole.upsert({
      where: {
        userId_roleId_projectId: {
          userId,
          roleId,
          projectId: resolvedProjectId
        }
      },
      update: {},
      create: {
        userId,
        roleId,
        projectId: resolvedProjectId
      },
      include: {
        role: true
      }
    });
  }

  /**
   * Get roles assigned to a user (optionally filtered by projectId)
   */
  async getUserRoles(userId, projectId) {
    const where = { userId };
    if (projectId) {
      where.projectId = projectId;
    }
    return prisma.userRole.findMany({
      where,
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
  }
}

module.exports = new RbacService();
