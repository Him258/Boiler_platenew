/**
 * Validates storage path and bucket naming constraints to prevent SQL injection & Path traversal
 */
const validateBucketName = (name) => {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_\-]+$/.test(name)) {
    throw new Error(`Invalid bucket name: "${name}". Only alphanumeric, hyphens, and underscores are allowed.`);
  }
};

const validateStoragePath = (filePath) => {
  if (typeof filePath !== 'string') {
    throw new Error('Storage path must be a string.');
  }

  // Prevent directory traversal attacks
  if (filePath.includes('..') || filePath.startsWith('/') || filePath.startsWith('\\')) {
    throw new Error(`Invalid file path: "${filePath}". Path traversal and root absolute prefixes are blocked.`);
  }

  // Whitelist characters: alphanumeric, hyphens, underscores, dots, and slashes
  if (!/^[a-zA-Z0-9_\-\.\/]+$/.test(filePath)) {
    throw new Error(`Invalid characters in file path: "${filePath}". Only alphanumeric, hyphens, underscores, dots, and slashes are allowed.`);
  }
};

module.exports = {
  validateBucketName,
  validateStoragePath
};
