const fs = require('fs/promises');
const path = require('path');
const StorageProvider = require('./StorageProvider');

const STORAGE_ROOT = path.resolve(process.cwd(), 'uploads', 'storage');

class LocalStorageProvider extends StorageProvider {
  
  _getFilePath(projectId, bucketName, storageKey) {
    return path.join(STORAGE_ROOT, projectId, bucketName, storageKey);
  }

  _getBucketPath(projectId, bucketName) {
    return path.join(STORAGE_ROOT, projectId, bucketName);
  }

  async _pathExists(p) {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  async upload(projectId, bucketName, storageKey, buffer) {
    const fullPath = this._getFilePath(projectId, bucketName, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return `/uploads/storage/${projectId}/${bucketName}/${storageKey}`;
  }

  async delete(projectId, bucketName, storageKey) {
    const fullPath = this._getFilePath(projectId, bucketName, storageKey);
    if (await this._pathExists(fullPath)) {
      await fs.unlink(fullPath);
    }
  }

  async deleteBucket(projectId, bucketName) {
    const bucketFullPath = this._getBucketPath(projectId, bucketName);
    if (await this._pathExists(bucketFullPath)) {
      await fs.rm(bucketFullPath, { recursive: true, force: true });
    }
  }
}

module.exports = LocalStorageProvider;
