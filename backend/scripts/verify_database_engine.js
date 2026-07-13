/**
 * Integration Test Suite for Module 4: Dynamic Database Engine
 */
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
  console.log('🧪 Starting Kiaan Core Dynamic Database Engine Integration Tests...\n');

  try {
    // 1. Login to Control Plane to get developer access token
    console.log('1. Logging in to Control Plane...');
    const loginRes = await request('POST', '/auth/login', {}, {
      email: 'boilerplate@gmail.com',
      password: '123456'
    });

    if (loginRes.status !== 200) {
      throw new Error(`Control plane login failed: ${JSON.stringify(loginRes.body)}`);
    }

    const devToken = loginRes.body.data.tokens.accessToken;
    const authHeaders = { 'Authorization': `Bearer ${devToken}` };
    console.log('✅ Control plane login success.');

    // 2. Provision the "School" project
    const projName = `School_${Date.now()}`;
    console.log(`\n2. Provisioning temporary test project: ${projName}...`);
    const projRes = await request('POST', '/projects', authHeaders, {
      name: projName
    });

    if (projRes.status !== 201) {
      throw new Error(`Failed to create test project: ${JSON.stringify(projRes.body)}`);
    }

    const projectInitial = projRes.body.data;
    const projectId = projectInitial.id;
    console.log(`✅ Test project created. Project ID: ${projectId}`);
    console.log('Waiting 3 seconds for database provisioning and schema bootstrap...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Fetch project details to retrieve the generated anon API Key
    console.log(`\n3. Fetching project ${projectId} to get API Keys...`);
    const detailRes = await request('GET', `/projects/${projectId}`, authHeaders);
    if (detailRes.status !== 200) {
      throw new Error(`Failed to fetch project details: ${JSON.stringify(detailRes.body)}`);
    }

    const project = detailRes.body.data;
    const anonKey = project.apiKeys.find(k => k.keyType === 'anon')?.keyToken;
    if (!anonKey) {
      throw new Error('Anon API Key was not generated for the project.');
    }
    console.log('✅ Anon API Key retrieved successfully.');

    // 4. Register a project user
    console.log('\n4. Registering a project user...');
    const userEmail = `student_${Date.now()}@test.com`;
    const signupRes = await request('POST', '/auth/signup', { 'apikey': anonKey }, {
      email: userEmail,
      password: 'studentpassword123'
    });

    if (signupRes.status !== 201) {
      throw new Error(`User signup failed: ${JSON.stringify(signupRes.body)}`);
    }
    console.log('✅ User registered successfully. Email:', userEmail);

    // 5. Login project user to get USER_ACCESS_TOKEN
    console.log('\n5. Logging in project user...');
    const userLoginRes = await request('POST', '/auth/login', { 'apikey': anonKey }, {
      email: userEmail,
      password: 'studentpassword123'
    });

    if (userLoginRes.status !== 200) {
      throw new Error(`User login failed: ${JSON.stringify(userLoginRes.body)}`);
    }

    const userToken = userLoginRes.body.data.accessToken;
    const clientHeaders = {
      'apikey': anonKey,
      'Authorization': `Bearer ${userToken}`
    };
    console.log('✅ User login successful. Project User JWT issued.');

    // 6. Create Table: "students"
    console.log('\n6. Creating table "students" using /database/tables endpoint...');
    const createTableRes = await request('POST', '/database/tables', clientHeaders, {
      name: 'students',
      columns: [
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string' },
        { name: 'class', type: 'number' }
      ]
    });

    if (createTableRes.status !== 201) {
      throw new Error(`Failed to create table "students": ${JSON.stringify(createTableRes.body)}`);
    }
    console.log('✅ Table "students" created successfully.');

    // 7. Insert: Rahul, class 10
    console.log('\n7. Inserting record (Rahul, class 10)...');
    const insertRes = await request('POST', '/database/students', clientHeaders, {
      name: 'Rahul',
      email: 'rahul@test.com',
      class: 10
    });

    if (insertRes.status !== 201) {
      throw new Error(`Insert failed: ${JSON.stringify(insertRes.body)}`);
    }
    const rahulId = insertRes.body.data.id;
    console.log('✅ Record inserted. ID:', rahulId);

    // 8. Fetch students list
    console.log('\n8. Fetching students list using GET /database/students...');
    const listRes = await request('GET', '/database/students', clientHeaders);
    if (listRes.status !== 200) {
      throw new Error(`Fetch students list failed: ${JSON.stringify(listRes.body)}`);
    }

    console.log('Records returned:', listRes.body.data);
    const rahulRecord = listRes.body.data.find(r => r.id === rahulId);
    if (!rahulRecord || rahulRecord.name !== 'Rahul' || rahulRecord.class !== 10) {
      throw new Error('Rahul record verification failed.');
    }
    console.log('✅ Fetch verified. Record exists and values are correct.');

    // 9. Update Record
    console.log(`\n9. Updating record ${rahulId} class to 11...`);
    const updateRes = await request('PATCH', `/database/students/${rahulId}`, clientHeaders, {
      class: 11
    });
    if (updateRes.status !== 200) {
      throw new Error(`Update failed: ${JSON.stringify(updateRes.body)}`);
    }
    console.log('Updated class value:', updateRes.body.data.class);
    if (updateRes.body.data.class !== 11) throw new Error('Update verification failed.');
    console.log('✅ Update verified successfully.');

    // 10. Delete Record
    console.log(`\n10. Deleting record ${rahulId}...`);
    const deleteRes = await request('DELETE', `/database/students/${rahulId}`, clientHeaders);
    if (deleteRes.status !== 200) throw new Error(`Delete failed: ${JSON.stringify(deleteRes.body)}`);
    console.log('✅ Record deleted.');

    // Verify deleted
    const checkRes = await request('GET', `/database/students?id=${rahulId}`, clientHeaders);
    if (checkRes.body.data.length !== 0) {
      throw new Error('Delete verification failed. Record still present.');
    }
    console.log('✅ Delete verified successfully.');

    // 11. Drop table and delete project
    console.log('\n11. Dropping table "students" and deleting project...');
    const dropTableRes = await request('DELETE', `/projects/${projectId}/schema/tables/students`, authHeaders);
    if (dropTableRes.status !== 200) {
      console.warn('⚠️ Warning: Failed to drop table.');
    } else {
      console.log('✅ Table dropped.');
    }

    const deleteProjRes = await request('DELETE', `/projects/${projectId}`, authHeaders);
    if (deleteProjRes.status !== 200) {
      console.warn('⚠️ Warning: Failed to delete project.');
    } else {
      console.log('✅ Project deleted.');
    }

    console.log('\n🎉 ALL DYNAMIC DATABASE ENGINE TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('\n❌ INTEGRATION TESTS FAILED: \n', error);
    process.exit(1);
  }
}

runTests();
