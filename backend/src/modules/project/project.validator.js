const { sendError } = require('../../core/response');

exports.validateCreateProject = (req, res, next) => {
  const { name } = req.body;
  
  if (!name) {
    return sendError(res, 'Project name is required', 'VALIDATION_ERROR', [], 400);
  }
  
  if (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 50) {
    return sendError(res, 'Project name must be a string between 3 and 50 characters', 'VALIDATION_ERROR', [], 400);
  }
  
  const isValidName = /^[a-zA-Z0-9\s-_]+$/.test(name);
  if (!isValidName) {
    return sendError(res, 'Project name can only contain letters, numbers, spaces, hyphens, and underscores', 'VALIDATION_ERROR', [], 400);
  }
  
  req.body.name = name.trim();
  next();
};
