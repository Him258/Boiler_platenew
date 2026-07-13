  const { PrismaClient } = require('@prisma/client');
  const encryptionService = require('../../core/services/encryption.service');

  const clientCache = new Map();

  /**
   * Gets or creates a dynamic Prisma client for a project
   * @param {Object} project - The raw project row from control database
   */
  exports.getClientForProject = (project) => {
    if (clientCache.has(project.id)) {
      return clientCache.get(project.id);
    }

    // Decrypt DB credentials
    let dbPassword;
    try {
      dbPassword = encryptionService.decrypt(project.dbPasswordEncrypted);
    } catch (err) {
      console.error(`[projectConnection] Failed to decrypt database password for project ${project.id}:`, err);
      throw new Error('Database credentials decryption failed');
    }

    const dbUrl = `mysql://${project.dbUsername}:${dbPassword}@${project.dbHost}:${project.dbPort}/${project.dbName}`;

    console.log(`[projectConnection] Initializing dynamic Prisma Client for project: ${project.name} (${project.refId})`);
    const client = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl
        }
      }
    });

    clientCache.set(project.id, client);
    return client;
  };

  /**
   * Closes and removes a cached client if a project is deleted or updated
   * @param {string} projectId 
   */
  exports.removeClient = async (projectId) => {
    if (clientCache.has(projectId)) {
      const client = clientCache.get(projectId);
      try {
        await client.$disconnect();
        console.log(`[projectConnection] Disconnected dynamic client for project: ${projectId}`);
      } catch (err) {
        console.error(`[projectConnection] Failed to disconnect dynamic client for project ${projectId}:`, err);
      }
      clientCache.delete(projectId);
    }
  };
