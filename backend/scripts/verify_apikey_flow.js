/**
 * Integration Test Suite for ApiKey authentication flow and validation guards
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
    // No JSON response
  }
  return {
    status: res.status,
    body: responseBody
  };
}

async function runTests() {
  console.log('🧪 Starting Kiaan Core API Key Authentication Flow Integration Tests...\n');

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

    // 2. Provision a temporary test project
    const projName = `ApiKeyProj_${Date.now()}`;
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

    // 3. Fetch project detail to retrieve the generated anon API Key
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

    // 4. Test validation guards
    console.log('\n4. Testing validation guards...');

    // Guard A: Invalid API key
    console.log(' - Sending request with invalid API key (should fail with 401)...');
    const badKeyRes = await request('POST', '/auth/signup', { 'apikey': 'invalid_key_val' }, {
      email: 'user_apikey@test.com',
      password: 'userpassword123'
    });
    if (badKeyRes.status !== 401 || !badKeyRes.body.error.message.includes('Invalid or revoked')) {
      throw new Error(`Guard A failed: ${JSON.stringify(badKeyRes.body)}`);
    }
    console.log('   ✅ Invalid API key guard verified.');

    // 5. Signup project user using only the apikey header
    console.log('\n5. Performing User Signup using only the apikey header...');
    const userEmail = `user_apikey_${Date.now()}@test.com`;
    const signupRes = await request('POST', '/auth/signup', { 'apikey': anonKey }, {
      email: userEmail,
      password: 'userpassword123'
    });

    if (signupRes.status !== 201) {
      throw new Error(`User signup failed: ${JSON.stringify(signupRes.body)}`);
    }
    console.log('✅ User registered successfully. Email:', userEmail);

    // 6. Login project user using only the apikey header
    console.log('\n6. Performing User Login using only the apikey header...');
    const userLoginRes = await request('POST', '/auth/login', { 'apikey': anonKey }, {
      email: userEmail,
      password: 'userpassword123'
    });

    if (userLoginRes.status !== 200) {
      throw new Error(`User login failed: ${JSON.stringify(userLoginRes.body)}`);
    }

    const userToken = userLoginRes.body.data.accessToken;
    console.log('✅ User login successful. Project User JWT issued.');

    // 7. Verify /auth/me profile retrieval using only apikey and Authorization Bearer
    console.log('\n7. Calling /auth/me with apikey and Authorization token...');
    const meRes = await request('GET', '/auth/me', {
      'apikey': anonKey,
      'Authorization': `Bearer ${userToken}`
    });

    if (meRes.status !== 200) {
      throw new Error(`GET /auth/me failed: ${JSON.stringify(meRes.body)}`);
    }
    console.log('✅ /auth/me response verification success. Logged in as:', meRes.body.data.user.email);

    // 8. Create dynamic table using Control Plane token
    console.log('\n8. Creating table "profiles" using Control Plane token...');
    const tableRes = await request('POST', `/projects/${projectId}/schema/tables`, authHeaders, {
      name: 'profiles',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'avatar_url', type: 'string' }
      ]
    });
    if (tableRes.status !== 201) {
      throw new Error(`Failed to create table: ${JSON.stringify(tableRes.body)}`);
    }
    console.log('✅ Table "profiles" created.');

    // 9. Insert record into dynamic table using only apikey and Project User JWT
    console.log('\n9. Inserting record into "profiles" using apikey and Project User JWT...');
    const insertRes = await request('POST', `/projects/${projectId}/data/profiles`, {
      'apikey': anonKey,
      'Authorization': `Bearer ${userToken}`
    }, {
      name: 'Jane Cooper',
      avatar_url: 'https://images.com/avatar.png'
    });

    if (insertRes.status !== 201) {
      throw new Error(`Dynamic insert failed: ${JSON.stringify(insertRes.body)}`);
    }
    console.log('✅ Record inserted successfully. Inserted ID:', insertRes.body.data.id);

    // 10. Clean up test project
    console.log('\n10. Cleaning up test project...');
    const deleteProjRes = await request('DELETE', `/projects/${projectId}`, authHeaders);
    if (deleteProjRes.status !== 200) {
      console.warn('⚠️ Warning: Failed to delete test project.');
    } else {
      console.log('✅ Test project deleted.');
    }

    console.log('\n🎉 ALL API KEY FLOW TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('\n❌ INTEGRATION TESTS FAILED: \n', error);
    process.exit(1);
  }
}

runTests();
