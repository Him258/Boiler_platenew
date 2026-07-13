const express = require('express');
const rbacController = require('./rbac.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

const { requirePermission } = require('./rbac.middleware');
const projectTenantMiddleware = require('../../middlewares/projectTenant.middleware');

const projectUserAuthMiddleware = require('../../middlewares/projectUserAuth.middleware');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const encryptionService = require('../../core/services/encryption.service');

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
  const isProj = isProjectToken(req);
  if (isProj) {
    return projectUserAuthMiddleware(req, res, next);
  }
  return authMiddleware(req, res, next);
};

const resolveRbacProject = async (req, res, next) => {
  if (req.project) {
    return next();
  }
  try {
    const projectRef = req.headers['x-project-ref'] || req.headers['x-project-id'] || req.query.projectId || (req.body ? req.body.projectId : null);
    let lookup = null;

    if (projectRef) {
      lookup = projectRef;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.decode(token);
          if (decoded) {
            lookup = decoded.projectId || decoded.refId;
          }
        } catch (e) {}
      }
    }

    if (lookup) {
      const project = await prisma.project.findFirst({
        where: {
          OR: [
            { id: lookup },
            { refId: lookup }
          ]
        }
      });
      if (project) {
        try {
          project.jwtSecret = encryptionService.decrypt(project.jwtSecretEncrypted);
        } catch (e) {}
        req.project = project;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Apply Project Context Resolution and Dynamic Authentication to all RBAC routes
router.use(resolveRbacProject);
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
router.post('/permissions', rbacController.createPermission);
router.get('/permissions/:id', rbacController.getPermissionById);
router.patch('/permissions/:id', rbacController.updatePermission);
router.delete('/permissions/:id', rbacController.deletePermission);

router.post('/roles/:id/permissions', rbacController.assignPermissionToRole);
router.get('/roles/:id/permissions', rbacController.getRolePermissions);
router.delete('/roles/:id/permissions/:permissionId', rbacController.removePermissionFromRole);

router.post('/users/:userId/roles', rbacController.assignUserRole);
router.get('/users/:userId/roles', rbacController.getUserRoles);
router.delete('/users/:userId/roles/:roleId', rbacController.removeUserRole);

module.exports = router;
