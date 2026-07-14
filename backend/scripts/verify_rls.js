const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getClientForProject } = require('../src/modules/project/projectConnection');

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
    // No json
  }
  return {
    status: res.status,
    body: responseBody
  };
}

async function runTests() {
  console.log('🧪 Starting Kiaan Core Module 7 Row Level Security (RLS) Integration Tests...\n');

  let projectA = null;
  let projectB = null;
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

    // 2. Provision Project A and Project B
    console.log('\n2. Creating temporary test projects (A & B)...');
    const projARes = await request('POST', '/projects', authHeaders, { name: `RLS_ProjA_${Date.now()}` });
    const projBRes = await request('POST', '/projects', authHeaders, { name: `RLS_ProjB_${Date.now()}` });

    if (projARes.status !== 201 || projBRes.status !== 201) {
      throw new Error(`Failed to create projects: A=${projARes.status}, B=${projBRes.status}`);
    }

    projectA = projARes.body.data;
    projectB = projBRes.body.data;
    console.log(`✅ Projects created. Proj A ID: ${projectA.id}, Proj B ID: ${projectB.id}`);

    console.log('Waiting 3.5 seconds for databases & schema provisioning...');
    await new Promise(resolve => setTimeout(resolve, 3500));

    // Get API Keys
    const projectADetailsRes = await request('GET', `/projects/${projectA.id}`, authHeaders);
    const projectADetails = projectADetailsRes.body.data;
    const anonKeyA = projectADetails.apiKeys.find(k => k.keyType === 'anon').keyToken;

    const projectBDetailsRes = await request('GET', `/projects/${projectB.id}`, authHeaders);
    const projectBDetails = projectBDetailsRes.body.data;
    const anonKeyB = projectBDetails.apiKeys.find(k => k.keyType === 'anon').keyToken;

    // 3. Create table "patients" in Project A
    console.log('\n3. Creating table "patients" in Project A...');
    const createTableRes = await request('POST', '/database/tables', {
      'apikey': anonKeyA,
      'Authorization': `Bearer ${devToken}`
    }, {
      name: 'patients',
      columns: [
        { name: 'name', type: 'string', required: true },
        { name: 'doctorId', type: 'string', required: true }
      ]
    });
    if (createTableRes.status !== 201) {
      throw new Error(`Failed to create table "patients": ${JSON.stringify(createTableRes.body)}`);
    }
    console.log('✅ Table "patients" created successfully.');

    // 4. Create RLS Policies in Project A
    console.log('\n4. Creating RLS Policies for "patients" table...');
    
    // Doctor SELECT policy
    const policy1 = await request('POST', '/rls/policies', authHeaders, {
      projectId: projectA.id,
      tableName: 'patients',
      policyName: 'doctor_select_patients',
      operation: 'SELECT',
      role: 'doctor',
      condition: 'doctorId = auth.userId'
    });

    // Doctor UPDATE policy
    const policy2 = await request('POST', '/rls/policies', authHeaders, {
      projectId: projectA.id,
      tableName: 'patients',
      policyName: 'doctor_update_patients',
      operation: 'UPDATE',
      role: 'doctor',
      condition: 'doctorId = auth.userId'
    });

    // Doctor INSERT policy
    const policy3 = await request('POST', '/rls/policies', authHeaders, {
      projectId: projectA.id,
      tableName: 'patients',
      policyName: 'doctor_insert_patients',
      operation: 'INSERT',
      role: 'doctor',
      condition: 'doctorId = auth.userId'
    });

    // Patient SELECT policy
    const policy4 = await request('POST', '/rls/policies', authHeaders, {
      projectId: projectA.id,
      tableName: 'patients',
      policyName: 'patient_select_profile',
      operation: 'SELECT',
      role: 'patient',
      condition: 'id = auth.userId'
    });

    if (policy1.status !== 201 || policy2.status !== 201 || policy3.status !== 201 || policy4.status !== 201) {
      console.log('Policy 1 response:', policy1.status, policy1.body);
      console.log('Policy 2 response:', policy2.status, policy2.body);
      console.log('Policy 3 response:', policy3.status, policy3.body);
      console.log('Policy 4 response:', policy4.status, policy4.body);
      throw new Error('Failed to create RLS policies');
    }
    console.log('✅ RLS policies created successfully.');

    // 4.5. Seed Role & Permission mappings in Project A so dynamic auth allows database operations
    console.log('\n4.5. Seeding role and permission mappings in control-plane...');
    
    // Create roles 'doctor' and 'patient' for Project A
    const doctorRole = await prisma.role.create({
      data: {
        projectId: projectA.id,
        roleName: 'doctor',
        name: 'doctor',
        status: 'Active'
      }
    });

    const patientRole = await prisma.role.create({
      data: {
        projectId: projectA.id,
        roleName: 'patient',
        name: 'patient',
        status: 'Active'
      }
    });

    // Fetch default seeded permissions for Project A (like database.*, etc.)
    const projectPerms = await prisma.permission.findMany({
      where: { projectId: projectA.id }
    });

    // Find database permissions
    const dbWritePerm = projectPerms.find(p => p.permissionKey === 'database.write' || p.permissionKey === 'database.*');
    const dbReadPerm = projectPerms.find(p => p.permissionKey === 'database.read' || p.permissionKey === 'database.*');

    if (dbWritePerm && dbReadPerm) {
      const dataToInsert = [];
      const seen = new Set();
      
      const addMapping = (roleId, permissionId) => {
        const key = `${roleId}_${permissionId}`;
        if (!seen.has(key)) {
          seen.add(key);
          dataToInsert.push({ roleId, permissionId });
        }
      };

      addMapping(doctorRole.id, dbWritePerm.id);
      addMapping(doctorRole.id, dbReadPerm.id);
      addMapping(patientRole.id, dbReadPerm.id);

      await prisma.rolePermission.createMany({
        data: dataToInsert
      });
    } else {
      // If default seeded permissions are not found, let's create them!
      const pWrite = await prisma.permission.create({
        data: { projectId: projectA.id, permissionKey: 'database.write', displayName: 'Write DB', status: 'Active' }
      });
      const pRead = await prisma.permission.create({
        data: { projectId: projectA.id, permissionKey: 'database.read', displayName: 'Read DB', status: 'Active' }
      });
      
      await prisma.rolePermission.createMany({
        data: [
          { roleId: doctorRole.id, permissionId: pWrite.id },
          { roleId: doctorRole.id, permissionId: pRead.id },
          { roleId: patientRole.id, permissionId: pRead.id }
        ]
      });
    }
    console.log('✅ Role and permission mappings seeded.');

    // 5. Sign up users for Project A: Doctor A, Doctor B, Patient P
    console.log('\n5. Creating Project A users (Doctor A, Doctor B, Patient P)...');
    
    const signupUser = async (email, password) => {
      const res = await request('POST', '/auth/signup', {
        'x-project-ref': projectADetails.refId,
        'apikey': anonKeyA
      }, { email, password });
      if (res.status !== 201) throw new Error(`Signup failed for ${email}: ${JSON.stringify(res.body)}`);
      return res.body.data.user.id;
    };

    const docAId = await signupUser(`doctorA_${Date.now()}@test.com`, 'password123');
    const docBId = await signupUser(`doctorB_${Date.now()}@test.com`, 'password123');
    const patientId = await signupUser(`patient_${Date.now()}@test.com`, 'password123');

    // Update their roles in the Project dynamic database directly
    console.log('Assigning roles in dynamic database...');
    const dbProjectA = await prisma.project.findUnique({ where: { id: projectA.id } });
    const dynamicClientA = getClientForProject(dbProjectA);

    await dynamicClientA.$executeRawUnsafe('UPDATE users SET role = "doctor" WHERE id = ?', docAId);
    await dynamicClientA.$executeRawUnsafe('UPDATE users SET role = "doctor" WHERE id = ?', docBId);
    await dynamicClientA.$executeRawUnsafe('UPDATE users SET role = "patient" WHERE id = ?', patientId);

    console.log(`✅ Roles seeded. Doctor A ID: ${docAId}, Doctor B ID: ${docBId}, Patient ID: ${patientId}`);

    // Get Auth Tokens for Doctor A, Doctor B, Patient
    const loginUser = async (email, password) => {
      const res = await request('POST', '/auth/login', {
        'x-project-ref': projectADetails.refId,
        'apikey': anonKeyA
      }, { email, password });
      if (res.status !== 200) throw new Error(`Login failed for ${email}`);
      return res.body.data.accessToken;
    };

    const docAToken = await loginUser(
      (await dynamicClientA.$queryRawUnsafe('SELECT email FROM users WHERE id = ?', docAId))[0].email,
      'password123'
    );
    const docBToken = await loginUser(
      (await dynamicClientA.$queryRawUnsafe('SELECT email FROM users WHERE id = ?', docBId))[0].email,
      'password123'
    );
    const patientToken = await loginUser(
      (await dynamicClientA.$queryRawUnsafe('SELECT email FROM users WHERE id = ?', patientId))[0].email,
      'password123'
    );

    // 6. Test 1: INSERT with RLS validation
    console.log('\n6. Test: INSERT verification...');
    
    // Doctor A inserts Doctor A patient -> Should work
    const insertA1 = await request('POST', '/database/patients', {
      'apikey': anonKeyA,
      'Authorization': `Bearer ${docAToken}`
    }, {
      id: patientId, // Patient Row 1: Patient's profile row
      name: 'Patient P Profile',
      doctorId: docAId
    });
    if (insertA1.status !== 201) {
      throw new Error(`Doctor A insert failed: ${JSON.stringify(insertA1.body)}`);
    }

    const insertA2 = await request('POST', '/database/patients', {
      'apikey': anonKeyA,
      'Authorization': `Bearer ${docAToken}`
    }, {
      name: 'Patient X (Doctor A)',
      doctorId: docAId
    });
    const patientXId = insertA2.body.data.id;

    // Doctor B inserts Doctor B patient -> Should work
    const insertB = await request('POST', '/database/patients', {
      'apikey': anonKeyA,
      'Authorization': `Bearer ${docBToken}`
    }, {
      name: 'Patient Y (Doctor B)',
      doctorId: docBId
    });
    const patientYId = insertB.body.data.id;

    // Doctor A tries to insert Patient with Doctor B's doctorId -> Should fail with 403
    const insertFail = await request('POST', '/database/patients', {
      'apikey': anonKeyA,
      'Authorization': `Bearer ${docAToken}`
    }, {
      name: 'Patient Cheat',
      doctorId: docBId
    });
    console.log(`- Doctor A inserting with Doctor B ID status: ${insertFail.status}`);
    if (insertFail.status !== 403) {
      throw new Error('Expected 403 Forbidden for invalid insert policy match');
    }
    console.log('✅ INSERT RLS validation verified.');

    // 7. Test 2: Doctor A SELECT & UPDATE restrictions
    console.log('\n7. Test: Doctor A SELECT & UPDATE checks...');
    
    // List patients as Doctor A
    const listA = await request('GET', '/database/patients', {
      'apikey': anonKeyA,
      'Authorization': `Bearer ${docAToken}`
    });
    const patientNamesA = listA.body.data.map(p => p.name);
    console.log(`- Patients visible to Doctor A: ${patientNamesA.join(', ')}`);
    if (patientNamesA.includes('Patient Y (Doctor B)')) {
      throw new Error('Security Breach: Doctor A can see Doctor B\'s patient!');
    }
    if (!patientNamesA.includes('Patient P Profile') || !patientNamesA.includes('Patient X (Doctor A)')) {
      throw new Error('Doctor A cannot see their own patients!');
    }
    console.log('✅ Doctor A SELECT constraint verified.');

    // Doctor A updates Doctor B patient -> Should fail
    const updateFail = await request('PATCH', `/database/patients/${patientYId}`, {
      'apikey': anonKeyA,
      'Authorization': `Bearer ${docAToken}`
    }, {
      name: 'Doctor A Hacked Name'
    });
    console.log(`- Doctor A updating Doctor B patient status: ${updateFail.status}`);
    if (updateFail.status === 200 || updateFail.status === 204) {
      throw new Error('Security Breach: Doctor A updated Doctor B\'s patient!');
    }
    console.log('✅ Doctor A UPDATE restriction verified.');

    // 8. Test 3: Patient SELECT restriction
    console.log('\n8. Test: Patient SELECT checks...');
    const listPatient = await request('GET', '/database/patients', {
      'apikey': anonKeyA,
      'Authorization': `Bearer ${patientToken}`
    });
    const patientNamesP = listPatient.body.data.map(p => p.name);
    console.log(`- Patients visible to Patient P: ${patientNamesP.join(', ')}`);
    if (patientNamesP.length !== 1 || patientNamesP[0] !== 'Patient P Profile') {
      throw new Error('Patient can see other patients or cannot see their own profile!');
    }
    console.log('✅ Patient SELECT constraint verified.');

    // 9. Test 4: Admin Bypass support
    console.log('\n9. Test: Admin RLS Bypass checks...');
    const listAdmin = await request('GET', '/database/patients', {
      'apikey': anonKeyA,
      'Authorization': `Bearer ${devToken}`
    });
    const patientNamesAdmin = listAdmin.body.data.map(p => p.name);
    console.log(`- Patients visible to Admin: ${patientNamesAdmin.join(', ')}`);
    if (patientNamesAdmin.length < 3) {
      throw new Error('Admin did not bypass RLS (returned fewer than all records)!');
    }
    console.log('✅ Admin RLS Bypass verified.');

    // 10. Test 5: Tenant / Project Isolation checks
    console.log('\n10. Test: Tenant and Project Isolation checks...');
    
    // Project B user trying to fetch Project A's patients table data
    // Call GET /projects/ProjectA/data/patients with Project B's headers (should be blocked)
    const crossProjRes = await request('GET', `/database/patients`, {
      'apikey': anonKeyB,
      'Authorization': `Bearer ${docAToken}` // Project A token
    });
    console.log(`- Project A token with Project B APIKey request status: ${crossProjRes.status}`);
    if (crossProjRes.status !== 401 && crossProjRes.status !== 403) {
      throw new Error('Cross-project key manipulation did not reject access!');
    }
    console.log('✅ Tenant & Project isolation verified.');

    // 11. Cleanup test resources
    console.log('\n11. Cleaning up test resources...');
    // Drop table
    await request('DELETE', `/projects/${projectA.id}/schema/tables/patients`, authHeaders);
    // Delete projects
    await request('DELETE', `/projects/${projectA.id}`, authHeaders);
    await request('DELETE', `/projects/${projectB.id}`, authHeaders);
    console.log('✅ Cleanup successful.');

    console.log('\n🎉 ALL MODULE 7 ROW LEVEL SECURITY INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('\n❌ ROW LEVEL SECURITY INTEGRATION TESTS FAILED:\n', error);
    // Attempt cleanup
    if (projectA) {
      await request('DELETE', `/projects/${projectA.id}/schema/tables/patients`, { 'Authorization': `Bearer ${devToken}` }).catch(() => {});
      await request('DELETE', `/projects/${projectA.id}`, { 'Authorization': `Bearer ${devToken}` }).catch(() => {});
    }
    if (projectB) {
      await request('DELETE', `/projects/${projectB.id}`, { 'Authorization': `Bearer ${devToken}` }).catch(() => {});
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
