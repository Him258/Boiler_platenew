const path = require('path');
const crypto = require('crypto');
const storageRepository = require('./storage.repository');
const { validateBucketName, validateStoragePath } = require('./storage.validation');

// Use LocalStorageProvider as default
const LocalStorageProvider = require('./providers/LocalStorageProvider');
const storageProvider = new LocalStorageProvider();

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

const validateMimeType = (mimeType) => {
  if (!WHitelisted_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported file type: "${mimeType}".`);
  }
};

exports.createBucket = async (project, name, description, isPublic = false, storageLimit = null) => {
  validateBucketName(name);

  const existing = await storageRepository.getBucketByName(project.id, name);
  if (existing) {
    throw new Error(`Bucket "${name}" already exists.`);
  }

  return await storageRepository.createBucket({
    projectId: project.id,
    name,
    description,
    isPublic,
    storageLimit
  });
};

exports.listBuckets = async (project) => {
  return await storageRepository.listBuckets(project.id);
};

exports.getBucket = async (project, bucketId) => {
  const bucket = await storageRepository.getBucketById(bucketId);
  if (!bucket || bucket.projectId !== project.id) {
    throw new Error('Bucket not found');
  }
  return bucket;
};

exports.updateBucket = async (project, bucketId, updates) => {
  const bucket = await this.getBucket(project, bucketId);
  return await storageRepository.updateBucket(bucket.id, updates);
};

exports.deleteBucket = async (project, bucketId) => {
  const bucket = await this.getBucket(project, bucketId);
  
  // Wipe physical storage via provider
  await storageProvider.deleteBucket(project.id, bucket.name);
  
  // Database deletes cascade automatically (or manually if raw)
  await storageRepository.deleteBucket(bucket.id);
};

exports.uploadFile = async (project, bucketId, filePath, fileBuffer, fileMeta) => {
  validateStoragePath(filePath);
  validateMimeType(fileMeta.mimeType);

  const bucket = await this.getBucket(project, bucketId);

  // Storage Limit Check
  const projInfo = await storageRepository.getProjectStorageInfo(project.id);
  // Ensure we compare BigInt / Numbers correctly (cast to BigInt for safe math)
  const currentUsed = BigInt(projInfo.storageUsed || 0);
  const limit = BigInt(projInfo.storageLimit || 1073741824); // 1GB fallback
  const fileSize = BigInt(fileMeta.size || 0);

  if (currentUsed + fileSize > limit) {
    throw new Error('STORAGE_LIMIT_EXCEEDED');
  }

  // Generate unique physical storage key
  const ext = path.extname(fileMeta.originalName) || '';
  const storageKey = `${crypto.randomBytes(16).toString('hex')}${ext}`;

  // Upload to Provider
  const fileUrl = await storageProvider.upload(project.id, bucket.name, storageKey, fileBuffer);

  // Check if file already exists in DB path to overwrite metadata
  const existingFile = await storageRepository.getFileByPath(bucket.id, filePath);
  if (existingFile) {
    // Delete old physical file
    const oldExt = path.extname(existingFile.fileName) || '';
    // We don't have the exact old storageKey in DB anymore (it's hidden). Wait, we need it. 
    // Wait, the prompt requirements don't ask for storageKey. 
    // They asked for: fileName, filePath, fileUrl, mimeType, size.
    // If the fileUrl contains the storageKey, we can extract it or just let the provider handle it.
    // For local storage, if fileUrl is /uploads/storage/... we can extract it.
    // Better: If we overwrite, we just delete the old metadata and let the old physical file dangle? 
    // No, we must delete it to free space! 
    // Let's store the storageKey in fileUrl for local provider, or extract it.
    const oldKey = existingFile.fileUrl.split('/').pop();
    await storageProvider.delete(project.id, bucket.name, oldKey);
    await storageRepository.deleteFile(existingFile.id);
    await storageRepository.updateProjectStorageUsed(project.id, -existingFile.size);
  }

  // Save metadata
  const fileRecord = await storageRepository.createFile({
    projectId: project.id,
    bucketId: bucket.id,
    fileName: fileMeta.originalName,
    filePath,
    fileUrl,
    mimeType: fileMeta.mimeType,
    size: fileMeta.size,
    uploadedBy: fileMeta.uploadedBy
  });

  // Update storage used
  await storageRepository.updateProjectStorageUsed(project.id, fileMeta.size);

  return fileRecord;
};

exports.listFiles = async (project, bucketId) => {
  // Validate bucket belongs to project
  await this.getBucket(project, bucketId);
  return await storageRepository.listFiles(project.id, bucketId);
};

exports.getFile = async (project, fileId) => {
  const file = await storageRepository.getFileById(fileId);
  if (!file || file.projectId !== project.id) {
    throw new Error('File not found');
  }
  return file;
};

exports.deleteFile = async (project, fileId) => {
  const file = await this.getFile(project, fileId);
  const bucket = await this.getBucket(project, file.bucketId);

  // Extract storageKey from fileUrl (assumes format /uploads/storage/:proj/:bucket/:key)
  const storageKey = file.fileUrl.split('/').pop();

  // 1. Physically delete
  await storageProvider.delete(project.id, bucket.name, storageKey);

  // 2. Delete metadata
  await storageRepository.deleteFile(file.id);

  // 3. Free up storage used limit
  await storageRepository.updateProjectStorageUsed(project.id, -file.size);
};
