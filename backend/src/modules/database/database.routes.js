const express = require('express');
const jwt = require('jsonwebtoken');
const databaseController = require('./database.controller');
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
 * Authenticates either as dynamic Project User or Developer Tenant
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

// Route mapping gates
router.use(projectTenantMiddleware);
router.use(dynamicDatabaseAuth);

router.post('/tables', databaseController.createTable);
router.post('/:table', databaseController.insertRecord);
router.get('/:table', databaseController.listRecords);
router.patch('/:table/:id', databaseController.updateRecord);
router.delete('/:table/:id', databaseController.deleteRecord);

module.exports = router;
