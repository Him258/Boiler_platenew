const projectAuthService = require('./projectAuth.service');
const { sendSuccess, sendError } = require('../../core/response');

/**
 * Parses user agent to extract browser and device names safely
 */
const parseUserAgent = (ua) => {
  let browser = 'Unknown Browser';
  let device = 'Unknown Device';

  if (!ua) return { browser, device };

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'Internet Explorer';

  if (ua.includes('Windows')) device = 'Windows PC';
  else if (ua.includes('Macintosh')) device = 'MacBook';
  else if (ua.includes('iPhone')) device = 'iPhone';
  else if (ua.includes('iPad')) device = 'iPad';
  else if (ua.includes('Android')) device = 'Android Mobile';
  else if (ua.includes('Linux')) device = 'Linux PC';

  return { browser, device };
};

/**
 * Controller to handle Dynamic Authentication endpoints for Project databases
 */

exports.signup = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 'VALIDATION_ERROR', [], 400);
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      return sendError(res, 'A valid email address is required', 'VALIDATION_ERROR', [], 400);
    }

    if (typeof password !== 'string' || password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters long', 'VALIDATION_ERROR', [], 400);
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'] || '';
    const meta = parseUserAgent(ua);

    // Call service with project context (attached by projectTenantMiddleware)
    const data = await projectAuthService.signup(
      req.project, 
      { email, password }, 
      { ipAddress, browser: meta.browser, device: meta.device }
    );
    
    return sendSuccess(res, 'User registered successfully', {
      user: data.user,
      session: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      },
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    }, null, 201);
  } catch (error) {
    console.error('[ProjectAuthController.signup] Error:', error);
    if (error.message === 'User already exists') {
      return sendError(res, error.message, 'CONFLICT', [], 409);
    }
    return sendError(res, 'Failed to register user', 'INTERNAL_ERROR', [], 500);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 'VALIDATION_ERROR', [], 400);
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'] || '';
    const meta = parseUserAgent(ua);

    const data = await projectAuthService.login(
      req.project, 
      { email, password },
      { ipAddress, browser: meta.browser, device: meta.device }
    );
    
    return sendSuccess(res, 'User logged in successfully', {
      user: data.user,
      session: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      },
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    });
  } catch (error) {
    console.error('[ProjectAuthController.login] Error:', error);
    if (error.message === 'Invalid credentials') {
      return sendError(res, error.message, 'UNAUTHORIZED', [], 401);
    }
    return sendError(res, 'Failed to log in', 'INTERNAL_ERROR', [], 500);
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required to log out', 'VALIDATION_ERROR', [], 400);
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'] || '';
    const meta = parseUserAgent(ua);

    await projectAuthService.logout(
      req.project, 
      refreshToken,
      { ipAddress, browser: meta.browser, device: meta.device }
    );
    
    return sendSuccess(res, 'Logged out successfully', { success: true });
  } catch (error) {
    console.error('[ProjectAuthController.logout] Error:', error);
    if (error.message === 'Session not found or already logged out') {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to log out', 'INTERNAL_ERROR', [], 500);
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required to refresh session', 'VALIDATION_ERROR', [], 400);
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'] || '';
    const meta = parseUserAgent(ua);

    const data = await projectAuthService.refresh(
      req.project, 
      refreshToken,
      { ipAddress, browser: meta.browser, device: meta.device }
    );
    
    return sendSuccess(res, 'Tokens refreshed successfully', {
      user: data.user,
      session: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      },
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    });
  } catch (error) {
    console.error('[ProjectAuthController.refresh] Error:', error);
    if (error.message === 'Invalid or expired refresh token' || error.message === 'Refresh token has expired') {
      return sendError(res, error.message, 'UNAUTHORIZED', [], 401);
    }
    return sendError(res, 'Failed to refresh token', 'INTERNAL_ERROR', [], 500);
  }
};

exports.me = async (req, res) => {
  try {
    // req.user is attached by projectUserAuthMiddleware
    const userId = req.user.sub;
    const client = req.project.client;

    // Load fresh user details from the project's own database
    const users = await client.$queryRawUnsafe(
      'SELECT `id`, `email`, `role`, `created_at`, `updated_at`, `last_login` FROM `users` WHERE `id` = ? LIMIT 1',
      userId
    );

    if (!users || users.length === 0) {
      return sendError(res, 'User not found in project database', 'NOT_FOUND', [], 404);
    }

    const userObj = users[0];

    return sendSuccess(res, 'User details retrieved successfully', {
      user: {
        id: userObj.id,
        email: userObj.email,
        role: userObj.role,
        createdAt: userObj.created_at,
        updatedAt: userObj.updated_at,
        lastLogin: userObj.last_login
      }
    });
  } catch (error) {
    console.error('[ProjectAuthController.me] Error:', error);
    return sendError(res, 'Failed to retrieve user profile', 'INTERNAL_ERROR', [], 500);
  }
};
