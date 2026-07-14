const express = require('express');
const storageController = require('./storage.controller');
const storageMiddleware = require('./storage.middleware');
const projectTenantMiddleware = require('../../middlewares/projectTenant.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const { checkPermission } = require('../../middlewares/rbac.middleware');
const jwt = require('jsonwebtoken');

const router = express.Router();

/**
 * Checks if the authentication token is a Project User token or Developer token
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
 * Dynamic authentication dispatcher. Verifies either dynamic Project User or Developer token.
 */
const dynamicDatabaseAuth = (req, res, next) => {
  if (isProjectToken(req)) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication token is missing or invalid' }
        });
      }
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, req.project.jwtSecret);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
      });
    }
  }
  return authMiddleware(req, res, next);
};

// All endpoints require apikey/tenant mapping and authentication
router.use(projectTenantMiddleware);
router.use(dynamicDatabaseAuth);

// --- Bucket Routes ---
router.post('/buckets', checkPermission('storage', 'create'), storageController.createBucket);
router.get('/buckets', checkPermission('storage', 'read'), storageController.listBuckets);
router.get('/buckets/:id', checkPermission('storage', 'read'), storageController.getBucket);
router.put('/buckets/:id', checkPermission('storage', 'update'), storageController.updateBucket);
router.delete('/buckets/:id', checkPermission('storage', 'delete'), storageController.deleteBucket);

// --- File Routes ---
router.post('/upload', checkPermission('storage', 'upload'), storageMiddleware.uploadSingle, storageController.uploadFile);
router.get('/files', checkPermission('storage', 'read'), storageController.listFiles);
router.get('/files/:id', checkPermission('storage', 'read'), storageController.getFile);
router.delete('/files/:id', checkPermission('storage', 'delete'), storageController.deleteFile);

module.exports = router;
