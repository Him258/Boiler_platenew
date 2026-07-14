/**
 * Diagnostic script - inspect the exact state of:
 * - User c1568321-8de7-40e3-b887-9f7eefb83150
 * - Role 071c09a8-e8f0-493c-a417-5596e9046e58
 * - JWT structure from login
 * - What resolveProjectId returns
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000/api/v1';
const TARGET_USER_ID = 'c1568321-8de7-40e3-b887-9f7eefb83150';
const TARGET_ROLE_ID = '071c09a8-e8f0-493c-a417-5596e9046e58';

async function request(method, path, headers = {}, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  let responseBody = null;
  try { responseBody = await res.json(); } catch (e) {}
  return { status: res.status, body: responseBody };
}

async function run() {
  console.log('=== FULL DIAGNOSTIC ===\n');

  // 1. Inspect target user in DB
  console.log('--- 1. Target User in DB ---');
  const dbUser = await prisma.user.findUnique({ where: { id: TARGET_USER_ID }, include: { tenant: true } });
  if (dbUser) {
    console.log('User found:', JSON.stringify({
      id: dbUser.id, email: dbUser.email, tenantId: dbUser.tenantId, role: dbUser.role, status: dbUser.status
    }, null, 2));
  } else {
    console.log('❌ User NOT found in control-plane DB');
  }

  // 2. Inspect target role in DB
  console.log('\n--- 2. Target Role in DB ---');
  const dbRole = await prisma.role.findUnique({ where: { id: TARGET_ROLE_ID } });
  if (dbRole) {
    console.log('Role found:', JSON.stringify({
      id: dbRole.id, name: dbRole.name, roleName: dbRole.roleName, projectId: dbRole.projectId, tenantId: dbRole.tenantId
    }, null, 2));
  } else {
    console.log('❌ Role NOT found in control-plane DB');
  }

  // 3. Existing UserRoles for this user
  console.log('\n--- 3. Existing UserRoles for Target User ---');
  const userRoles = await prisma.userRole.findMany({ where: { userId: TARGET_USER_ID }, include: { role: true } });
  if (userRoles.length > 0) {
    userRoles.forEach(ur => console.log(`  UserRole: roleId=${ur.roleId}, projectId=${ur.projectId}, role.name=${ur.role.name}`));
  } else {
    console.log('  No existing user roles');
  }

  // 4. Login as the developer and decode JWT
  console.log('\n--- 4. Login and JWT Decode ---');
  const loginRes = await request('POST', '/auth/login', {}, { email: 'boilerplate@gmail.com', password: '123456' });
  if (loginRes.status !== 200) { console.log('❌ Login failed:', JSON.stringify(loginRes.body)); return; }
  const devToken = loginRes.body.data.tokens.accessToken;
  const devUser = loginRes.body.data.user;
  console.log('Logged in as:', devUser.id, devUser.email);
  
  const jwtParts = devToken.split('.');
  const decodedPayload = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString());
  console.log('JWT Payload (decoded):', JSON.stringify(decodedPayload, null, 2));
  console.log('Has userId?', !!decodedPayload.userId);
  console.log('Has projectId?', !!decodedPayload.projectId);
  console.log('Has refId?', !!decodedPayload.refId);
  console.log('Has sub?', !!decodedPayload.sub);

  // 5. Simulate resolveProjectId logic
  console.log('\n--- 5. Simulating resolveProjectId ---');
  // No req.project (control-plane token has no projectId/refId in JWT)
  const pId = decodedPayload.projectId || decodedPayload.refId || null;
  console.log('Extracted projectId from JWT:', pId);
  console.log('req.user.projectId would be:', decodedPayload.projectId || '(undefined)');
  console.log('=> resolveProjectId would return:', pId || 'null ← THIS IS THE BUG');

  // 6. Role's own projectId
  console.log('\n--- 6. Role projectId for assignment ---');
  if (dbRole && dbRole.projectId) {
    console.log('Role has projectId:', dbRole.projectId);
    console.log('=> We can use role.projectId as fallback!');
  } else if (dbRole) {
    console.log('Role has no projectId (global/tenantId):', dbRole.tenantId);
  }

  // 7. Actual API call - POST /rbac/users/:userId/roles with dev token
  console.log('\n--- 7. Actual API Call ---');
  const authHeaders = { 'Authorization': `Bearer ${devToken}` };
  console.log('Request: POST /rbac/users/' + TARGET_USER_ID + '/roles');
  console.log('Body:', JSON.stringify({ roleIds: [TARGET_ROLE_ID] }));
  
  const assignRes = await request('POST', `/rbac/users/${TARGET_USER_ID}/roles`, authHeaders, { roleIds: [TARGET_ROLE_ID] });
  console.log('Response status:', assignRes.status);
  console.log('Response body:', JSON.stringify(assignRes.body, null, 2));

  // 8. Check what project that role belongs to
  if (dbRole && dbRole.projectId) {
    console.log('\n--- 8. Project for Role ---');
    const proj = await prisma.project.findUnique({ where: { id: dbRole.projectId } });
    if (proj) console.log('Project:', JSON.stringify({ id: proj.id, refId: proj.refId, name: proj.name, status: proj.status }, null, 2));
    else console.log('Project NOT found for id:', dbRole.projectId);
  }
}

run().catch(e => {
  console.error('Script error:', e.message, e.stack);
}).finally(() => prisma.$disconnect());
