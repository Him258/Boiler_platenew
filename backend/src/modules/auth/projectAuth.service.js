const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate user JWT access token signed with project specific secret
 */
const generateAccessToken = (user, project) => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role || 'authenticated',
      projectId: project.id,
      refId: project.refId
    },
    project.jwtSecret,
    { expiresIn: '1h' } // 1 hour access token expiration
  );
};

/**
 * Helper to log authentication events in project's own DB
 */
const logAuthEvent = async (client, { userId, email, action, ipAddress, device, status }) => {
  try {
    const id = crypto.randomUUID();
    await client.$executeRawUnsafe(
      'INSERT INTO `auth_audit_logs` (`id`, `user_id`, `email`, `action`, `ip_address`, `device`, `status`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      id,
      userId || null,
      email || null,
      action,
      ipAddress || null,
      device || null,
      status
    );
  } catch (err) {
    console.error('[projectAuth.service:logAuthEvent] Failed to log event:', err);
  }
};

/**
 * Service to execute project-specific database authentication operations
 */
exports.signup = async (project, { email, password }, meta = {}) => {
  const client = project.client;

  try {
    // 1. Check if user already exists
    const existingUsers = await client.$queryRawUnsafe(
      'SELECT * FROM `users` WHERE `email` = ? LIMIT 1',
      email
    );

    if (existingUsers && existingUsers.length > 0) {
      throw new Error('User already exists');
    }

    // 2. Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    // 3. Insert user into project's users table
    await client.$executeRawUnsafe(
      'INSERT INTO `users` (`id`, `email`, `encrypted_password`, `role`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, NOW(), NOW())',
      userId,
      email,
      hashedPassword,
      'authenticated'
    );

    // 4. Generate tokens
    const userObj = {
      id: userId,
      email,
      role: 'authenticated',
      created_at: new Date(),
      updated_at: new Date()
    };

    const accessToken = generateAccessToken(userObj, project);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const sessionId = crypto.randomUUID();

    // Refresh token expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. Store session in project's sessions table
    await client.$executeRawUnsafe(
      'INSERT INTO `sessions` (`id`, `user_id`, `token`, `ip_address`, `browser`, `device`, `created_at`, `expires_at`) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)',
      sessionId,
      userId,
      refreshToken,
      meta.ipAddress || null,
      meta.browser || null,
      meta.device || null,
      expiresAt
    );

    // Log success signup event
    await logAuthEvent(client, {
      userId,
      email,
      action: 'signup',
      ipAddress: meta.ipAddress,
      device: meta.browser && meta.device ? `${meta.browser} on ${meta.device}` : 'Unknown Client',
      status: 'success'
    });

    return {
      user: {
        id: userObj.id,
        email: userObj.email,
        role: userObj.role,
        createdAt: userObj.created_at,
        updatedAt: userObj.updated_at
      },
      accessToken,
      refreshToken
    };
  } catch (error) {
    // Log failed signup event
    await logAuthEvent(client, {
      email,
      action: 'signup',
      ipAddress: meta.ipAddress,
      device: meta.browser && meta.device ? `${meta.browser} on ${meta.device}` : 'Unknown Client',
      status: 'failed'
    });
    throw error;
  }
};

exports.login = async (project, { email, password }, meta = {}) => {
  const client = project.client;

  try {
    // 1. Find user in project database
    const users = await client.$queryRawUnsafe(
      'SELECT * FROM `users` WHERE `email` = ? LIMIT 1',
      email
    );

    if (!users || users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const userObj = users[0];

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, userObj.encrypted_password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // 3. Update lastLogin
    await client.$executeRawUnsafe(
      'UPDATE `users` SET `last_login` = NOW(), `updated_at` = NOW() WHERE `id` = ?',
      userObj.id
    );

    // 4. Generate tokens
    const accessToken = generateAccessToken(userObj, project);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const sessionId = crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. Store new session in project sessions table
    await client.$executeRawUnsafe(
      'INSERT INTO `sessions` (`id`, `user_id`, `token`, `ip_address`, `browser`, `device`, `created_at`, `expires_at`) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)',
      sessionId,
      userObj.id,
      refreshToken,
      meta.ipAddress || null,
      meta.browser || null,
      meta.device || null,
      expiresAt
    );

    // Log success login event
    await logAuthEvent(client, {
      userId: userObj.id,
      email: userObj.email,
      action: 'login',
      ipAddress: meta.ipAddress,
      device: meta.browser && meta.device ? `${meta.browser} on ${meta.device}` : 'Unknown Client',
      status: 'success'
    });

    return {
      user: {
        id: userObj.id,
        email: userObj.email,
        role: userObj.role,
        lastLogin: new Date(),
        createdAt: userObj.created_at,
        updatedAt: userObj.updated_at
      },
      accessToken,
      refreshToken
    };
  } catch (error) {
    // Log failed login event
    await logAuthEvent(client, {
      email,
      action: 'login',
      ipAddress: meta.ipAddress,
      device: meta.browser && meta.device ? `${meta.browser} on ${meta.device}` : 'Unknown Client',
      status: 'failed'
    });
    throw error;
  }
};

exports.logout = async (project, refreshToken, meta = {}) => {
  const client = project.client;

  // 1. Find session before deleting to log who logged out
  const sessions = await client.$queryRawUnsafe(
    'SELECT * FROM `sessions` WHERE `token` = ? LIMIT 1',
    refreshToken
  );

  if (!sessions || sessions.length === 0) {
    throw new Error('Session not found or already logged out');
  }

  const session = sessions[0];

  const users = await client.$queryRawUnsafe(
    'SELECT `email` FROM `users` WHERE `id` = ? LIMIT 1',
    session.user_id
  );
  const email = users && users.length > 0 ? users[0].email : null;

  // 2. Delete the session record
  await client.$executeRawUnsafe(
    'DELETE FROM `sessions` WHERE `id` = ?',
    session.id
  );

  // Log logout event
  await logAuthEvent(client, {
    userId: session.user_id,
    email,
    action: 'logout',
    ipAddress: meta.ipAddress,
    device: meta.browser && meta.device ? `${meta.browser} on ${meta.device}` : 'Unknown Client',
    status: 'success'
  });

  return { success: true };
};

exports.refresh = async (project, refreshToken, meta = {}) => {
  const client = project.client;

  // 1. Find session in project sessions table
  const sessions = await client.$queryRawUnsafe(
    'SELECT * FROM `sessions` WHERE `token` = ? LIMIT 1',
    refreshToken
  );

  if (!sessions || sessions.length === 0) {
    throw new Error('Invalid or expired refresh token');
  }

  const session = sessions[0];

  // 2. Verify expiration
  if (new Date(session.expires_at) < new Date()) {
    // Session has expired, clean it up
    await client.$executeRawUnsafe(
      'DELETE FROM `sessions` WHERE `id` = ?',
      session.id
    );
    throw new Error('Refresh token has expired');
  }

  // 3. Find user in project users table
  const users = await client.$queryRawUnsafe(
    'SELECT * FROM `users` WHERE `id` = ? LIMIT 1',
    session.user_id
  );

  if (!users || users.length === 0) {
    throw new Error('User not found');
  }

  const userObj = users[0];

  // 4. Token Rotation: generate new Access and Refresh tokens
  const newAccessToken = generateAccessToken(userObj, project);
  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 7);

  // 5. Invalidate old refresh token by updating the session row with the new one
  await client.$executeRawUnsafe(
    'UPDATE `sessions` SET `token` = ?, `ip_address` = ?, `browser` = ?, `device` = ?, `expires_at` = ? WHERE `id` = ?',
    newRefreshToken,
    meta.ipAddress || null,
    meta.browser || null,
    meta.device || null,
    newExpiresAt,
    session.id
  );

  // Log refresh event
  await logAuthEvent(client, {
    userId: userObj.id,
    email: userObj.email,
    action: 'refresh',
    ipAddress: meta.ipAddress,
    device: meta.browser && meta.device ? `${meta.browser} on ${meta.device}` : 'Unknown Client',
    status: 'success'
  });

  return {
    user: {
      id: userObj.id,
      email: userObj.email,
      role: userObj.role
    },
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
};
