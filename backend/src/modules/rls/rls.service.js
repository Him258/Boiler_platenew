const prisma = require('../../config/db');
const crypto = require('crypto');

class RlsService {
  async createPolicy({ projectId, tableName, policyName, operation, role, condition, enabled = true, createdBy }) {
    const id = crypto.randomUUID();
    const isEnabled = enabled === true || enabled === 'true' || enabled === 1;

    await prisma.$executeRawUnsafe(
      'INSERT INTO `RlsPolicy` (`id`, `projectId`, `tableName`, `policyName`, `operation`, `role`, `condition`, `enabled`, `createdBy`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      projectId,
      tableName,
      policyName,
      operation,
      role,
      condition,
      isEnabled ? 1 : 0,
      createdBy || null,
      new Date(),
      new Date()
    );

    return this.getPolicyById(id);
  }

  async getPolicyById(id) {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM `RlsPolicy` WHERE `id` = ? LIMIT 1',
      id
    );
    if (!rows || rows.length === 0) return null;
    
    // Map database boolean/number to boolean
    const policy = rows[0];
    policy.enabled = policy.enabled === 1 || policy.enabled === true;
    return policy;
  }

  async listPolicies(projectId) {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM `RlsPolicy` WHERE `projectId` = ? ORDER BY `createdAt` DESC',
      projectId
    );
    return rows.map(r => {
      r.enabled = r.enabled === 1 || r.enabled === true;
      return r;
    });
  }

  async updatePolicy(id, { tableName, policyName, operation, role, condition, enabled }) {
    const existing = await this.getPolicyById(id);
    if (!existing) throw new Error('Policy not found');

    const updatedTableName = tableName !== undefined ? tableName : existing.tableName;
    const updatedPolicyName = policyName !== undefined ? policyName : existing.policyName;
    const updatedOperation = operation !== undefined ? operation : existing.operation;
    const updatedRole = role !== undefined ? role : existing.role;
    const updatedCondition = condition !== undefined ? condition : existing.condition;
    
    let updatedEnabled = existing.enabled;
    if (enabled !== undefined) {
      updatedEnabled = enabled === true || enabled === 'true' || enabled === 1;
    }

    await prisma.$executeRawUnsafe(
      'UPDATE `RlsPolicy` SET `tableName` = ?, `policyName` = ?, `operation` = ?, `role` = ?, `condition` = ?, `enabled` = ?, `updatedAt` = ? WHERE `id` = ?',
      updatedTableName,
      updatedPolicyName,
      updatedOperation,
      updatedRole,
      updatedCondition,
      updatedEnabled ? 1 : 0,
      new Date(),
      id
    );

    return this.getPolicyById(id);
  }

  async deletePolicy(id) {
    const existing = await this.getPolicyById(id);
    if (!existing) throw new Error('Policy not found');

    await prisma.$executeRawUnsafe(
      'DELETE FROM `RlsPolicy` WHERE `id` = ?',
      id
    );
    return existing;
  }
}

module.exports = new RlsService();
