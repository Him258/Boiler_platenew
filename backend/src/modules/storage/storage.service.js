const path = require('path');
const crypto = require('crypto');
const storageRepository = require('./storage.repository');
const storageUtils = require('./storage.utils');
const { validateBucketName, validateStoragePath } = require('./storage.validation');

// Supported mime types whitelist (image, pdf, word, excel, csv, zip, video, audio)
const WHitelisted_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/zip', 'application/x-zip-compressed',
  'video/mp4', 'video/mpeg', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg'
];

/**
 * Validates file mimetype.
 */
const validateMimeType = (mimeType) => {
  if (!WHitelisted_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported file type: "${mimeType}". Only images, PDFs, office docs, CSVs, ZIPs, audios, and videos are allowed.`);
  }
};

/**
 * Storage Service to handle bucket and file logic
 */

exports.createBucket = async (project, name, isPublic = false) => {
  validateBucketName(name);

  const existing = await storageRepository.getBucketByName(project.id, name);
  if (existing) {
    throw new Error(`Bucket "${name}" already exists.`);
  }

  return await storageRepository.createBucket({
    projectId: project.id,
    name,
    isPublic
  });
};

exports.listBuckets = async (project) => {
  return await storageRepository.listBuckets(project.id);
};

exports.deleteBucket = async (project, name) => {
  validateBucketName(name);

  const bucket = await storageRepository.getBucketByName(project.id, name);
  if (!bucket) {
    throw new Error(`Bucket "${name}" not found.`);
  }

  // 1. Physically delete all files in bucket directory on disk
  await storageUtils.deleteBucketDirectory(project.id, name);

  // 2. Database constraints will Cascade delete files metadata due to relation onDelete: Cascade
  return await storageRepository.deleteBucket(bucket.id);
};

exports.uploadFile = async (project, bucketName, filePath, fileBuffer, fileMeta) => {
  validateBucketName(bucketName);
  validateStoragePath(filePath);
  validateMimeType(fileMeta.mimeType);

  const bucket = await storageRepository.getBucketByName(project.id, bucketName);
  if (!bucket) {
    throw new Error(`Bucket "${bucketName}" not found.`);
  }

  // Generate unique filename to prevent collissions on disk
  const ext = path.extname(fileMeta.originalName) || '';
  const storedName = `${crypto.randomBytes(16).toString('hex')}${ext}`;

  // Check if file already exists in metadata
  const existingFile = await storageRepository.getFileByPath(bucket.id, filePath);
  if (existingFile) {
    // Delete old physical file
    await storageUtils.deleteFile(project.id, bucketName, existingFile.storedName);
    // Delete database metadata
    await storageRepository.deleteFile(existingFile.id);
  }

  // Physically write to disk
  await storageUtils.saveFile(project.id, bucketName, storedName, fileBuffer);

  // Save metadata
  return await storageRepository.createFile({
    projectId: project.id,
    bucketId: bucket.id,
    originalName: fileMeta.originalName,
    storedName,
    path: filePath,
    mimeType: fileMeta.mimeType,
    extension: ext.toLowerCase(),
    size: fileMeta.size,
    uploadedBy: fileMeta.uploadedBy || null,
    visibility: bucket.isPublic ? 'public' : 'private'
  });
};

exports.getFileMetadata = async (project, bucketName, filePath) => {
  validateBucketName(bucketName);
  validateStoragePath(filePath);

  const bucket = await storageRepository.getBucketByName(project.id, bucketName);
  if (!bucket) {
    throw new Error(`Bucket "${bucketName}" not found.`);
  }

  const file = await storageRepository.getFileByPath(bucket.id, filePath);
  if (!file) {
    throw new Error(`File "${filePath}" not found in bucket "${bucketName}".`);
  }

  return {
    file,
    bucket,
    physicalPath: storageUtils.getFilePath(project.id, bucketName, file.storedName)
  };
};

exports.deleteFile = async (project, bucketName, filePath) => {
  validateBucketName(bucketName);
  validateStoragePath(filePath);

  const { file } = await exports.getFileMetadata(project, bucketName, filePath);

  // 1. Physically delete
  await storageUtils.deleteFile(project.id, bucketName, file.storedName);

  // 2. Delete metadata
  return await storageRepository.deleteFile(file.id);
};

exports.moveFile = async (project, bucketName, sourcePath, destPath) => {
  validateBucketName(bucketName);
  validateStoragePath(sourcePath);
  validateStoragePath(destPath);

  const { file, bucket } = await exports.getFileMetadata(project, bucketName, sourcePath);

  // Check if destination already occupied
  const existingDest = await storageRepository.getFileByPath(bucket.id, destPath);
  if (existingDest) {
    throw new Error(`Destination path "${destPath}" already occupied.`);
  }

  // Physically move
  // Wait, in our storage structures, files are saved on disk with uniquely generated random strings.
  // So they don't actually move physical paths (since they are referenced by storedName inside the same project/bucket folder!).
  // But to preserve modularity, if the source and dest were different buckets/projects we would move them.
  // In a single bucket move, we only need to update the file path identifier in the database metadata!
  // This is extremely efficient and fast!
  await storageRepository.updateFilePath(file.id, destPath);
  
  return await storageRepository.getFileByPath(bucket.id, destPath);
};

exports.copyFile = async (project, bucketName, sourcePath, destPath) => {
  validateBucketName(bucketName);
  validateStoragePath(sourcePath);
  validateStoragePath(destPath);

  const { file, bucket } = await exports.getFileMetadata(project, bucketName, sourcePath);

  const existingDest = await storageRepository.getFileByPath(bucket.id, destPath);
  if (existingDest) {
    throw new Error(`Destination path "${destPath}" already occupied.`);
  }

  // Generate new storedName and copy physical file
  const ext = path.extname(file.originalName) || '';
  const newStoredName = `${crypto.randomBytes(16).toString('hex')}${ext}`;

  // Copy on disk
  await storageUtils.copyFile(project.id, bucketName, file.storedName, newStoredName);

  // Create new metadata
  return await storageRepository.createFile({
    projectId: project.id,
    bucketId: bucket.id,
    originalName: file.originalName,
    storedName: newStoredName,
    path: destPath,
    mimeType: file.mimeType,
    extension: file.extension,
    size: file.size,
    uploadedBy: file.uploadedBy,
    visibility: file.visibility
  });
};

exports.listFiles = async (project, bucketName, queryOptions) => {
  validateBucketName(bucketName);

  const bucket = await storageRepository.getBucketByName(project.id, bucketName);
  if (!bucket) {
    throw new Error(`Bucket "${bucketName}" not found.`);
  }

  const { folderPrefix, search, sort, order, page = 1, limit = 20 } = queryOptions;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));

  return await storageRepository.listFiles({
    bucketId: bucket.id,
    folderPrefix,
    search,
    sort,
    order,
    limit: Math.min(100, Math.max(1, parseInt(limit))),
    offset
  });
};

exports.generateSignedUrl = async (project, bucketName, filePath, expirySeconds = 300) => {
  // Expiry check limits
  const parsedExpiry = Math.min(86400, Math.max(60, parseInt(expirySeconds) || 300));
  
  // Verify metadata exists
  const { file } = await exports.getFileMetadata(project, bucketName, filePath);

  const token = storageUtils.generateSignedToken(project.id, bucketName, file.path, parsedExpiry);
  return {
    url: `/storage/v1/object/signed/${bucketName}/${file.path}?token=${token}`,
    token,
    expiresIn: parsedExpiry
  };
};
