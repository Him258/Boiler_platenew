const express = require('express');
const rbacController = require('./rbac.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

const { requirePermission } = require('./rbac.middleware');
const projectTenantMiddleware = require('../../middlewares/projectTenant.middleware');

const projectUserAuthMiddleware = require('../../middlewares/projectUserAuth.middleware');
const jwt = require('jsonwebtoken');

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

const dynamicRbacAuth = (req, res, next) => {
  console.log('[dynamicRbacAuth] Attempting authorization check. Headers:', req.headers);
  const isProj = isProjectToken(req);
  console.log('[dynamicRbacAuth] isProjectToken =', isProj);
  if (isProj) {
    return projectUserAuthMiddleware(req, res, next);
  }
  return authMiddleware(req, res, next);
};

// Apply Dynamic Authentication to all RBAC routes
router.use(dynamicRbacAuth);

// Endpoint for testing requirePermission middleware
router.get('/test-permission', projectTenantMiddleware, requirePermission('database.create'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authorized successfully'
  });
});

router.get('/roles', rbacController.getRoles);
router.post('/roles', rbacController.createRole);
router.get('/permissions', rbacController.getPermissions);
router.post('/roles/:id/permissions', rbacController.assignPermissionToRole);
router.delete('/roles/:id/permissions/:permissionId', rbacController.removePermissionFromRole);

router.post('/users/:userId/roles', rbacController.assignUserRole);
router.get('/users/:userId/roles', rbacController.getUserRoles);

module.exports = router;
