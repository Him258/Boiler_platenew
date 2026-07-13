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

// 1. Dynamic Data CRUD Endpoints (Must be registered before developer auth blocker)
router.use('/:projectId/data', dynamicDataAuth, dataRoutes);

// 2. Control Plane auth gate for all other project config endpoints
router.use(authMiddleware);

router.post('/', validateCreateProject, projectController.createProject);
router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProject);
router.delete('/:id', projectController.deleteProject);
router.post('/:id/retry', projectController.retryProvisioning);

// Schema Builder Endpoints
router.use('/:projectId/schema', schemaRoutes);

// Console Management Endpoints (Project Inspection)
router.get('/:id/console/users', projectConsoleController.getUsers);
router.post('/:id/console/users/:userId/suspend', projectConsoleController.suspendUser);
router.post('/:id/console/users/:userId/reset-password', projectConsoleController.resetPassword);
router.delete('/:id/console/users/:userId', projectConsoleController.deleteUser);

router.get('/:id/console/sessions', projectConsoleController.getSessions);
router.delete('/:id/console/sessions/:sessionId', projectConsoleController.terminateSession);
router.delete('/:id/console/sessions/user/:userId', projectConsoleController.terminateAllSessions);

router.get('/:id/console/providers', projectConsoleController.getProviders);
router.post('/:id/console/providers', projectConsoleController.saveProvider);

router.get('/:id/console/email-templates', projectConsoleController.getEmailTemplates);
router.post('/:id/console/email-templates', projectConsoleController.saveEmailTemplate);

router.get('/:id/console/jwt-settings', projectConsoleController.getJwtSettings);
router.post('/:id/console/jwt-settings', projectConsoleController.saveJwtSettings);
router.post('/:id/console/jwt-settings/rotate', projectConsoleController.rotateJwtSecret);

router.get('/:id/console/audit-logs', projectConsoleController.getAuditLogs);

module.exports = router;
