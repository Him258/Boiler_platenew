const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

// Helper to make HTTP requests
const request = (method, path, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTests() {
  console.log('🧪 Starting Kiaan Core Dynamic Auth Integration Tests...\n');

  try {
    // 1. Login to Control Plane to get access token for provisioning
    console.log('1. Logging in to Control Plane...');
    const loginRes = await request('POST', '/auth/login', {}, {
      email: 'boilerplate@gmail.com',
      password: '123456'
    });

    if (loginRes.status !== 200) {
      throw new Error(`Control plane login failed: ${JSON.stringify(loginRes.body)}`);
    }

    const tenantToken = loginRes.body.data.tokens.accessToken;
    console.log('✅ Control plane login success.');

    // 2. Create Project A
    const projAName = `ProjA_${Date.now()}`;
    console.log(`\n2. Provisioning Project A: ${projAName}...`);
    const projARes = await request('POST', '/projects', {
      'Authorization': `Bearer ${tenantToken}`
    }, {
      name: projAName
    });

    if (projARes.status !== 201) {
      throw new Error(`Failed to create Project A: ${JSON.stringify(projARes.body)}`);
    }

    const projectA = projARes.body.data;
    console.log(`✅ Project A Created. RefId: ${projectA.refId}`);

    // Wait a few seconds for provisioning to finalize
    console.log('Waiting 3 seconds for DB provisioning and schema bootstrap...');
    await new Promise((r) => setTimeout(r, 3000));

    // Get Project A complete details (including API keys)
    const projectADetailsRes = await request('GET', `/projects/${projectA.id}`, {
      'Authorization': `Bearer ${tenantToken}`
    });
    const projectADetails = projectADetailsRes.body.data;
    const anonKeyA = projectADetails.apiKeys.find(k => k.keyType === 'anon').keyToken;

    // 3. Create Project B (for isolation checks)
    const projBName = `ProjB_${Date.now()}`;
    console.log(`\n3. Provisioning Project B: ${projBName}...`);
    const projBRes = await request('POST', '/projects', {
      'Authorization': `Bearer ${tenantToken}`
    }, {
      name: projBName
    });

    if (projBRes.status !== 201) {
      throw new Error(`Failed to create Project B: ${JSON.stringify(projBRes.body)}`);
    }

    const projectB = projBRes.body.data;
    console.log(`✅ Project B Created. RefId: ${projectB.refId}`);

    console.log('Waiting 3 seconds for DB B provisioning and schema bootstrap...');
    await new Promise((r) => setTimeout(r, 3000));

    // Get Project B complete details
    const projectBDetailsRes = await request('GET', `/projects/${projectB.id}`, {
      'Authorization': `Bearer ${tenantToken}`
    });
    const projectBDetails = projectBDetailsRes.body.data;
    const anonKeyB = projectBDetails.apiKeys.find(k => k.keyType === 'anon').keyToken;

    // 4. Test Signup on Project A
    console.log('\n4. Testing user Signup on Project A...');
    const userEmail = `user_${Date.now()}@test.com`;
    const userPassword = 'password123';

    const signupRes = await request('POST', '/auth/signup', {
      'x-project-ref': projectADetails.refId,
      'apikey': anonKeyA
    }, {
      email: userEmail,
      password: userPassword
    });

    if (signupRes.status !== 201) {
      throw new Error(`Signup on Project A failed: ${JSON.stringify(signupRes.body)}`);
    }
    console.log('✅ User signup on Project A successful.');
    console.log(`User ID: ${signupRes.body.data.user.id}`);

    // Try signing up same user again (expecting conflict)
    console.log('Testing duplicate user Signup on Project A (should fail)...');
    const dupSignupRes = await request('POST', '/auth/signup', {
      'x-project-ref': projectADetails.refId,
      'apikey': anonKeyA
    }, {
      email: userEmail,
      password: userPassword
    });

    if (dupSignupRes.status === 409) {
      console.log('✅ Duplicate signup correctly rejected with 409 Conflict.');
    } else {
      throw new Error(`Expected 409 Conflict, got ${dupSignupRes.status}`);
    }

    // 5. Test Login on Project A
    console.log('\n5. Testing user Login on Project A...');
    const loginResA = await request('POST', '/auth/login', {
      'x-project-ref': projectADetails.refId,
      'apikey': anonKeyA
    }, {
      email: userEmail,
      password: userPassword
    });

    if (loginResA.status !== 200) {
      throw new Error(`Login on Project A failed: ${JSON.stringify(loginResA.body)}`);
    }

    const { accessToken, refreshToken } = loginResA.body.data;
    console.log('✅ User login on Project A successful.');
    console.log(`Access Token: ${accessToken.substring(0, 20)}...`);
    console.log(`Refresh Token: ${refreshToken.substring(0, 10)}...`);

    // 6. Test GET /me on Project A
    console.log('\n6. Testing GET /me on Project A...');
    const meRes = await request('GET', '/auth/me', {
      'x-project-ref': projectADetails.refId,
      'apikey': anonKeyA,
      'Authorization': `Bearer ${accessToken}`
    });

    if (meRes.status !== 200) {
      throw new Error(`GET /me on Project A failed: ${JSON.stringify(meRes.body)}`);
    }
    console.log('✅ GET /me retrieved successfully.');
    console.log(`Profile User Email: ${meRes.body.data.user.email}`);

    // 7. Test Refresh Token Rotation on Project A
    console.log('\n7. Testing Token Refresh (Rotation) on Project A...');
    const refreshRes = await request('POST', '/auth/refresh', {
      'x-project-ref': projectADetails.refId,
      'apikey': anonKeyA
    }, {
      refreshToken: refreshToken
    });

    if (refreshRes.status !== 200) {
      throw new Error(`Refresh failed: ${JSON.stringify(refreshRes.body)}`);
    }

    const newAccessToken = refreshRes.body.data.accessToken;
    const newRefreshToken = refreshRes.body.data.refreshToken;
    console.log('✅ Token refresh successful.');
    console.log(`New Access Token: ${newAccessToken.substring(0, 20)}...`);
    console.log(`New Refresh Token: ${newRefreshToken.substring(0, 10)}...`);

    // Try refreshing again with the OLD rotated refresh token (should fail)
    console.log('Testing replay protection: reusing old refresh token (should fail)...');
    const oldRefreshRes = await request('POST', '/auth/refresh', {
      'x-project-ref': projectADetails.refId,
      'apikey': anonKeyA
    }, {
      refreshToken: refreshToken
    });

    if (oldRefreshRes.status === 401) {
      console.log('✅ Old refresh token correctly rejected with 401 (Replay protection ok).');
    } else {
      throw new Error(`Expected 401 for old refresh token usage, got ${oldRefreshRes.status}`);
    }

    // 8. Test Project Isolation
    console.log('\n8. Testing Project Isolation (Project B rejecting Project A tokens)...');
    
    // Attempt signup of different user on Project B to verify DB isolation
    console.log('Registering user on Project B...');
    const signupResB = await request('POST', '/auth/signup', {
      'x-project-ref': projectBDetails.refId,
      'apikey': anonKeyB
    }, {
      email: `user_b@test.com`,
      password: 'passwordB123'
    });

    if (signupResB.status !== 201) {
      throw new Error(`Signup on Project B failed: ${JSON.stringify(signupResB.body)}`);
    }
    console.log('✅ Registered user B on Project B.');

    // Now call Project B's GET /me using Project A's accessToken
    console.log('Calling Project B /me with Project A\'s access token...');
    const isolationRes = await request('GET', '/auth/me', {
      'x-project-ref': projectBDetails.refId,
      'apikey': anonKeyB,
      'Authorization': `Bearer ${newAccessToken}`
    });

    if (isolationRes.status === 401) {
      console.log('✅ Project B correctly rejected Project A\'s token with 401 (Isolation verified).');
    } else {
      throw new Error(`Expected 401 when calling Project B with Project A token, got ${isolationRes.status}`);
    }

    // 9. Test Logout on Project A
    console.log('\n9. Testing user Logout on Project A...');
    const logoutRes = await request('POST', '/auth/logout', {
      'x-project-ref': projectADetails.refId,
      'apikey': anonKeyA
    }, {
      refreshToken: newRefreshToken
    });

    if (logoutRes.status !== 200) {
      throw new Error(`Logout failed: ${JSON.stringify(logoutRes.body)}`);
    }
    console.log('✅ Logout successful.');

    // Try refreshing after logout (should fail)
    console.log('Testing refresh with logged out token (should fail)...');
    const postLogoutRefresh = await request('POST', '/auth/refresh', {
      'x-project-ref': projectADetails.refId,
      'apikey': anonKeyA
    }, {
      refreshToken: newRefreshToken
    });

    if (postLogoutRefresh.status === 401) {
      console.log('✅ Refresh token correctly rejected after logout.');
    } else {
      throw new Error(`Expected 401 for post-logout refresh, got ${postLogoutRefresh.status}`);
    }

    // 10. Clean up test projects
    console.log('\n10. Cleaning up test projects...');
    await request('DELETE', `/projects/${projectA.id}`, { 'Authorization': `Bearer ${tenantToken}` });
    await request('DELETE', `/projects/${projectB.id}`, { 'Authorization': `Bearer ${tenantToken}` });
    console.log('✅ Cleaned up Project A and Project B successfully.');

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('\n❌ INTEGRATION TESTS FAILED:', error.message);
    process.exit(1);
  }
}

runTests();
