const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, tenantId: user.tenantId, roleId: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
  
  return { accessToken };
};

exports.login = async (email, password) => {
  // Find user by email
  const user = await prisma.user.findFirst({
    where: { email },
    include: { tenant: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check password
  const isMatch = await bcrypt.compare(password, user.passwordHash || "");
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  const tokens = generateTokens(user);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant?.organization
    },
    tokens
  };
};

exports.register = async (data) => {
  // Check if user exists
  const existingUser = await prisma.user.findFirst({
    where: { email: data.email }
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      organization: data.tenantName,
      domain: data.tenantName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.kiaan.core'
    }
  });

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 10);

  // Create User
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: data.email,
      passwordHash,
      name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
    }
  });

  const tokens = generateTokens(user);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: tenant.organization
    },
    tokens
  };
};

exports.getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tenantId: user.tenantId,
    tenantName: user.tenant?.organization,
    role: user.role
  };
};

