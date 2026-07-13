const express = require('express');
const jwt = require('jsonwebtoken');
const projectController = require('./project.controller');
const projectConsoleController = require('./projectConsole.controller');
const schemaRoutes = require('./schema.routes');
const dataRoutes = require('./data.routes');
const authMiddleware = require('../../middlewares/auth.middleware');
const projectUserAuthMiddleware = require('../../middlewares/projectUserAuth.middleware');
const { validateCreateProject } = require('./project.validator');

const router = express.Router();

/**
 * Determines if the token is a Project User token or a Control Plane Developer token
 */
const isProjectToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.decode(token);
    return !!(decoded && (decoded.projectId || decoded.refId || decoded.sub) && !decoded.userId);
  } catch (err) {
    return false;
  }
};

/**
 * Dispatches request authentication depending on token type
 */
const dynamicDataAuth = (req, res, next) => {
  if (isProjectToken(req)) {
    return projectUserAuthMiddleware(req, res, next);
  }
  return authMiddleware(req, res, next);
};

const projectTenantMiddleware = require('../../middlewares/projectTenant.middleware');

// 1. Dynamic Data CRUD Endpoints (Must be registered before developer auth blocker)
router.use('/:projectId/data', projectTenantMiddleware, dynamicDataAuth, dataRoutes);

// 2. Control Plane auth gate for all other project config endpoints
router.use(authMiddleware);

const { checkPermission } = require('../../middlewares/rbac.middleware');

router.post('/', validateCreateProject, projectController.createProject);
router.get('/', projectController.getProjects);

router.get('/:id', projectTenantMiddleware, checkPermission('project', 'read'), projectController.getProject);
router.delete('/:id', projectTenantMiddleware, checkPermission('project', 'delete'), projectController.deleteProject);
router.post('/:id/retry', projectTenantMiddleware, checkPermission('project', 'write'), projectController.retryProvisioning);

// Schema Builder Endpoints
router.use('/:projectId/schema', projectTenantMiddleware, checkPermission('database', '*'), schemaRoutes);

// Console Management Endpoints (Project Inspection)
router.get('/:id/console/users', projectTenantMiddleware, checkPermission('users', 'read'), projectConsoleController.getUsers);
router.post('/:id/console/users/:userId/suspend', projectTenantMiddleware, checkPermission('users', 'write'), projectConsoleController.suspendUser);
router.post('/:id/console/users/:userId/reset-password', projectTenantMiddleware, checkPermission('users', 'write'), projectConsoleController.resetPassword);
router.delete('/:id/console/users/:userId', projectTenantMiddleware, checkPermission('users', 'write'), projectConsoleController.deleteUser);

router.get('/:id/console/sessions', projectTenantMiddleware, checkPermission('users', 'read'), projectConsoleController.getSessions);
router.delete('/:id/console/sessions/:sessionId', projectTenantMiddleware, checkPermission('users', 'write'), projectConsoleController.terminateSession);
router.delete('/:id/console/sessions/user/:userId', projectTenantMiddleware, checkPermission('users', 'write'), projectConsoleController.terminateAllSessions);

router.get('/:id/console/providers', projectTenantMiddleware, checkPermission('project', 'read'), projectConsoleController.getProviders);
router.post('/:id/console/providers', projectTenantMiddleware, checkPermission('project', 'write'), projectConsoleController.saveProvider);

router.get('/:id/console/email-templates', projectTenantMiddleware, checkPermission('project', 'read'), projectConsoleController.getEmailTemplates);
router.post('/:id/console/email-templates', projectTenantMiddleware, checkPermission('project', 'write'), projectConsoleController.saveEmailTemplate);

router.get('/:id/console/jwt-settings', projectTenantMiddleware, checkPermission('project', 'read'), projectConsoleController.getJwtSettings);
router.post('/:id/console/jwt-settings', projectTenantMiddleware, checkPermission('project', 'write'), projectConsoleController.saveJwtSettings);
router.post('/:id/console/jwt-settings/rotate', projectTenantMiddleware, checkPermission('project', 'write'), projectConsoleController.rotateJwtSecret);

router.get('/:id/console/audit-logs', projectTenantMiddleware, checkPermission('project', 'read'), projectConsoleController.getAuditLogs);

module.exports = router;
