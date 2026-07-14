/**
 * Debug script: trace the exact projectId resolution for POST /rbac/users/:userId/roles
 * using ONLY a Bearer Project JWT
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api/v1';

async function request(method, path, headers = {}, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  let responseBody = null;
  try { responseBody = await res.json(); } catch (e) {}
  return { status: res.status, body: responseBody };
}

async function run() {
  console.log('=== RBAC User-Role Assignment Debug ===\n');

  // 1. Login as control plane developer
  const loginRes = await request('POST', '/auth/login', {}, {
    email: 'boilerplate@gmail.com',
    password: '123456'
  });
  if (loginRes.status !== 200) throw new Error('Login failed: ' + JSON.stringify(loginRes.body));
  const devToken = loginRes.body.data.tokens.accessToken;
  const devUser = loginRes.body.data.user;
  const authHeaders = { 'Authorization': `Bearer ${devToken}` };
  console.log('✅ Logged in as dev. User ID:', devUser.id);

  // 2. Create test project
  const projRes = await request('POST', '/projects', authHeaders, { name: `DebugProj_${Date.now()}` });
  if (projRes.status !== 201) throw new Error('Failed to create project: ' + JSON.stringify(projRes.body));
  const project = projRes.body.data;
  console.log('✅ Project created. ID:', project.id, '| RefId:', project.refId);

  // 3. Wait for provisioning
  console.log('Waiting 4 seconds for project provisioning...');
  await new Promise(r => setTimeout(r, 4000));

  // 4. Get project details (API keys)
  const projDetailsRes = await request('GET', `/projects/${project.id}`, authHeaders);
  const projDetails = projDetailsRes.body.data;
  const anonKey = projDetails.apiKeys.find(k => k.keyType === 'anon').keyToken;
  console.log('✅ Got anon key:', anonKey.substring(0, 20) + '...');

  // 5. Sign up a project user
  const projUserEmail = `debug_user_${Date.now()}@test.com`;
  const signupRes = await request('POST', '/auth/signup', {
    'x-project-ref': projDetails.refId,
    'apikey': anonKey
  }, { email: projUserEmail, password: 'password123' });
  if (signupRes.status !== 201) throw new Error('Signup failed: ' + JSON.stringify(signupRes.body));
  const projUserId = signupRes.body.data.user.id;
  console.log('✅ Project user signed up. ID (in project DB):', projUserId);

  // 6. Login project user to get Bearer JWT
  const projLoginRes = await request('POST', '/auth/login', {
    'x-project-ref': projDetails.refId,
    'apikey': anonKey
  }, { email: projUserEmail, password: 'password123' });
  if (projLoginRes.status !== 200) throw new Error('Project login failed: ' + JSON.stringify(projLoginRes.body));
  const projectUserToken = projLoginRes.body.data.accessToken;
  console.log('✅ Project user JWT obtained:', projectUserToken.substring(0, 40) + '...');

  // Decode and inspect the JWT
  const parts = projectUserToken.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  console.log('\n📋 JWT Payload:', JSON.stringify(payload, null, 2));

  // 7. Get roles for the project (using dev token + projectId)
  const rolesRes = await request('GET', `/rbac/roles?projectId=${project.id}`, authHeaders);
  const roles = rolesRes.body.data || [];
  console.log('\n📋 Available roles:', roles.map(r => `${r.name}(${r.id})`).join(', '));

  if (roles.length === 0) {
    throw new Error('No roles found for project. Cannot test role assignment.');
  }
  const testRole = roles[0];

  // 8. Create a control-plane user to assign roles to (for testing)
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('testpass123', 10);
  const testCpUser = await prisma.user.create({
    data: {
      tenantId: devUser.tenantId,
      name: 'Debug Test User',
      email: `dbg_cp_${Date.now()}@test.com`,
      passwordHash: hash,
      status: 'Active'
    }
  });
  console.log('\n✅ Control-plane test user created. ID:', testCpUser.id);

  // 9. THE ACTUAL TEST: POST /rbac/users/:userId/roles using ONLY Bearer Project JWT
  console.log('\n🧪 TESTING: POST /rbac/users/:userId/roles with ONLY Bearer JWT (no x-project-ref, no apikey)');
  console.log('   Target userId:', testCpUser.id);
  console.log('   Role to assign:', testRole.name, '|', testRole.id);
  console.log('   Authorization: Bearer', projectUserToken.substring(0, 30) + '...');

  const assignRes = await request(
    'POST',
    `/rbac/users/${testCpUser.id}/roles`,
    { 'Authorization': `Bearer ${projectUserToken}` },
    { roleIds: [testRole.id] }
  );

  console.log('\n📤 RESPONSE STATUS:', assignRes.status);
  console.log('📤 RESPONSE BODY:', JSON.stringify(assignRes.body, null, 2));

  // 10. Cleanup
  console.log('\nCleaning up...');
  await request('DELETE', `/projects/${project.id}`, authHeaders);
  await prisma.user.delete({ where: { id: testCpUser.id } }).catch(() => {});
  console.log('✅ Cleanup done.');

  if (assignRes.status === 201 || assignRes.status === 200) {
    console.log('\n🎉 SUCCESS! POST /rbac/users/:userId/roles returned', assignRes.status);
  } else {
    console.log('\n❌ FAILED! POST /rbac/users/:userId/roles returned', assignRes.status);
    process.exit(1);
  }
}

run().catch(e => {
  console.error('Script error:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
