const prisma = require('../../config/db');
const schemaService = require('./schema.service');
const { sendSuccess, sendError } = require('../../core/response');

/**
 * Helper to fetch raw project row and authorize developer access
 */
const getAuthorizedProject = async (projectId, tenantId) => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT * FROM `Project` WHERE `id` = ? LIMIT 1',
    projectId
  );
  if (!rows || rows.length === 0) return null;
  const project = rows[0];
  if (project.tenantId !== tenantId) return null;
  return project;
};

exports.createTable = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log("req.body:", req.body);
    const tableName = req.body.tableName || req.body.name;
    const { columns } = req.body;

    if (!tableName) {
      return sendError(res, 'Table name is required', 'VALIDATION_ERROR', [], 400);
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return sendError(res, 'Columns array is required and must not be empty', 'VALIDATION_ERROR', [], 400);
    }

    // Load raw project and check authorization
    const project = await getAuthorizedProject(projectId, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    await schemaService.createTable(project, tableName, columns);

    return sendSuccess(res, 'Table created successfully', null, null, 201);
  } catch (error) {
    console.error('[SchemaController.createTable] Error:', error);
    
    if (error.message.includes('Invalid database identifier') || 
        error.message.includes('reserved system field') ||
        error.message.includes('Unsupported database type')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }
    
    return sendError(res, error.message || 'Failed to create table', 'INTERNAL_ERROR', [], 500);
  }
};

exports.listTables = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Load raw project and check authorization
    const project = await getAuthorizedProject(projectId, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    const tables = await schemaService.listTables(project);

    return sendSuccess(res, 'Tables retrieved successfully', tables);
  } catch (error) {
    console.error('[SchemaController.listTables] Error:', error);
    return sendError(res, error.message || 'Failed to list tables', 'INTERNAL_ERROR', [], 500);
  }
};

exports.describeTable = async (req, res) => {
  try {
    const { projectId, tableName } = req.params;

    if (!tableName) {
      return sendError(res, 'Table name is required', 'VALIDATION_ERROR', [], 400);
    }

    // Load raw project and check authorization
    const project = await getAuthorizedProject(projectId, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    const structure = await schemaService.describeTable(project, tableName);

    return sendSuccess(res, 'Table structure retrieved successfully', structure);
  } catch (error) {
    console.error('[SchemaController.describeTable] Error:', error);

    if (error.message.includes('does not exist')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }

    return sendError(res, error.message || 'Failed to describe table', 'INTERNAL_ERROR', [], 500);
  }
};

exports.dropTable = async (req, res) => {
  try {
    const { projectId, tableName } = req.params;

    if (!tableName) {
      return sendError(res, 'Table name is required', 'VALIDATION_ERROR', [], 400);
    }

    // Load raw project and check authorization
    const project = await getAuthorizedProject(projectId, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    await schemaService.dropTable(project, tableName);

    return sendSuccess(res, 'Table dropped successfully');
  } catch (error) {
    console.error('[SchemaController.dropTable] Error:', error);
    
    if (error.message.includes('Invalid database identifier')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }

    return sendError(res, error.message || 'Failed to drop table', 'INTERNAL_ERROR', [], 500);
  }
};

/**
 * Helper to log developer actions in the control plane database
 */
const logDeveloperAudit = async (tenantId, action, actor, resource, ipAddress) => {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        action,
        actor,
        resource,
        ipAddress,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[SchemaController:logDeveloperAudit] Failed to log developer action:', err);
  }
};

exports.listColumns = async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, tableName } = req.params;

    if (!tableName) {
      return sendError(res, 'Table name is required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getAuthorizedProject(projectId, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    const columns = await schemaService.listColumns(project, tableName);
    
    console.log(`[SchemaController.listColumns] Completed in ${Date.now() - startTime}ms`);
    return sendSuccess(res, 'Columns retrieved successfully', columns);
  } catch (error) {
    console.error('[SchemaController.listColumns] Error:', error);
    
    if (error.message.includes('does not exist') || error.message.includes('restricted')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    
    return sendError(res, error.message || 'Failed to retrieve columns', 'INTERNAL_ERROR', [], 500);
  }
};

exports.addColumn = async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, tableName } = req.params;
    const { name, type, options } = req.body;

    if (!tableName) {
      return sendError(res, 'Table name is required', 'VALIDATION_ERROR', [], 400);
    }

    if (!name || !type) {
      return sendError(res, 'Column name and type are required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getAuthorizedProject(projectId, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    await schemaService.addColumn(project, tableName, { name, type, options });

    // Log Developer Action to Audit Log
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logDeveloperAudit(
      req.user.tenantId,
      'COLUMN_CREATE',
      req.user.email || req.user.userId,
      `Project: ${projectId}, Table: ${tableName}, Column: ${name}`,
      ipAddress
    );

    console.log(`[SchemaController.addColumn] Completed in ${Date.now() - startTime}ms`);
    return sendSuccess(res, 'Column added successfully', null, null, 201);
  } catch (error) {
    console.error('[SchemaController.addColumn] Error:', error);

    if (error.message.includes('Invalid database identifier') ||
        error.message.includes('already exists') ||
        error.message.includes('Unsupported data type')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }

    return sendError(res, error.message || 'Failed to add column', 'INTERNAL_ERROR', [], 500);
  }
};

exports.updateColumn = async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, tableName, columnName } = req.params;
    const { name, type, options } = req.body;

    if (!tableName || !columnName) {
      return sendError(res, 'Table name and column name are required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getAuthorizedProject(projectId, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    await schemaService.updateColumn(project, tableName, columnName, { name, type, options });

    // Log Developer Action to Audit Log
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logDeveloperAudit(
      req.user.tenantId,
      'COLUMN_UPDATE',
      req.user.email || req.user.userId,
      `Project: ${projectId}, Table: ${tableName}, Column: ${columnName} -> ${name || columnName}`,
      ipAddress
    );

    console.log(`[SchemaController.updateColumn] Completed in ${Date.now() - startTime}ms`);
    return sendSuccess(res, 'Column updated successfully');
  } catch (error) {
    console.error('[SchemaController.updateColumn] Error:', error);

    if (error.message.includes('Invalid database identifier') ||
        error.message.includes('does not exist') ||
        error.message.includes('already exists') ||
        error.message.includes('Cannot modify') ||
        error.message.includes('referenced in a foreign key') ||
        error.message.includes('Unsupported data type')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }

    return sendError(res, error.message || 'Failed to update column', 'INTERNAL_ERROR', [], 500);
  }
};

exports.dropColumn = async (req, res) => {
  const startTime = Date.now();
  try {
    const { projectId, tableName, columnName } = req.params;

    if (!tableName || !columnName) {
      return sendError(res, 'Table name and column name are required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getAuthorizedProject(projectId, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Access denied or project not found', 'FORBIDDEN', [], 403);
    }

    await schemaService.dropColumn(project, tableName, columnName);

    // Log Developer Action to Audit Log
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logDeveloperAudit(
      req.user.tenantId,
      'COLUMN_DELETE',
      req.user.email || req.user.userId,
      `Project: ${projectId}, Table: ${tableName}, Column: ${columnName}`,
      ipAddress
    );

    console.log(`[SchemaController.dropColumn] Completed in ${Date.now() - startTime}ms`);
    return sendSuccess(res, 'Column dropped successfully');
  } catch (error) {
    console.error('[SchemaController.dropColumn] Error:', error);

    if (error.message.includes('Invalid database identifier') ||
        error.message.includes('does not exist') ||
        error.message.includes('Cannot drop') ||
        error.message.includes('referenced in a foreign key')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }

    return sendError(res, error.message || 'Failed to drop column', 'INTERNAL_ERROR', [], 500);
  }
};

