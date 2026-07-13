const fs = require('fs/promises');
const storageService = require('./storage.service');
const storageUtils = require('./storage.utils');
const { sendSuccess, sendError } = require('../../core/response');

// Helper to extract file path cleanly from wildcard params (handles Express 5 arrays or Express 4 strings)
const getPathFromParams = (req) => {
  const p = req.params.path;
  return Array.isArray(p) ? p.join('/') : p;
};

// --- Bucket Controllers ---

exports.createBucket = async (req, res) => {
  try {
    const { name, isPublic } = req.body;
    const project = req.project;

    if (!name) {
      return sendError(res, 'Bucket name is required', 'VALIDATION_ERROR', [], 400);
    }

    const bucket = await storageService.createBucket(project, name, isPublic);
    return sendSuccess(res, 'Bucket created successfully', bucket, null, 201);
  } catch (error) {
    console.error('[StorageController.createBucket] Error:', error);
    if (error.message.includes('already exists') || error.message.includes('Invalid bucket name')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }
    return sendError(res, 'Failed to create bucket', 'INTERNAL_ERROR', [], 500);
  }
};

exports.listBuckets = async (req, res) => {
  try {
    const project = req.project;
    const buckets = await storageService.listBuckets(project);
    return sendSuccess(res, 'Buckets retrieved successfully', buckets);
  } catch (error) {
    console.error('[StorageController.listBuckets] Error:', error);
    return sendError(res, 'Failed to list buckets', 'INTERNAL_ERROR', [], 500);
  }
};

exports.deleteBucket = async (req, res) => {
  try {
    const { bucketName } = req.params;
    const project = req.project;

    await storageService.deleteBucket(project, bucketName);
    return sendSuccess(res, 'Bucket deleted successfully', {});
  } catch (error) {
    console.error('[StorageController.deleteBucket] Error:', error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to delete bucket', 'INTERNAL_ERROR', [], 500);
  }
};

// --- Object Controllers ---

exports.uploadFile = async (req, res) => {
  try {
    const { bucketName } = req.params;
    const filePath = getPathFromParams(req);
    const project = req.project;

    if (!req.file) {
      return sendError(res, 'No file was uploaded.', 'VALIDATION_ERROR', [], 400);
    }

    const fileMeta = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user ? (req.user.email || req.user.sub) : null
    };

    const record = await storageService.uploadFile(project, bucketName, filePath, req.file.buffer, fileMeta);
    return sendSuccess(res, 'File uploaded successfully', record, null, 201);
  } catch (error) {
    console.error('[StorageController.uploadFile] Error:', error);
    if (error.message.includes('not found') ||
        error.message.includes('Invalid characters') ||
        error.message.includes('Unsupported file type') ||
        error.message.includes('blocked')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }
    return sendError(res, 'Failed to upload file', 'INTERNAL_ERROR', [], 500);
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const { bucketName } = req.params;
    const filePath = getPathFromParams(req);
    const project = req.project;

    const { file, physicalPath } = await storageService.getFileMetadata(project, bucketName, filePath);

    // Set correct headers
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    
    return res.sendFile(physicalPath);
  } catch (error) {
    console.error('[StorageController.downloadFile] Error:', error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to download file', 'INTERNAL_ERROR', [], 500);
  }
};

exports.downloadPublicFile = async (req, res) => {
  try {
    const { bucketName } = req.params;
    const filePath = getPathFromParams(req);
    const project = req.project;

    const { file, bucket, physicalPath } = await storageService.getFileMetadata(project, bucketName, filePath);

    if (!bucket.isPublic) {
      return sendError(res, 'Access denied to private bucket resources.', 'FORBIDDEN', [], 403);
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    
    return res.sendFile(physicalPath);
  } catch (error) {
    console.error('[StorageController.downloadPublicFile] Error:', error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to download file', 'INTERNAL_ERROR', [], 500);
  }
};

exports.downloadSignedFile = async (req, res) => {
  try {
    const { bucketName } = req.params;
    const filePath = getPathFromParams(req);
    const { token } = req.query;

    if (!token) {
      return sendError(res, 'Signed token parameter is missing.', 'UNAUTHORIZED', [], 401);
    }

    // Verify token
    const decoded = storageUtils.verifySignedToken(token);
    if (!decoded || decoded.bucketName !== bucketName || decoded.filePath !== filePath) {
      return sendError(res, 'Invalid or expired signed URL token.', 'UNAUTHORIZED', [], 401);
    }

    const project = req.project; // Populated by projectTenantMiddleware
    const { file, physicalPath } = await storageService.getFileMetadata(project, bucketName, filePath);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    
    return res.sendFile(physicalPath);
  } catch (error) {
    console.error('[StorageController.downloadSignedFile] Error:', error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to serve signed file', 'INTERNAL_ERROR', [], 500);
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const { bucketName } = req.params;
    const filePath = getPathFromParams(req);
    const project = req.project;

    await storageService.deleteFile(project, bucketName, filePath);
    return sendSuccess(res, 'File deleted successfully', {});
  } catch (error) {
    console.error('[StorageController.deleteFile] Error:', error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to delete file', 'INTERNAL_ERROR', [], 500);
  }
};

exports.moveFile = async (req, res) => {
  try {
    const { bucketName } = req.body;
    const { sourcePath, destPath } = req.body;
    const project = req.project;

    if (!bucketName || !sourcePath || !destPath) {
      return sendError(res, 'bucketName, sourcePath, and destPath are required', 'VALIDATION_ERROR', [], 400);
    }

    const file = await storageService.moveFile(project, bucketName, sourcePath, destPath);
    return sendSuccess(res, 'File moved successfully', file);
  } catch (error) {
    console.error('[StorageController.moveFile] Error:', error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    if (error.message.includes('occupied') || error.message.includes('Invalid')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }
    return sendError(res, 'Failed to move file', 'INTERNAL_ERROR', [], 500);
  }
};

exports.copyFile = async (req, res) => {
  try {
    const { bucketName, sourcePath, destPath } = req.body;
    const project = req.project;

    if (!bucketName || !sourcePath || !destPath) {
      return sendError(res, 'bucketName, sourcePath, and destPath are required', 'VALIDATION_ERROR', [], 400);
    }

    const file = await storageService.copyFile(project, bucketName, sourcePath, destPath);
    return sendSuccess(res, 'File copied successfully', file);
  } catch (error) {
    console.error('[StorageController.copyFile] Error:', error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    if (error.message.includes('occupied') || error.message.includes('Invalid')) {
      return sendError(res, error.message, 'VALIDATION_ERROR', [], 400);
    }
    return sendError(res, 'Failed to copy file', 'INTERNAL_ERROR', [], 500);
  }
};

exports.listFiles = async (req, res) => {
  try {
    const { bucketName } = req.params;
    const { folderPrefix, search, sort, order, page, limit } = req.query;
    const project = req.project;

    const result = await storageService.listFiles(project, bucketName, {
      folderPrefix,
      search,
      sort,
      order,
      page,
      limit
    });

    return sendSuccess(res, 'Files listed successfully', result.items, { total: result.total });
  } catch (error) {
    console.error('[StorageController.listFiles] Error:', error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to list files', 'INTERNAL_ERROR', [], 500);
  }
};

exports.generateSignedUrl = async (req, res) => {
  try {
    const { bucketName } = req.params;
    const filePath = getPathFromParams(req);
    const { expiresIn } = req.body;
    const project = req.project;

    const result = await storageService.generateSignedUrl(project, bucketName, filePath, expiresIn);
    return sendSuccess(res, 'Signed URL generated successfully', result);
  } catch (error) {
    console.error('[StorageController.generateSignedUrl] Error:', error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 'NOT_FOUND', [], 404);
    }
    return sendError(res, 'Failed to generate signed URL', 'INTERNAL_ERROR', [], 500);
  }
};
