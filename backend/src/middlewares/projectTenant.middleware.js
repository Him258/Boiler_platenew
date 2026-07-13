const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const encryptionService = require('../core/services/encryption.service');
const { getClientForProject } = require('../modules/project/projectConnection');
const { sendError } = require('../core/response');

/**
 * Middleware to identify the project and attach the dynamic database client
 */
const projectTenantMiddleware = async (req, res, next) => {
  if (req.project) {
    return next();
  }
  try {
    let projectRef = req.headers['x-project-ref'] || req.headers['x-project-id'] || req.params.projectId || req.params.id;
    let apiKey = req.headers['apikey'] || req.query.apikey;
    let bearerToken = null;

    if (!projectRef) {
      const match = req.originalUrl.match(/\/projects\/([^/]+)/);
      if (match) {
        projectRef = match[1];
      }
    }

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      bearerToken = req.headers.authorization.split(' ')[1];
    }

    // Support extracting API key from Authorization header if not provided in apikey
    if (!apiKey && bearerToken) {
      try {
        const decoded = jwt.decode(bearerToken);
        if (decoded && (decoded.role === 'anon' || decoded.role === 'service_role')) {
          apiKey = bearerToken;
        }
      } catch (err) {
        // Ignore decoding errors
      }
    }

    // Support decoding projectId from query token for signed URLs
    let queryToken = req.query.token;
    if (!projectRef && !apiKey && !bearerToken && queryToken) {
      try {
        const decoded = jwt.decode(queryToken);
        if (decoded && (decoded.refId || decoded.projectId)) {
          projectRef = decoded.refId || decoded.projectId;
        }
      } catch (err) {
        // Ignore decoding errors
      }
    }

    let project = null;
    let apiKeyRecord = null;

    // 1. Prioritize API Key identification
    if (apiKey) {
      apiKeyRecord = await prisma.projectApiKey.findUnique({
        where: { keyToken: apiKey },
        include: { project: true }
      });
      if (!apiKeyRecord || !apiKeyRecord.project) {
        return sendError(res, 'Invalid or revoked API key.', 'UNAUTHORIZED', [], 401);
      }
      project = apiKeyRecord.project;
    } 
    // 2. Fallback to x-project-ref/id for backward compatibility
    else if (projectRef) {
      project = await prisma.project.findFirst({
        where: {
          OR: [
            { refId: projectRef },
            { id: projectRef }
          ]
        }
      });
      if (!project) {
        return sendError(res, 'Project not found with the provided identifier.', 'NOT_FOUND', [], 404);
      }
    } 
    // 3. Fallback to token context decoding if present
    else if (bearerToken) {
      try {
        const decoded = jwt.decode(bearerToken);
        if (decoded && (decoded.refId || decoded.projectId)) {
          const lookup = decoded.refId || decoded.projectId;
          project = await prisma.project.findFirst({
            where: {
              OR: [
                { refId: lookup },
                { id: lookup }
              ]
            }
          });
        }
      } catch (err) {
        // Ignore decoding error
      }
    }

    // Add proper logging for signup requests
    if (req.path.includes('signup') || req.originalUrl.includes('signup')) {
      console.log(`[Signup APIKey Log] Received API key exists: ${!!(req.headers['apikey'] || req.query.apikey || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')))}`);
      console.log(`[Signup APIKey Log] Extracted token length: ${apiKey ? apiKey.length : 0}`);
      console.log(`[Signup APIKey Log] Matched project id: ${project ? project.id : 'N/A'}`);
      console.log(`[Signup APIKey Log] Key type: ${apiKeyRecord ? apiKeyRecord.keyType : 'N/A'}`);
    }

    if (!project) {
      return sendError(res, 'Project identification failed. Provide a valid apikey header/parameter or x-project-ref header.', 'BAD_REQUEST', [], 400);
    }

    if (project.status !== 'active') {
      return sendError(res, `Project database is currently ${project.status}. Please contact support.`, 'BAD_REQUEST', [], 400);
    }

    // Decrypt project JWT secret
    let jwtSecret;
    try {
      jwtSecret = encryptionService.decrypt(project.jwtSecretEncrypted);
    } catch (err) {
      console.error(`[ProjectTenantMiddleware] Decryption of JWT secret failed for project ${project.id}:`, err);
      return sendError(res, 'Failed to decrypt project JWT secret.', 'INTERNAL_ERROR', [], 500);
    }

    // Get or create dynamic database client
    let projectDbClient;
    try {
      projectDbClient = getClientForProject(project);
    } catch (err) {
      console.error(`[ProjectTenantMiddleware] Dynamic client initialization failed:`, err);
      return sendError(res, 'Failed to initialize project database connection.', 'INTERNAL_ERROR', [], 500);
    }

    // Attach project configuration to request
    req.project = {
      id: project.id,
      refId: project.refId,
      name: project.name,
      tenantId: project.tenantId,
      jwtSecret,
      client: projectDbClient,
      dbHost: project.dbHost,
      dbPort: project.dbPort,
      dbName: project.dbName,
      dbUsername: project.dbUsername
    };

    next();
  } catch (error) {
    console.error('[ProjectTenantMiddleware] Unexpected error:', error);
    return sendError(res, 'An unexpected error occurred during project identification.', 'INTERNAL_ERROR', [], 500);
  }
};

module.exports = projectTenantMiddleware;
