const prisma = require('../../config/db');
const { getClientForProject } = require('./projectConnection');
const { sendSuccess, sendError } = require('../../core/response');

/**
 * Helper to authorize developer access to the project and return full row.
 * Uses raw SQL to avoid Prisma client DLL lock issues on Windows.
 */
const getAuthorizedProject = async (projectId, tenantId) => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT * FROM `Project` WHERE `id` = ? LIMIT 1',
    projectId
  );
  if (!rows || rows.length === 0) return null;
  const project = rows[0];
  if (project.tenantId !== tenantId) return null;
  return project;
};

// ----------------------------------
// Project Users Management
// ----------------------------------

exports.getUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const search = req.query.search || '';
    const limit = parseInt(req.query.limit || '10', 10);
    const page = parseInt(req.query.page || '1', 10);
    const offset = (page - 1) * limit;

    const dbClient = getClientForProject(project);
    let query = 'SELECT `id`, `email`, `role`, `phone`, `provider`, `email_confirmed`, `status`, `last_login`, `created_at`, `updated_at` FROM `users`';
    let countQuery = 'SELECT COUNT(*) as count FROM `users`';
    let params = [];
    let countParams = [];

    if (search) {
      query += ' WHERE `email` LIKE ? OR `id` LIKE ?';
      countQuery += ' WHERE `email` LIKE ? OR `id` LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY `created_at` DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Cast limit and offset to query parameters safely
    const users = await dbClient.$queryRawUnsafe(query, ...params);
    const totalRes = await dbClient.$queryRawUnsafe(countQuery, ...countParams);
    
    // MySQL returns count as BigInt in some drivers, cast it safely
    const total = totalRes && totalRes.length > 0 ? Number(totalRes[0].count) : 0;

    return sendSuccess(res, 'Users retrieved successfully', { users, total, page, limit });
  } catch (error) {
    console.error('[Console.getUsers] Error:', error);
    return sendError(res, 'Failed to retrieve project users', 'INTERNAL_ERROR', [], 500);
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { status } = req.body; // 'active' or 'suspended'

    if (!status || !['active', 'suspended'].includes(status)) {
      return sendError(res, 'Status must be active or suspended', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const dbClient = getClientForProject(project);
    await dbClient.$executeRawUnsafe(
      'UPDATE `users` SET `status` = ?, `updated_at` = NOW() WHERE `id` = ?',
      status,
      userId
    );

    return sendSuccess(res, `User status updated to ${status}`);
  } catch (error) {
    console.error('[Console.suspendUser] Error:', error);
    return sendError(res, 'Failed to suspend/unsuspend user', 'INTERNAL_ERROR', [], 500);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const dbClient = getClientForProject(project);
    await dbClient.$executeRawUnsafe(
      'UPDATE `users` SET `encrypted_password` = ?, `updated_at` = NOW() WHERE `id` = ?',
      hashedPassword,
      userId
    );

    return sendSuccess(res, 'User password reset successfully');
  } catch (error) {
    console.error('[Console.resetPassword] Error:', error);
    return sendError(res, 'Failed to reset password', 'INTERNAL_ERROR', [], 500);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const dbClient = getClientForProject(project);
    await dbClient.$executeRawUnsafe('DELETE FROM `users` WHERE `id` = ?', userId);

    return sendSuccess(res, 'User deleted successfully');
  } catch (error) {
    console.error('[Console.deleteUser] Error:', error);
    return sendError(res, 'Failed to delete user', 'INTERNAL_ERROR', [], 500);
  }
};

// ----------------------------------
// Project Sessions Management
// ----------------------------------

exports.getSessions = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const dbClient = getClientForProject(project);
    const sessions = await dbClient.$queryRawUnsafe(
      'SELECT s.*, u.email as user_email FROM `sessions` s LEFT JOIN `users` u ON s.user_id = u.id ORDER BY s.created_at DESC'
    );

    // Map fields to standard response structure
    const mapped = sessions.map(s => ({
      id: s.id,
      userId: s.user_id,
      userEmail: s.user_email || 'Unknown User',
      token: s.token,
      ipAddress: s.ip_address || 'Unknown',
      browser: s.browser || 'Unknown',
      device: s.device || 'Unknown',
      createdAt: s.created_at,
      expiresAt: s.expires_at,
      status: new Date(s.expires_at) > new Date() ? 'Active' : 'Expired'
    }));

    return sendSuccess(res, 'Sessions retrieved successfully', { sessions: mapped });
  } catch (error) {
    console.error('[Console.getSessions] Error:', error);
    return sendError(res, 'Failed to retrieve sessions', 'INTERNAL_ERROR', [], 500);
  }
};

exports.terminateSession = async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const dbClient = getClientForProject(project);
    await dbClient.$executeRawUnsafe('DELETE FROM `sessions` WHERE `id` = ?', sessionId);

    return sendSuccess(res, 'Session terminated successfully');
  } catch (error) {
    console.error('[Console.terminateSession] Error:', error);
    return sendError(res, 'Failed to terminate session', 'INTERNAL_ERROR', [], 500);
  }
};

exports.terminateAllSessions = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const dbClient = getClientForProject(project);
    await dbClient.$executeRawUnsafe('DELETE FROM `sessions` WHERE `user_id` = ?', userId);

    return sendSuccess(res, 'All sessions for user terminated successfully');
  } catch (error) {
    console.error('[Console.terminateAllSessions] Error:', error);
    return sendError(res, 'Failed to terminate user sessions', 'INTERNAL_ERROR', [], 500);
  }
};

// ----------------------------------
// Project Providers Configuration
// ----------------------------------

exports.getProviders = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    // Load configurations from control database using raw SQL or Prisma
    const providers = await prisma.$queryRawUnsafe(
      'SELECT * FROM `ProjectAuthProvider` WHERE `projectId` = ?',
      project.id
    );

    return sendSuccess(res, 'Providers retrieved successfully', { providers });
  } catch (error) {
    console.error('[Console.getProviders] Error:', error);
    return sendError(res, 'Failed to retrieve providers config', 'INTERNAL_ERROR', [], 500);
  }
};

exports.saveProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { provider, clientId, clientSecret, isEnabled } = req.body;

    if (!provider) {
      return sendError(res, 'Provider identifier is required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const uuid = require('crypto').randomUUID();

    // Upsert logic using raw SQL to be fully safe from generate DLL lock issues
    const existing = await prisma.$queryRawUnsafe(
      'SELECT id FROM `ProjectAuthProvider` WHERE `projectId` = ? AND `provider` = ? LIMIT 1',
      project.id,
      provider
    );

    if (existing && existing.length > 0) {
      await prisma.$executeRawUnsafe(
        'UPDATE `ProjectAuthProvider` SET `clientId` = ?, `clientSecret` = ?, `isEnabled` = ?, `updatedAt` = NOW() WHERE `id` = ?',
        clientId || null,
        clientSecret || null,
        isEnabled ? 1 : 0,
        existing[0].id
      );
    } else {
      await prisma.$executeRawUnsafe(
        'INSERT INTO `ProjectAuthProvider` (`id`, `projectId`, `provider`, `clientId`, `clientSecret`, `isEnabled`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        uuid,
        project.id,
        provider,
        clientId || null,
        clientSecret || null,
        isEnabled ? 1 : 0
      );
    }

    return sendSuccess(res, 'Provider configuration saved successfully');
  } catch (error) {
    console.error('[Console.saveProvider] Error:', error);
    return sendError(res, 'Failed to save provider configuration', 'INTERNAL_ERROR', [], 500);
  }
};

// ----------------------------------
// Project Email Templates
// ----------------------------------

exports.getEmailTemplates = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const templates = await prisma.$queryRawUnsafe(
      'SELECT * FROM `ProjectEmailTemplate` WHERE `projectId` = ?',
      project.id
    );

    return sendSuccess(res, 'Templates retrieved successfully', { templates });
  } catch (error) {
    console.error('[Console.getEmailTemplates] Error:', error);
    return sendError(res, 'Failed to retrieve email templates', 'INTERNAL_ERROR', [], 500);
  }
};

exports.saveEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { templateType, subject, body } = req.body;

    if (!templateType) {
      return sendError(res, 'Template type is required', 'VALIDATION_ERROR', [], 400);
    }

    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const uuid = require('crypto').randomUUID();

    const existing = await prisma.$queryRawUnsafe(
      'SELECT id FROM `ProjectEmailTemplate` WHERE `projectId` = ? AND `templateType` = ? LIMIT 1',
      project.id,
      templateType
    );

    if (existing && existing.length > 0) {
      await prisma.$executeRawUnsafe(
        'UPDATE `ProjectEmailTemplate` SET `subject` = ?, `body` = ?, `updatedAt` = NOW() WHERE `id` = ?',
        subject || null,
        body || null,
        existing[0].id
      );
    } else {
      await prisma.$executeRawUnsafe(
        'INSERT INTO `ProjectEmailTemplate` (`id`, `projectId`, `templateType`, `subject`, `body`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        uuid,
        project.id,
        templateType,
        subject || null,
        body || null
      );
    }

    return sendSuccess(res, 'Template saved successfully');
  } catch (error) {
    console.error('[Console.saveEmailTemplate] Error:', error);
    return sendError(res, 'Failed to save email template', 'INTERNAL_ERROR', [], 500);
  }
};

// ----------------------------------
// Project JWT Settings
// ----------------------------------

exports.getJwtSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const encryptionService = require('../../core/services/encryption.service');
    const decryptedSecret = encryptionService.decrypt(project.jwtSecretEncrypted);
    const maskedSecret = decryptedSecret 
      ? `${decryptedSecret.substring(0, 4)}****************${decryptedSecret.substring(decryptedSecret.length - 4)}` 
      : '****************';

    return sendSuccess(res, 'JWT settings retrieved successfully', {
      jwtExpiresIn: project.jwtExpiresIn,
      jwtRefreshExpiresIn: project.jwtRefreshExpiresIn,
      jwtIssuer: project.jwtIssuer,
      jwtAudience: project.jwtAudience,
      maskedSecret
    });
  } catch (error) {
    console.error('[Console.getJwtSettings] Error:', error);
    return sendError(res, 'Failed to retrieve JWT settings', 'INTERNAL_ERROR', [], 500);
  }
};

exports.saveJwtSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { jwtExpiresIn, jwtRefreshExpiresIn, jwtIssuer, jwtAudience } = req.body;

    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    await prisma.$executeRawUnsafe(
      'UPDATE `Project` SET `jwtExpiresIn` = ?, `jwtRefreshExpiresIn` = ?, `jwtIssuer` = ?, `jwtAudience` = ?, `updatedAt` = NOW() WHERE `id` = ?',
      parseInt(jwtExpiresIn || '3600', 10),
      parseInt(jwtRefreshExpiresIn || '604800', 10),
      jwtIssuer || 'kiaan-auth',
      jwtAudience || 'kiaan-users',
      project.id
    );

    return sendSuccess(res, 'JWT settings saved successfully');
  } catch (error) {
    console.error('[Console.saveJwtSettings] Error:', error);
    return sendError(res, 'Failed to save JWT settings', 'INTERNAL_ERROR', [], 500);
  }
};

exports.rotateJwtSecret = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const crypto = require('crypto');
    const encryptionService = require('../../core/services/encryption.service');
    const newSecret = crypto.randomBytes(32).toString('hex');
    const newSecretEncrypted = encryptionService.encrypt(newSecret);

    await prisma.$executeRawUnsafe(
      'UPDATE `Project` SET `jwtSecretEncrypted` = ?, `updatedAt` = NOW() WHERE `id` = ?',
      newSecretEncrypted,
      project.id
    );

    const maskedSecret = `${newSecret.substring(0, 4)}****************${newSecret.substring(newSecret.length - 4)}`;
    return sendSuccess(res, 'JWT secret rotated successfully', { maskedSecret });
  } catch (error) {
    console.error('[Console.rotateJwtSecret] Error:', error);
    return sendError(res, 'Failed to rotate JWT secret', 'INTERNAL_ERROR', [], 500);
  }
};

// ----------------------------------
// Project Audit Logs
// ----------------------------------

exports.getAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getAuthorizedProject(id, req.user.tenantId);
    if (!project) {
      return sendError(res, 'Project not found or access denied', 'FORBIDDEN', [], 403);
    }

    const dbClient = getClientForProject(project);
    const logs = await dbClient.$queryRawUnsafe(
      'SELECT `id`, `user_id` as userId, `email`, `action`, `ip_address` as ipAddress, `device`, `status`, `created_at` as createdAt FROM `auth_audit_logs` ORDER BY `created_at` DESC LIMIT 100'
    );

    return sendSuccess(res, 'Audit logs retrieved successfully', { logs });
  } catch (error) {
    console.error('[Console.getAuditLogs] Error:', error);
    return sendError(res, 'Failed to retrieve audit logs', 'INTERNAL_ERROR', [], 500);
  }
};
