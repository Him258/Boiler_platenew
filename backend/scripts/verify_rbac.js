/**
 * Integration Test Suite for Module 6: RBAC (Role-Based Access Control)
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
  console.log('🧪 Starting Kiaan Core Module 6 RBAC Integration Tests...\n');

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

    const devToken = loginRes.body.data.tokens.accessToken;
    const devUser = loginRes.body.data.user;
    const authHeaders = { 'Authorization': `Bearer ${devToken}` };
    console.log(`✅ Logged in. Dev User ID: ${devUser.id}`);

    // 2. Create new project to trigger Admin role creation & default permissions seeding
    const projName = `RBAC_Project_${Date.now()}`;
    console.log(`\n2. Creating temporary test project: ${projName}...`);
    const projRes = await request('POST', '/projects', authHeaders, {
      name: projName
    });

    if (projRes.status !== 201) {
      throw new Error(`Failed to create project: ${JSON.stringify(projRes.body)}`);
    }

    const project = projRes.body.data;
    console.log(`✅ Project created. ID: ${project.id}`);
    
    console.log('Waiting 3 seconds for database and schema setup...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Verify Admin role auto-creation and seeding
    console.log('\n3. Verifying default database state...');
    
    // Check if the 10 default permissions are present
    const seededPerms = await prisma.permission.findMany({
      where: {
        resource: { in: ['database', 'storage', 'users', 'roles', 'project'] }
      }
    });
    console.log(`- Total permissions present in DB: ${seededPerms.length}`);
    if (seededPerms.length < 10) {
      throw new Error('Default permissions were not seeded.');
    }

    // Check if the Admin role exists for this project
    const adminRole = await prisma.role.findFirst({
      where: { projectId: project.id, name: 'Admin' }
    });
    if (!adminRole) {
      throw new Error('Default Admin role was not created for the project.');
    }
    console.log(`- Project Admin role found: ${adminRole.id}`);

    // Check if project creator is assigned to Admin role
    const ownerRoleMapping = await prisma.userRole.findFirst({
      where: {
        userId: devUser.id,
        roleId: adminRole.id,
        projectId: project.id
      }
    });
    if (!ownerRoleMapping) {
      throw new Error('Project creator was not automatically assigned to Admin role.');
    }
    console.log(`- Project creator UserRole mapping found: ${ownerRoleMapping.id}`);

    // 4. Create custom Role: "Writer"
    console.log('\n4. Creating custom role "Writer"...');
    const createRoleRes = await request('POST', '/rbac/roles', authHeaders, {
      projectId: project.id,
      name: 'Writer',
      description: 'Role with database creation capability'
    });

    if (createRoleRes.status !== 201) {
      throw new Error(`Failed to create custom role: ${JSON.stringify(createRoleRes.body)}`);
    }
    const writerRole = createRoleRes.body.data;
    console.log(`- Custom role created: ${writerRole.name} (ID: ${writerRole.id})`);

    // 5. Assign permission "database.create" to "Writer"
    console.log('\n5. Assigning "database.create" permission to "Writer" role...');
    // Find permission ID for database.create
    const createDbPerm = await prisma.permission.findFirst({
      where: { resource: 'database', action: 'create' }
    });
    if (!createDbPerm) {
      throw new Error('Could not find database.create permission in DB.');
    }

    const assignPermRes = await request('POST', `/rbac/roles/${writerRole.id}/permissions`, authHeaders, {
      permissionId: createDbPerm.id
    });
    if (assignPermRes.status !== 201) {
      throw new Error(`Failed to assign permission: ${JSON.stringify(assignPermRes.body)}`);
    }
    console.log('✅ Permission successfully mapped to role.');

    // 6. Test requirePermission middleware (Denied Request)
    // Create a new control plane user to test access restriction (since devUser is an Admin and has full access)
    console.log('\n6. Testing access restriction (Denied request)...');
    
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('guestpassword123', 10);
    const guestUserEmail = `guest_${Date.now()}@test.com`;
    const guestUser = await prisma.user.create({
      data: {
        tenantId: devUser.tenantId,
        name: 'Guest Developer',
        email: guestUserEmail,
        passwordHash,
        status: 'Active'
      }
    });
    console.log(`- Created guest developer user: ${guestUser.id}`);

    // Log in guest user
    const guestLoginRes = await request('POST', '/auth/login', {}, {
      email: guestUserEmail,
      password: 'guestpassword123'
    });

    if (guestLoginRes.status !== 200) {
      throw new Error(`Guest user login failed: ${JSON.stringify(guestLoginRes.body)}`);
    }

    const guestToken = guestLoginRes.body.data.tokens.accessToken;
    const guestHeaders = { 
      'Authorization': `Bearer ${guestToken}`,
      'x-project-id': project.id 
    };

    // Request the protected test endpoint (should return 403)
    const deniedRes = await request('GET', '/rbac/test-permission', guestHeaders);
    console.log(`- Denied request status: ${deniedRes.status}`);
    console.log(`- Denied response body: ${JSON.stringify(deniedRes.body)}`);

    if (deniedRes.status !== 403) {
      throw new Error(`Expected status 403 but got ${deniedRes.status}`);
    }

    // Validate exact JSON response
    if (deniedRes.body.success !== false || deniedRes.body.message !== 'Insufficient permissions') {
      throw new Error(`Expected response format did not match. Got: ${JSON.stringify(deniedRes.body)}`);
    }
    console.log('✅ Denied response format matches expectations.');

    // 7. Assign User Role (Assign "Writer" role to Guest User)
    console.log('\n7. Assigning "Writer" role to Guest User...');
    const assignUserRoleRes = await request('POST', `/rbac/users/${guestUser.id}/roles`, authHeaders, {
      roleId: writerRole.id,
      projectId: project.id
    });

    if (assignUserRoleRes.status !== 201) {
      throw new Error(`Failed to assign role to user: ${JSON.stringify(assignUserRoleRes.body)}`);
    }
    console.log('✅ User role mapped successfully.');

    // 8. Test requirePermission middleware (Allowed Request)
    console.log('\n8. Testing access permission (Allowed request)...');
    const allowedRes = await request('GET', '/rbac/test-permission', guestHeaders);
    console.log(`- Allowed request status: ${allowedRes.status}`);
    if (allowedRes.status !== 200) {
      throw new Error(`Expected status 200 but got ${allowedRes.status}: ${JSON.stringify(allowedRes.body)}`);
    }
    console.log('✅ Access granted successfully.');

    // 9. Clean up resources
    console.log('\n9. Cleaning up resources...');
    // Delete project
    const deleteProjRes = await request('DELETE', `/projects/${project.id}`, authHeaders);
    if (deleteProjRes.status !== 200) {
      console.warn('⚠️ Warning: Failed to delete project during cleanup.');
    } else {
      console.log('✅ Project deleted.');
    }

    // Delete guest user
    await prisma.user.delete({
      where: { id: guestUser.id }
    });
    console.log('✅ Guest user record deleted.');

    console.log('\n🎉 ALL RBAC MODULE 6 INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('\n❌ RBAC INTEGRATION TESTS FAILED:\n', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
