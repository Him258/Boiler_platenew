const express = require('express');
const jwt = require('jsonwebtoken');
const authController = require('./auth.controller');
const projectAuthController = require('./projectAuth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const projectTenantMiddleware = require('../../middlewares/projectTenant.middleware');
const projectUserAuthMiddleware = require('../../middlewares/projectUserAuth.middleware');
const rateLimiter = require('../../middlewares/rateLimiter.middleware');


const router = express.Router();

// Helper to determine if a request contains project identification headers/query
const isProjectRequest = (req) => {
  return !!(
    req.headers['x-project-ref'] ||
    req.headers['x-project-id'] ||
    req.headers['apikey'] ||
    req.query.apikey
  );
};

// Helper to determine if the token is a project-level user JWT
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



// Signup (Only for project users, rate limited)
router.post(
  '/signup',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }),
  projectTenantMiddleware,
  projectAuthController.signup
);

// Login (Dispatches control plane or project plane auth)
router.post(
  '/login',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }),
  (req, res, next) => {
    console.log('[POST /login] Request Headers:', req.headers);
    console.log('[POST /login] Request Query:', req.query);
    console.log('[POST /login] isProjectRequest =', isProjectRequest(req));

    if (isProjectRequest(req)) {
      console.log('[POST /login] Dispatching: Using projectAuthController.login');
      return projectTenantMiddleware(req, res, (err) => {
        if (err) return next(err);
        return projectAuthController.login(req, res, next);
      });
    }
    console.log('[POST /login] Dispatching: Using authController.login');
    return authController.login(req, res, next);
  }
);


// Logout (Only for project users)
router.post('/logout', projectTenantMiddleware, projectAuthController.logout);

// Refresh (Only for project users)
router.post('/refresh', projectTenantMiddleware, projectAuthController.refresh);

// Me (Dispatches control plane or project plane auth based on token type)
router.get(
  '/me',
  (req, res, next) => {
    if (isProjectToken(req)) {
      return projectUserAuthMiddleware(req, res, (err) => {
        if (err) return next(err);
        return projectAuthController.me(req, res, next);
      });
    }
    return authMiddleware(req, res, (err) => {
      if (err) return next(err);
      return authController.me(req, res, next);
    });
  }
);


// Register (Only for control plane tenant signup, not project users)
router.post('/register', authController.register);


module.exports = router;
