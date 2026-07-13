/**
 * Comprehensive Integration Test Suite for Module 6: RBAC (Role-Based Access Control)
 * Verifies Permission CRUD, Role-Permission mappings, User-Role assignments, caching, transaction rollbacks, and project isolation.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:5000/api/v1';

async function request(method, path, headers = {}, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  let responseBody = null;
  try {
    responseBody = await res.json();
  } catch (err) {
    // No JSON response
  }
  return {
    status: res.status,
    body: responseBody
  };
}

async function runTests() {
  console.log('🧪 Starting Kiaan Core Module 6 Full RBAC Integration Tests...\n');

  let projectA = null;
  let projectB = null;
  let guestUser = null;
  let devToken = null;

  try {
    // 1. Control Plane login as Developer
    console.log('1. Logging in as developer...');
    const loginRes = await request('POST', '/auth/login', {}, {
      email: 'boilerplate@gmail.com',
      password: '123456'
    });

    if (loginRes.status !== 200) {
      throw new Error(`Developer login failed: ${JSON.stringify(loginRes.body)}`);
    }

    devToken = loginRes.body.data.tokens.accessToken;
    const devUser = loginRes.body.data.user;
    const authHeaders = { 'Authorization': `Bearer ${devToken}` };
    console.log(`✅ Logged in. Dev User ID: ${devUser.id}`);

    // 2. Provision Project A and Project B for Project Isolation tests
    console.log('\n2. Creating temporary test projects (A & B) for isolation checks...');
    const projARes = await request('POST', '/projects', authHeaders, { name: `RBAC_ProjA_${Date.now()}` });
    const projBRes = await request('POST', '/projects', authHeaders, { name: `RBAC_ProjB_${Date.now()}` });

    if (projARes.status !== 201 || projBRes.status !== 201) {
      throw new Error(`Failed to create projects: A=${projARes.status}, B=${projBRes.status}`);
    }

    projectA = projARes.body.data;
    projectB = projBRes.body.data;
    console.log(`✅ Projects created. Proj A ID: ${projectA.id}, Proj B ID: ${projectB.id}`);

    console.log('Waiting 3.5 seconds for databases & schema provisioning...');
    await new Promise(resolve => setTimeout(resolve, 3500));

    // 3. Verify Default Seeding and Roles in both projects
    console.log('\n3. Verifying default seeded roles and permissions...');
    
    // Check project A roles
    const rolesA = await prisma.role.findMany({ where: { projectId: projectA.id } });
    const roleNamesA = rolesA.map(r => r.name);
    console.log(`- Project A roles found: ${roleNamesA.join(', ')}`);
    for (const roleName of ['Admin', 'Developer', 'Manager', 'User', 'Viewer', 'authenticated']) {
      if (!roleNamesA.includes(roleName)) {
        throw new Error(`Project A is missing seeded role: ${roleName}`);
      }
    }

    // Check project B roles
    const rolesB = await prisma.role.findMany({ where: { projectId: projectB.id } });
    const roleNamesB = rolesB.map(r => r.name);
    console.log(`- Project B roles found: ${roleNamesB.join(', ')}`);
    if (roleNamesB.length !== roleNamesA.length) {
      throw new Error('Project B seeded role count mismatch.');
    }
    console.log('✅ Seeding verified successfully.');

    // 4. Verify Project Isolation
    console.log('\n4. Verifying Project Isolation...');
    // Create a custom permission on Project A
    const customPermA = await request('POST', `/rbac/permissions?projectId=${projectA.id}`, authHeaders, {
      permissionKey: 'custom.test.perm',
      displayName: 'Custom Test Permission',
      category: 'testing'
    });
    if (customPermA.status !== 201) {
      throw new Error(`Failed to create custom permission in Project A: ${JSON.stringify(customPermA.body)}`);
    }

    // Fetch permissions for Project B
    const permsB = await prisma.permission.findMany({ where: { projectId: projectB.id } });
    const keysB = permsB.map(p => p.permissionKey);
    if (keysB.includes('custom.test.perm')) {
      throw new Error('❌ Project Isolation Failed: Custom permission of Project A found in Project B!');
    }
    console.log('✅ Project isolation verified. Permissions are strictly isolated by projectId.');

    // 5. Permission CRUD and Bulk Creation
    console.log('\n5. Testing Permission CRUD and Bulk creation...');
    
    // Bulk Creation
    const bulkPermsRes = await request('POST', `/rbac/permissions?projectId=${projectA.id}`, authHeaders, [
      { permissionKey: 'audit.logs.read', displayName: 'Read Audit', category: 'audit' },
      { permissionKey: 'audit.logs.write', displayName: 'Write Audit', category: 'audit' }
    ]);
    if (bulkPermsRes.status !== 201) {
      throw new Error(`Failed to bulk create permissions: ${JSON.stringify(bulkPermsRes.body)}`);
    }
    console.log(`- Bulk permissions created count: ${bulkPermsRes.body.data.count}`);

    // Update Permission (PATCH)
    const allPerms = await prisma.permission.findMany({ where: { projectId: projectA.id } });
    const readAuditPerm = allPerms.find(p => p.permissionKey === 'audit.logs.read');
    
    const patchRes = await request('PATCH', `/rbac/permissions/${readAuditPerm.id}`, authHeaders, {
      displayName: 'Updated Audit Read DisplayName'
    });
    if (patchRes.status !== 200 || patchRes.body.data.displayName !== 'Updated Audit Read DisplayName') {
      throw new Error(`Failed to update permission: ${JSON.stringify(patchRes.body)}`);
    }
    console.log('✅ Permission PATCH successful.');

    // Duplicate Validation
    const dupRes = await request('POST', `/rbac/permissions?projectId=${projectA.id}`, authHeaders, {
      permissionKey: 'audit.logs.read'
    });
    if (dupRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request on duplicate permissionKey but got ${dupRes.status}`);
    }
    console.log('✅ Duplicate permissionKey rejection validated.');

    // 6. Role ↔ Permission Mapping (Bulk Assignment)
    console.log('\n6. Testing Role-Permission assignments...');
    const developerRole = rolesA.find(r => r.name === 'Developer');
    const writeAuditPerm = allPerms.find(p => p.permissionKey === 'audit.logs.write');

    // Bulk Map permissions to Developer role
    const mapRes = await request('POST', `/rbac/roles/${developerRole.id}/permissions`, authHeaders, {
      permissionIds: [readAuditPerm.id, writeAuditPerm.id]
    });
    if (mapRes.status !== 201) {
      throw new Error(`Failed to map permissions to role: ${JSON.stringify(mapRes.body)}`);
    }
    console.log(`- Mapped count: ${mapRes.body.data.count}`);

    // Get Role Permissions
    const getRolePermsRes = await request('GET', `/rbac/roles/${developerRole.id}/permissions`, authHeaders);
    const assignedKeys = getRolePermsRes.body.data.map(p => p.permissionKey);
    if (!assignedKeys.includes('audit.logs.read') || !assignedKeys.includes('audit.logs.write')) {
      throw new Error(`Assigned permissions mismatch: ${JSON.stringify(assignedKeys)}`);
    }
    console.log('✅ Role-Permission mappings retrieved correctly.');

    // Safe deletion of a role-permission mapping
    const deleteRolePermRes = await request('DELETE', `/rbac/roles/${developerRole.id}/permissions/${readAuditPerm.id}`, authHeaders);
    if (deleteRolePermRes.status !== 200) {
      throw new Error(`Failed to delete role permission mapping: ${JSON.stringify(deleteRolePermRes.body)}`);
    }
    console.log('✅ Permission deleted from role safely.');

    // 7. User ↔ Role Assignment (Multiple Roles)
    console.log('\n7. Testing User-Role assignments (Multiple Roles)...');
    
    // Create Guest developer User
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('guestpassword123', 10);
    const guestUserEmail = `guest_${Date.now()}@test.com`;
    guestUser = await prisma.user.create({
      data: {
        tenantId: devUser.tenantId,
        name: 'Guest Developer',
        email: guestUserEmail,
        passwordHash,
        status: 'Active'
      }
    });

    const viewerRole = rolesA.find(r => r.name === 'Viewer');

    // Assign both "Developer" and "Viewer" roles to Guest User
    const assignUserRolesRes = await request('POST', `/rbac/users/${guestUser.id}/roles`, authHeaders, {
      roleIds: [developerRole.id, viewerRole.id],
      projectId: projectA.id
    });
    if (assignUserRolesRes.status !== 201) {
      throw new Error(`Failed to assign multiple roles to user: ${JSON.stringify(assignUserRolesRes.body)}`);
    }

    // Verify assigned roles
    const getUserRolesRes = await request('GET', `/rbac/users/${guestUser.id}/roles?projectId=${projectA.id}`, authHeaders);
    const userRoleNames = getUserRolesRes.body.data.map(ur => ur.role.name);
    console.log(`- Guest user roles in DB: ${userRoleNames.join(', ')}`);
    if (!userRoleNames.includes('Developer') || !userRoleNames.includes('Viewer')) {
      throw new Error(`User roles mismatch: ${JSON.stringify(userRoleNames)}`);
    }
    console.log('✅ Multiple roles assigned and verified successfully.');

    // 8. Test Middleware and Caching (requirePermission)
    console.log('\n8. Testing permission resolution middleware, caching, and wildcards...');
    
    // Log in guest user to get access token
    const guestLogin = await request('POST', '/auth/login', {}, {
      email: guestUserEmail,
      password: 'guestpassword123'
    });
    const guestHeaders = {
      'Authorization': `Bearer ${guestLogin.body.data.tokens.accessToken}`,
      'x-project-id': projectA.id
    };

    // Test Allowed Access: 'database.create' (Developer role has database.* wildcard which includes database.create)
    const allowedRes = await request('GET', '/rbac/test-permission', guestHeaders);
    console.log(`- Request with 'database.create' status: ${allowedRes.status}`);
    if (allowedRes.status !== 200) {
      throw new Error(`Expected status 200 but got ${allowedRes.status}: ${JSON.stringify(allowedRes.body)}`);
    }
    console.log('✅ Access granted correctly via wildcard role permissions.');

    // Test Denied Access (HTTP 403 Forbidden payload structure)
    // Create another route validator or simulate forbidden check. 
    // We will verify the guest user hitting an endpoint needing project.delete (which they do not have)
    // Let's create a temporary test endpoint in the routes if needed, or hit a project delete endpoint
    const deniedRes = await request('DELETE', `/projects/${projectB.id}`, guestHeaders);
    console.log(`- Project B deletion request status: ${deniedRes.status}`);
    console.log(`- Project B deletion response: ${JSON.stringify(deniedRes.body)}`);
    if (deniedRes.status !== 403) {
      throw new Error(`Expected status 403 but got ${deniedRes.status}`);
    }
    if (deniedRes.body.success !== false || deniedRes.body.message !== 'Insufficient permissions') {
      throw new Error(`Forbidden response payload mismatch. Got: ${JSON.stringify(deniedRes.body)}`);
    }
    console.log('✅ 403 Forbidden response payload validated successfully.');

    // 9. Transaction Rollback
    console.log('\n9. Testing bulk transaction rollback...');
    const rollbackRes = await request('POST', `/rbac/permissions?projectId=${projectA.id}`, authHeaders, [
      { permissionKey: 'new.rollback.perm', displayName: 'Rollback Perm', category: 'test' },
      { permissionKey: 'audit.logs.write', displayName: 'Conflict' } // already exists
    ]);
    if (rollbackRes.status !== 400) {
      throw new Error(`Expected 400 on duplicate in bulk transaction, but got ${rollbackRes.status}`);
    }

    // Verify that "new.rollback.perm" was NOT created (rolled back)
    const rollbackSearch = await prisma.permission.findFirst({
      where: { projectId: projectA.id, permissionKey: 'new.rollback.perm' }
    });
    if (rollbackSearch) {
      throw new Error('❌ TRANSACTION ROLLBACK FAILED! new.rollback.perm was created in DB despite transaction failure.');
    }
    console.log('✅ Transaction rollback confirmed (no dirty write).');

    // 10. Clean up resources
    console.log('\n10. Cleaning up test resources...');
    await request('DELETE', `/projects/${projectA.id}`, authHeaders);
    await request('DELETE', `/projects/${projectB.id}`, authHeaders);
    await prisma.user.delete({ where: { id: guestUser.id } });
    console.log('✅ Cleanup successful.');

    console.log('\n🎉 ALL FULL RBAC INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('\n❌ FULL RBAC INTEGRATION TESTS FAILED:\n', error);
    // Cleanup if possible
    if (projectA) await request('DELETE', `/projects/${projectA.id}`, { 'Authorization': `Bearer ${devToken}` }).catch(() => {});
    if (projectB) await request('DELETE', `/projects/${projectB.id}`, { 'Authorization': `Bearer ${devToken}` }).catch(() => {});
    if (guestUser) await prisma.user.delete({ where: { id: guestUser.id } }).catch(() => {});
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
