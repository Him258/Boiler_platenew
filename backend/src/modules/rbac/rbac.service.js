const prisma = require('../../config/db');

/**
 * Service to manage Role-Based Access Control (RBAC) operations
 */
class RbacService {
  /**
   * Create a new role
   */
  async createRole({ projectId, name, description }) {
    const existing = await prisma.role.findFirst({
      where: {
        projectId: projectId || null,
        name: {
          equals: name
        }
      }
    });
    if (existing) {
      throw new Error(`Role name "${name}" already exists in the project.`);
    }

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
   * Create multiple roles transactionally, ensuring atomic rollback on failure
   */
  async createRolesBulk(projectId, rolesList) {
    return prisma.$transaction(async (tx) => {
      const existingRoles = await tx.role.findMany({
        where: {
          projectId: projectId || null
        }
      });
      const existingNames = new Set(existingRoles.map(r => r.name.toLowerCase()));

      const createdRoles = [];
      for (const roleData of rolesList) {
        const normalizedName = roleData.name.trim().toLowerCase();
        if (existingNames.has(normalizedName)) {
          throw new Error(`Role name "${roleData.name}" already exists in the project.`);
        }
        existingNames.add(normalizedName);

        const role = await tx.role.create({
          data: {
            projectId: projectId || null,
            name: roleData.name.trim(),
            roleName: roleData.name.trim(),
            description: roleData.description || null,
            type: 'Custom',
            createdBy: 'System',
            status: 'Active'
          }
        });
        createdRoles.push(role);
      }
      return createdRoles;
    }, {
      maxWait: 15000,
      timeout: 20000
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
   * Create a new permission with duplicates check
   */
  async createPermission({ projectId, permissionKey, displayName, description, category, status }) {
    const existing = await prisma.permission.findFirst({
      where: {
        projectId: projectId || null,
        permissionKey
      }
    });
    if (existing) {
      throw new Error(`Permission key "${permissionKey}" already exists in the project.`);
    }

    return prisma.permission.create({
      data: {
        projectId: projectId || null,
        permissionKey: permissionKey.trim(),
        displayName: displayName || null,
        description: description || null,
        category: category || null,
        status: status || 'Active'
      }
    });
  }

  /**
   * Create multiple permissions transactionally, ensuring atomic rollback on failure
   */
  async createPermissionsBulk(projectId, permissionsList) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.permission.findMany({
        where: {
          projectId: projectId || null
        }
      });
      const existingKeys = new Set(existing.map(p => p.permissionKey.toLowerCase()));

      const created = [];
      for (const pData of permissionsList) {
        const normalizedKey = pData.permissionKey.trim().toLowerCase();
        if (existingKeys.has(normalizedKey)) {
          throw new Error(`Permission key "${pData.permissionKey}" already exists in the project.`);
        }
        existingKeys.add(normalizedKey);

        const perm = await tx.permission.create({
          data: {
            projectId: projectId || null,
            permissionKey: pData.permissionKey.trim(),
            displayName: pData.displayName || null,
            description: pData.description || null,
            category: pData.category || null,
            status: pData.status || 'Active'
          }
        });
        created.push(perm);
      }
      return created;
    });
  }

  /**
   * Get all permissions (optionally isolated by projectId)
   */
  async getPermissions(projectId) {
    const where = {};
    if (projectId) {
      where.projectId = projectId;
    }
    return prisma.permission.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get single permission by id
   */
  async getPermissionById(id) {
    return prisma.permission.findUnique({
      where: { id }
    });
  }

  /**
   * Update a permission
   */
  async updatePermission(id, data) {
    const existing = await prisma.permission.findUnique({ where: { id } });
    if (!existing) throw new Error('Permission not found');

    return prisma.permission.update({
      where: { id },
      data: {
        permissionKey: data.permissionKey !== undefined ? data.permissionKey.trim() : undefined,
        displayName: data.displayName !== undefined ? data.displayName : undefined,
        description: data.description !== undefined ? data.description : undefined,
        category: data.category !== undefined ? data.category : undefined,
        status: data.status !== undefined ? data.status : undefined
      }
    });
  }

  /**
   * Delete a permission
   */
  async deletePermission(id) {
    const existing = await prisma.permission.findUnique({ where: { id } });
    if (!existing) throw new Error('Permission not found');

    return prisma.permission.delete({
      where: { id }
    });
  }

  /**
   * Assign permission(s) to a role
   */
  async assignPermissionsToRole(roleId, permissionIds) {
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id: roleId } });
      if (!role) throw new Error('Role not found');

      const perms = await tx.permission.findMany({
        where: { id: { in: permissionIds } }
      });
      if (perms.length !== permissionIds.length) {
        throw new Error('One or more permission IDs are invalid');
      }

      const existing = await tx.rolePermission.findMany({
        where: { roleId }
      });
      const existingPermIds = new Set(existing.map(rp => rp.permissionId));

      const toCreate = permissionIds.filter(id => !existingPermIds.has(id));

      if (toCreate.length > 0) {
        await tx.rolePermission.createMany({
          data: toCreate.map(id => ({
            roleId,
            permissionId: id
          }))
        });
      }

      return tx.rolePermission.findMany({
        where: { roleId },
        include: { permission: true }
      });
    });
  }

  /**
   * Legacy wrapper for assignPermissionToRole (single)
   */
  async assignPermissionToRole(roleId, permissionId) {
    const results = await this.assignPermissionsToRole(roleId, [permissionId]);
    return results.find(rp => rp.permissionId === permissionId);
  }

  /**
   * Get permissions associated with a role
   */
  async getRolePermissions(roleId) {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true }
    });
    return rolePermissions.map(rp => rp.permission);
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
   * Assign role(s) to a user in a project context
   */
  async assignUserRoles({ userId, roleIds, projectId }) {
    if (!projectId) {
      throw new Error('ProjectId is required to associate roles with a user.');
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      const roles = await tx.role.findMany({
        where: {
          id: { in: roleIds },
          OR: [
            { projectId },
            { projectId: null }
          ]
        }
      });
      if (roles.length !== roleIds.length) {
        throw new Error('One or more role IDs are invalid or not associated with this project');
      }

      const existing = await tx.userRole.findMany({
        where: { userId, projectId }
      });
      const existingRoleIds = new Set(existing.map(ur => ur.roleId));

      const toCreate = roleIds.filter(id => !existingRoleIds.has(id));

      if (toCreate.length > 0) {
        await tx.userRole.createMany({
          data: toCreate.map(id => ({
            userId,
            roleId: id,
            projectId
          }))
        });
      }

      return tx.userRole.findMany({
        where: { userId, projectId },
        include: { role: true }
      });
    });
  }

  /**
   * Legacy wrapper for assignUserRole (single)
   */
  async assignUserRole({ userId, roleId, projectId }) {
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      resolvedProjectId = role ? role.projectId : null;
    }
    const results = await this.assignUserRoles({ userId, roleIds: [roleId], projectId: resolvedProjectId });
    return results.find(ur => ur.roleId === roleId);
  }

  /**
   * Remove a role from a user in a project context
   */
  async removeUserRole(userId, roleId, projectId) {
    const where = { userId, roleId };
    if (projectId) {
      where.projectId = projectId;
    }
    const mapping = await prisma.userRole.findFirst({ where });
    if (!mapping) throw new Error('User role mapping not found');

    return prisma.userRole.delete({
      where: { id: mapping.id }
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
