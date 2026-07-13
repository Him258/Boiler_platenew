const jwt = require('jsonwebtoken');
const projectTenantMiddleware = require('./projectTenant.middleware');
const { sendError } = require('../core/response');

/**
 * Middleware to verify project-level user JWT and attach user context
 */
const projectUserAuthMiddleware = (req, res, next) => {
  // First, resolve the project tenant context
  projectTenantMiddleware(req, res, (err) => {
    if (err) {
      return next(err);
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendError(res, 'Authentication token is missing or invalid', 'UNAUTHORIZED', [], 401);
      }

      const token = authHeader.split(' ')[1];

      // Verify token with the project-specific secret
      let decoded;
      try {
        decoded = jwt.verify(token, req.project.jwtSecret);
      } catch (err) {
        return sendError(res, 'Invalid or expired token', 'UNAUTHORIZED', [], 401);
      }

      // Attach decoded user claims (sub, email, role, etc.)
      req.user = decoded;
      next();
    } catch (error) {
      console.error('[ProjectUserAuthMiddleware] Unexpected error:', error);
      return sendError(res, 'An unexpected error occurred during user authentication.', 'INTERNAL_ERROR', [], 500);
    }
  });
};

module.exports = projectUserAuthMiddleware;
