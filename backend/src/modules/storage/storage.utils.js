const fs = require('fs/promises');
const path = require('path');
const jwt = require('jsonwebtoken');

const STORAGE_ROOT = path.resolve(process.cwd(), 'uploads', 'storage');
const SIGNED_URL_SECRET = process.env.JWT_SECRET || 'kiaan-signed-url-secret-2026';

/**
 * Gets the physical directory path for a project's bucket.
 */
const getBucketPath = (projectId, bucketName) => {
  return path.join(STORAGE_ROOT, projectId, bucketName);
};

/**
 * Gets the physical file path for a project's file.
 */
const getFilePath = (projectId, bucketName, filePath) => {
  return path.join(getBucketPath(projectId, bucketName), filePath);
};

/**
 * Checks if path exists.
 */
const pathExists = async (p) => {
  try {
    await fs.access(p);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Saves a file from a temporary buffer or upload stream.
 */
const saveFile = async (projectId, bucketName, filePath, buffer) => {
  const fullPath = getFilePath(projectId, bucketName, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  return fullPath;
};

/**
 * Deletes a file from the disk.
 */
const deleteFile = async (projectId, bucketName, filePath) => {
  const fullPath = getFilePath(projectId, bucketName, filePath);
  if (await pathExists(fullPath)) {
    await fs.unlink(fullPath);
  }
};

/**
 * Moves a file from one path to another.
 */
const moveFile = async (projectId, bucketName, sourcePath, destPath) => {
  const srcFullPath = getFilePath(projectId, bucketName, sourcePath);
  const destFullPath = getFilePath(projectId, bucketName, destPath);
  if (!(await pathExists(srcFullPath))) {
    throw new Error(`Source file does not exist: "${sourcePath}"`);
  }
  await fs.mkdir(path.dirname(destFullPath), { recursive: true });
  
  try {
    await fs.rename(srcFullPath, destFullPath);
  } catch (err) {
    // Fallback for cross-device rename
    await fs.copyFile(srcFullPath, destFullPath);
    await fs.unlink(srcFullPath);
  }
};

/**
 * Copies a file from one path to another.
 */
const copyFile = async (projectId, bucketName, sourcePath, destPath) => {
  const srcFullPath = getFilePath(projectId, bucketName, sourcePath);
  const destFullPath = getFilePath(projectId, bucketName, destPath);
  if (!(await pathExists(srcFullPath))) {
    throw new Error(`Source file does not exist: "${sourcePath}"`);
  }
  await fs.mkdir(path.dirname(destFullPath), { recursive: true });
  await fs.copyFile(srcFullPath, destFullPath);
};

/**
 * Deletes all files in a bucket directory.
 */
const deleteBucketDirectory = async (projectId, bucketName) => {
  const bucketFullPath = getBucketPath(projectId, bucketName);
  if (await pathExists(bucketFullPath)) {
    await fs.rm(bucketFullPath, { recursive: true, force: true });
  }
};

/**
 * Generates a signed token for temporary access.
 */
const generateSignedToken = (projectId, bucketName, filePath, expirySeconds) => {
  return jwt.sign(
    { projectId, bucketName, filePath },
    SIGNED_URL_SECRET,
    { expiresIn: expirySeconds }
  );
};

/**
 * Verifies and decodes a signed token.
 */
const verifySignedToken = (token) => {
  try {
    return jwt.verify(token, SIGNED_URL_SECRET);
  } catch (err) {
    return null;
  }
};

module.exports = {
  getBucketPath,
  getFilePath,
  pathExists,
  saveFile,
  deleteFile,
  moveFile,
  copyFile,
  deleteBucketDirectory,
  generateSignedToken,
  verifySignedToken
};
