const storageService = require('./storage.service');
const { sendSuccess, sendError } = require('../../core/response');

// --- Bucket Controllers ---

exports.createBucket = async (req, res) => {
  try {
    const { name, description, isPublic, storageLimit } = req.body;
    const project = req.project;

    if (!name) {
      return sendError(res, 'Bucket name is required', 'VALIDATION_ERROR', [], 400);
    }

    const bucket = await storageService.createBucket(project, name, description, isPublic, storageLimit);
    return sendSuccess(res, 'Bucket created successfully', bucket, null, 201);
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('Invalid bucket name')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }
    console.error(error);
    return sendError(res, 'Failed to create bucket', 'INTERNAL_ERROR', [], 500);
  }
};

exports.listBuckets = async (req, res) => {
  try {
    const project = req.project;
    const buckets = await storageService.listBuckets(project);
    return sendSuccess(res, 'Buckets retrieved successfully', buckets);
  } catch (error) {
    console.error(error);
    return sendError(res, 'Failed to list buckets', 'INTERNAL_ERROR', [], 500);
  }
};

exports.getBucket = async (req, res) => {
  try {
    const project = req.project;
    const bucket = await storageService.getBucket(project, req.params.id);
    return sendSuccess(res, 'Bucket retrieved successfully', bucket);
  } catch (error) {
    if (error.message === 'Bucket not found') return sendError(res, error.message, 'NOT_FOUND', [], 404);
    return sendError(res, 'Failed to get bucket', 'INTERNAL_ERROR', [], 500);
  }
};

exports.updateBucket = async (req, res) => {
  try {
    const project = req.project;
    const updates = req.body;
    // Disallow project/id updates
    delete updates.id;
    delete updates.projectId;

    const bucket = await storageService.updateBucket(project, req.params.id, updates);
    return sendSuccess(res, 'Bucket updated successfully', bucket);
  } catch (error) {
    if (error.message === 'Bucket not found') return sendError(res, error.message, 'NOT_FOUND', [], 404);
    return sendError(res, 'Failed to update bucket', 'INTERNAL_ERROR', [], 500);
  }
};

exports.deleteBucket = async (req, res) => {
  try {
    const project = req.project;
    await storageService.deleteBucket(project, req.params.id);
    return sendSuccess(res, 'Bucket deleted successfully', {});
  } catch (error) {
    if (error.message === 'Bucket not found') return sendError(res, error.message, 'NOT_FOUND', [], 404);
    return sendError(res, 'Failed to delete bucket', 'INTERNAL_ERROR', [], 500);
  }
};

// --- File Controllers ---

exports.uploadFile = async (req, res) => {
  try {
    const { bucketId, filePath } = req.body;
    const project = req.project;

    if (!req.file || !bucketId || !filePath) {
      return sendError(res, 'File, bucketId, and filePath are required.', 'VALIDATION_ERROR', [], 400);
    }

    const fileMeta = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user ? (req.user.email || req.user.sub || req.user.userId || req.user.id) : null
    };

    const record = await storageService.uploadFile(project, bucketId, filePath, req.file.buffer, fileMeta);
    return sendSuccess(res, 'File uploaded successfully', record, null, 201);
  } catch (error) {
    if (error.message.includes('not found') ||
        error.message.includes('Invalid characters') ||
        error.message.includes('Unsupported file type')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }
    if (error.message === 'STORAGE_LIMIT_EXCEEDED') {
       return sendError(res, 'Project storage limit exceeded.', 'FORBIDDEN', [], 403);
    }
    console.error(error);
    return sendError(res, 'Failed to upload file', 'INTERNAL_ERROR', [], 500);
  }
};

exports.listFiles = async (req, res) => {
  try {
    const project = req.project;
    const { bucketId } = req.query;
    
    if (!bucketId) {
      // Return files across all buckets if needed, or enforce bucketId. We'll enforce bucketId for safety.
      return sendError(res, 'bucketId query parameter is required.', 'VALIDATION_ERROR', [], 400);
    }
    
    const result = await storageService.listFiles(project, bucketId);
    return sendSuccess(res, 'Files listed successfully', result);
  } catch (error) {
    if (error.message === 'Bucket not found') return sendError(res, error.message, 'NOT_FOUND', [], 404);
    return sendError(res, 'Failed to list files', 'INTERNAL_ERROR', [], 500);
  }
};

exports.getFile = async (req, res) => {
  try {
    const project = req.project;
    const file = await storageService.getFile(project, req.params.id);
    return sendSuccess(res, 'File retrieved successfully', file);
  } catch (error) {
    if (error.message === 'File not found') return sendError(res, error.message, 'NOT_FOUND', [], 404);
    return sendError(res, 'Failed to get file details', 'INTERNAL_ERROR', [], 500);
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const project = req.project;
    await storageService.deleteFile(project, req.params.id);
    return sendSuccess(res, 'File deleted successfully', {});
  } catch (error) {
    if (error.message === 'File not found' || error.message === 'Bucket not found') return sendError(res, error.message, 'NOT_FOUND', [], 404);
    return sendError(res, 'Failed to delete file', 'INTERNAL_ERROR', [], 500);
  }
};
