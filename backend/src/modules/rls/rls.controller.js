const rlsService = require('./rls.service');
const { sendSuccess, sendError } = require('../../core/response');
const jwt = require('jsonwebtoken');

const resolveProjectId = (req) => {
  if (req.project && req.project.id) {
    return req.project.id;
  }
  if (req.user && req.user.projectId) {
    return req.user.projectId;
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.decode(token);
      if (decoded) {
        const pId = decoded.projectId || decoded.refId;
        if (pId) return pId;
      }
    } catch (e) {}
  }
  
  return req.body?.projectId || req.query?.projectId || req.body?.project || req.query?.project || null;
};

class RlsController {
  async createPolicy(req, res) {
    try {
      const projectId = resolveProjectId(req);
      if (!projectId) {
        return sendError(res, 'Project identification failed. Provide a valid projectId.', 'BAD_REQUEST', [], 400);
      }

      const { tableName, policyName, operation, role, condition, enabled } = req.body;
      if (!tableName || !policyName || !operation || !role || !condition) {
        return sendError(res, 'Missing required fields: tableName, policyName, operation, role, condition are required.', 'VALIDATION_ERROR', [], 400);
      }

      const createdBy = req.user ? (req.user.email || req.user.userId || req.user.sub) : null;

      const policy = await rlsService.createPolicy({
        projectId,
        tableName,
        policyName,
        operation,
        role,
        condition,
        enabled,
        createdBy
      });

      return sendSuccess(res, 'RLS policy created successfully', policy, null, 201);
    } catch (error) {
      return sendError(res, error.message || 'Failed to create RLS policy', 'INTERNAL_ERROR', [], 500);
    }
  }

  async listPolicies(req, res) {
    try {
      const projectId = resolveProjectId(req);
      if (!projectId) {
        return sendError(res, 'Project identification failed. Provide a valid projectId.', 'BAD_REQUEST', [], 400);
      }

      const policies = await rlsService.listPolicies(projectId);
      return sendSuccess(res, 'RLS policies retrieved successfully', policies);
    } catch (error) {
      return sendError(res, error.message || 'Failed to retrieve RLS policies', 'INTERNAL_ERROR', [], 500);
    }
  }

  async getPolicyDetails(req, res) {
    try {
      const { id } = req.params;
      const policy = await rlsService.getPolicyById(id);
      if (!policy) {
        return sendError(res, 'RLS policy not found', 'NOT_FOUND', [], 404);
      }
      return sendSuccess(res, 'RLS policy retrieved successfully', policy);
    } catch (error) {
      return sendError(res, error.message || 'Failed to retrieve RLS policy', 'INTERNAL_ERROR', [], 500);
    }
  }

  async updatePolicy(req, res) {
    try {
      const { id } = req.params;
      const { tableName, policyName, operation, role, condition, enabled } = req.body;

      const policy = await rlsService.updatePolicy(id, {
        tableName,
        policyName,
        operation,
        role,
        condition,
        enabled
      });

      return sendSuccess(res, 'RLS policy updated successfully', policy);
    } catch (error) {
      if (error.message.includes('not found')) {
        return sendError(res, error.message, 'NOT_FOUND', [], 404);
      }
      return sendError(res, error.message || 'Failed to update RLS policy', 'INTERNAL_ERROR', [], 500);
    }
  }

  async deletePolicy(req, res) {
    try {
      const { id } = req.params;
      await rlsService.deletePolicy(id);
      return sendSuccess(res, 'RLS policy deleted successfully');
    } catch (error) {
      if (error.message.includes('not found')) {
        return sendError(res, error.message, 'NOT_FOUND', [], 404);
      }
      return sendError(res, error.message || 'Failed to delete RLS policy', 'INTERNAL_ERROR', [], 500);
    }
  }
}

module.exports = new RlsController();
