const express = require('express');
const jwt = require('jsonwebtoken');
const storageController = require('./storage.controller');
const storageMiddleware = require('./storage.middleware');
const projectTenantMiddleware = require('../../middlewares/projectTenant.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');

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

// 1. Unauthenticated storage downloads (still resolves project context using apikey)
router.get('/object/public/:bucketName/*path', projectTenantMiddleware, storageController.downloadPublicFile);
router.get('/object/signed/:bucketName/*path', projectTenantMiddleware, storageController.downloadSignedFile);

const { checkPermission } = require('../../middlewares/rbac.middleware');

// 2. Authenticated storage endpoints (requires apikey + dynamic jwt token)
router.use(projectTenantMiddleware);
router.use(dynamicDatabaseAuth);

// Bucket Operations
router.post('/bucket', checkPermission('storage', 'write'), storageController.createBucket);
router.get('/bucket', checkPermission('storage', 'read'), storageController.listBuckets);
router.delete('/bucket/:bucketName', checkPermission('storage', 'write'), storageController.deleteBucket);

// Object Bulk Operations
router.post('/object/move', checkPermission('storage', 'write'), storageController.moveFile);
router.post('/object/copy', checkPermission('storage', 'write'), storageController.copyFile);
router.get('/object/list/:bucketName', checkPermission('storage', 'read'), storageController.listFiles);
router.post('/object/sign/:bucketName/*path', checkPermission('storage', 'read'), storageController.generateSignedUrl);

// Standard File CRUD
router.post('/object/:bucketName/*path', checkPermission('storage', 'write'), storageMiddleware.uploadSingle, storageController.uploadFile);
router.get('/object/:bucketName/*path', checkPermission('storage', 'read'), storageController.downloadFile);
router.delete('/object/:bucketName/*path', checkPermission('storage', 'write'), storageController.deleteFile);

module.exports = router;
