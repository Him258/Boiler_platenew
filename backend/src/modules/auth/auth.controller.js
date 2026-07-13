const authService = require('./auth.service');
const { sendSuccess, sendError } = require('../../core/response');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 'Email and password are required', 'VALIDATION_ERROR', [], 400);
    }

    const data = await authService.login(email, password);
    return sendSuccess(res, 'Logged in successfully', data);
  } catch (error) {
    if (error.message === 'Invalid credentials' || error.message === 'User not found') {
      return sendError(res, error.message, 'UNAUTHORIZED', [], 401);
    }
    return sendError(res, 'Something went wrong', 'INTERNAL_ERROR', [], 500);
  }
};

exports.register = async (req, res) => {
  try {
    const { tenantName, firstName, lastName, email, password } = req.body;
    
    if (!tenantName || !firstName || !email || !password) {
      return sendError(res, 'Missing required fields', 'VALIDATION_ERROR', [], 400);
    }

    const data = await authService.register({ tenantName, firstName, lastName, email, password });
    return sendSuccess(res, 'Account created successfully', data, null, 201);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return sendError(res, error.message, 'CONFLICT', [], 409);
    }
    console.error(error);
    return sendError(res, 'Failed to create account', 'INTERNAL_ERROR', [], 500);
  }
};

exports.me = async (req, res) => {
  try {
    const data = await authService.getProfile(req.user.userId);
    return sendSuccess(res, 'Profile retrieved successfully', { user: data });
  } catch (error) {
    console.error('[AuthController.me] Error:', error);
    return sendError(res, error.message || 'Failed to retrieve profile', 'INTERNAL_ERROR', [], 500);
  }
};

