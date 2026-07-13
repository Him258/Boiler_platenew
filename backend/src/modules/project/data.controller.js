const prisma = require('../../config/db');
const dataService = require('./data.service');
const { sendSuccess, sendError } = require('../../core/response');

/**
 * Resolves authorized project context based on developer tenancy or project user claims
 */
const getProjectContext = async (req, projectId) => {
  // 1. If project context is already attached by projectTenantMiddleware (for project user paths)
  if (req.project && (req.project.id === projectId || req.project.refId === projectId)) {
    return req.project;
  }

  // 2. Fallback to Developer Tenant validation (for console plane admin paths)
  if (req.user && req.user.tenantId) {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM `Project` WHERE `id` = ? OR `refId` = ? LIMIT 1',
      projectId,
      projectId
    );
    if (rows && rows.length > 0) {
      const projectObj = rows[0];
      if (projectObj.tenantId === req.user.tenantId) {
        const { getClientForProject } = require('./projectConnection');
        const encryptionService = require('../../core/services/encryption.service');
        const jwtSecret = encryptionService.decrypt(projectObj.jwtSecretEncrypted);
        return {
          id: projectObj.id,
          refId: projectObj.refId,
          name: projectObj.name,
          tenantId: projectObj.tenantId,
          jwtSecret,
          client: getClientForProject(projectObj),
          dbHost: projectObj.dbHost,
          dbPort: projectObj.dbPort,
          dbName: projectObj.dbName,
          dbUsername: projectObj.dbUsername
        };
      }
    }
  }

  return null;
};

/**
 * Helper to write a developer/client audit log entry
 */
const logDeveloperAudit = async (tenantId, action, actor, resource, ipAddress) => {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: tenantId || null,
        action,
        actor,
        resource,
        ipAddress,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[DataController:logDeveloperAudit] Failed to log developer action:', err);
  }
};

exports.insertRecord = async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, tableName } = req.params;

    if (!tableName) {
      return sendError(res, 'Table name is required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getProjectContext(req, projectId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    const record = await dataService.insertRecord(project, tableName, req.body);

    // Audit Logging
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const actor = req.user ? (req.user.email || req.user.userId || req.user.sub) : 'Client User';
    await logDeveloperAudit(
      project.tenantId,
      'INSERT',
      actor,
      `Project: ${projectId}, Table: ${tableName}, Record ID: ${record.id}`,
      ipAddress
    );

    console.log(`[DataController.insertRecord] Completed in ${Date.now() - startTime}ms`);
    return sendSuccess(res, 'Record inserted successfully', record, null, 201);
  } catch (error) {
    console.error('[DataController.insertRecord] Error:', error);

    if (error.message.includes('Invalid database identifier') ||
        error.message.includes('does not exist') ||
        error.message.includes('restricted')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }

    return sendError(res, error.message || 'Failed to insert record', 'INTERNAL_ERROR', [], 500);
  }
};

exports.getRecord = async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, tableName, id } = req.params;

    if (!tableName || !id) {
      return sendError(res, 'Table name and record ID are required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getProjectContext(req, projectId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    const record = await dataService.getRecord(project, tableName, id);

    console.log(`[DataController.getRecord] Completed in ${Date.now() - startTime}ms`);
    return sendSuccess(res, 'Record retrieved successfully', record);
  } catch (error) {
    console.error('[DataController.getRecord] Error:', error);

    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }

    if (error.message.includes('Invalid database identifier') ||
        error.message.includes('restricted')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }

    return sendError(res, error.message || 'Failed to retrieve record', 'INTERNAL_ERROR', [], 500);
  }
};

exports.updateRecord = async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, tableName, id } = req.params;

    if (!tableName || !id) {
      return sendError(res, 'Table name and record ID are required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getProjectContext(req, projectId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    const record = await dataService.updateRecord(project, tableName, id, req.body);

    // Audit Logging
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const actor = req.user ? (req.user.email || req.user.userId || req.user.sub) : 'Client User';
    await logDeveloperAudit(
      project.tenantId,
      'UPDATE',
      actor,
      `Project: ${projectId}, Table: ${tableName}, Record ID: ${id}`,
      ipAddress
    );

    console.log(`[DataController.updateRecord] Completed in ${Date.now() - startTime}ms`);
    return sendSuccess(res, 'Record updated successfully', record);
  } catch (error) {
    console.error('[DataController.updateRecord] Error:', error);

    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }

    if (error.message.includes('Invalid database identifier') ||
        error.message.includes('does not exist') ||
        error.message.includes('restricted')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }

    return sendError(res, error.message || 'Failed to update record', 'INTERNAL_ERROR', [], 500);
  }
};

exports.deleteRecord = async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, tableName, id } = req.params;

    if (!tableName || !id) {
      return sendError(res, 'Table name and record ID are required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getProjectContext(req, projectId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    const record = await dataService.deleteRecord(project, tableName, id);

    // Audit Logging
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const actor = req.user ? (req.user.email || req.user.userId || req.user.sub) : 'Client User';
    await logDeveloperAudit(
      project.tenantId,
      'DELETE',
      actor,
      `Project: ${projectId}, Table: ${tableName}, Record ID: ${id}`,
      ipAddress
    );

    console.log(`[DataController.deleteRecord] Completed in ${Date.now() - startTime}ms`);
    return sendSuccess(res, 'Record deleted successfully', record);
  } catch (error) {
    console.error('[DataController.deleteRecord] Error:', error);

    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }

    if (error.message.includes('Invalid database identifier') ||
        error.message.includes('restricted')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }

    return sendError(res, error.message || 'Failed to delete record', 'INTERNAL_ERROR', [], 500);
  }
};

exports.listRecords = async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, tableName } = req.params;
    const { page, limit, offset, sort, order, search, select, count } = req.query;

    if (!tableName) {
      return sendError(res, 'Table name is required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getProjectContext(req, projectId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    // Extract dynamic filters (any query parameters not reserved)
    const reservedKeys = ['page', 'limit', 'offset', 'sort', 'order', 'search', 'select', 'count'];
    const filters = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (!reservedKeys.includes(key)) {
        filters[key] = value;
      }
    }

    const result = await dataService.listRecords(project, tableName, {
      page,
      limit,
      offset,
      sort,
      order,
      search,
      select,
      count,
      filters
    });

    console.log(`[DataController.listRecords] Completed in ${Date.now() - startTime}ms`);
    
    // If total count is requested, return count in metadata
    const meta = result.total !== null ? { total: result.total } : null;
    return sendSuccess(res, 'Records retrieved successfully', result.records, meta);
  } catch (error) {
    console.error('[DataController.listRecords] Error:', error);

    if (error.message.includes('Invalid database identifier') ||
        error.message.includes('does not exist') ||
        error.message.includes('restricted')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }

    return sendError(res, error.message || 'Failed to list records', 'INTERNAL_ERROR', [], 500);
  }
};
