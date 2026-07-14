const crypto = require('crypto');
const prisma = require('../../config/db');

// --- Bucket Repository Actions ---

const createBucket = async ({ projectId, name, description, isPublic, storageLimit }) => {
  const id = crypto.randomUUID();
  await prisma.$queryRawUnsafe(`
    INSERT INTO StorageBucket (id, projectId, name, description, isPublic, storageLimit, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, id, projectId, name, description || null, isPublic ? 1 : 0, storageLimit || null);

  return getBucketById(id);
};

const getBucketByName = async (projectId, name) => {
  const buckets = await prisma.$queryRawUnsafe(`
    SELECT * FROM StorageBucket WHERE projectId = ? AND name = ? LIMIT 1
  `, projectId, name);
  return buckets[0] || null;
};

const getBucketById = async (id) => {
  const buckets = await prisma.$queryRawUnsafe(`
    SELECT * FROM StorageBucket WHERE id = ? LIMIT 1
  `, id);
  return buckets[0] || null;
};

const listBuckets = async (projectId) => {
  return await prisma.$queryRawUnsafe(`
    SELECT * FROM StorageBucket WHERE projectId = ? ORDER BY createdAt DESC
  `, projectId);
};

const deleteBucket = async (id) => {
  await prisma.$queryRawUnsafe(`
    DELETE FROM StorageBucket WHERE id = ?
  `, id);
};

const updateBucket = async (id, updates) => {
  const setClauses = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`);
    values.push(value);
  }
  if (setClauses.length === 0) return getBucketById(id);
  
  values.push(id);
  await prisma.$queryRawUnsafe(`
    UPDATE StorageBucket SET ${setClauses.join(', ')}, updatedAt = NOW() WHERE id = ?
  `, ...values);
  
  return getBucketById(id);
};


// --- File Repository Actions ---

const createFile = async (fileData) => {
  const id = crypto.randomUUID();
  await prisma.$queryRawUnsafe(`
    INSERT INTO StorageObject (id, projectId, bucketId, fileName, filePath, fileUrl, mimeType, size, uploadedBy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, id, fileData.projectId, fileData.bucketId, fileData.fileName, fileData.filePath, fileData.fileUrl || null, fileData.mimeType, fileData.size, fileData.uploadedBy || null);

  return getFileById(id);
};

const getFileById = async (id) => {
  const files = await prisma.$queryRawUnsafe(`
    SELECT * FROM StorageObject WHERE id = ? LIMIT 1
  `, id);
  return files[0] || null;
};

const getFileByPath = async (bucketId, filePath) => {
  const files = await prisma.$queryRawUnsafe(`
    SELECT * FROM StorageObject WHERE bucketId = ? AND filePath = ? LIMIT 1
  `, bucketId, filePath);
  return files[0] || null;
};

const deleteFile = async (id) => {
  await prisma.$queryRawUnsafe(`
    DELETE FROM StorageObject WHERE id = ?
  `, id);
};

const listFiles = async (projectId, bucketId) => {
  return await prisma.$queryRawUnsafe(`
    SELECT * FROM StorageObject WHERE projectId = ? AND bucketId = ? ORDER BY createdAt DESC
  `, projectId, bucketId);
};

// --- Project Storage Limits ---

const updateProjectStorageUsed = async (projectId, sizeDelta) => {
  // sizeDelta can be positive (upload) or negative (delete)
  await prisma.$queryRawUnsafe(`
    UPDATE Project SET storageUsed = storageUsed + ? WHERE id = ?
  `, sizeDelta, projectId);
};

const getProjectStorageInfo = async (projectId) => {
  const projects = await prisma.$queryRawUnsafe(`
    SELECT storageLimit, storageUsed FROM Project WHERE id = ? LIMIT 1
  `, projectId);
  return projects[0] || null;
};

module.exports = {
  createBucket,
  getBucketByName,
  getBucketById,
  listBuckets,
  deleteBucket,
  updateBucket,
  createFile,
  getFileById,
  getFileByPath,
  deleteFile,
  listFiles,
  updateProjectStorageUsed,
  getProjectStorageInfo
};
