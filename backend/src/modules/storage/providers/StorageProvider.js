/**
 * Base Storage Provider Interface
 * All storage providers (LocalStorage, S3, R2, etc.) must implement this interface.
 */
class StorageProvider {
  /**
   * Uploads a file buffer to storage.
   * @param {string} projectId 
   * @param {string} bucketName 
   * @param {string} storageKey Unique physical path/identifier
   * @param {Buffer} buffer 
   * @returns {Promise<string>} The physical path or URL
   */
  async upload(projectId, bucketName, storageKey, buffer) {
    throw new Error('upload() must be implemented');
  }

  /**
   * Deletes a file from storage.
   * @param {string} projectId 
   * @param {string} bucketName 
   * @param {string} storageKey 
   */
  async delete(projectId, bucketName, storageKey) {
    throw new Error('delete() must be implemented');
  }

  /**
   * Deletes a bucket completely (and all files inside it).
   * @param {string} projectId 
   * @param {string} bucketName 
   */
  async deleteBucket(projectId, bucketName) {
    throw new Error('deleteBucket() must be implemented');
  }
}

module.exports = StorageProvider;
