const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:5000/api/v1';

const makeRequest = async (method, endpoint, headers = {}, body = null) => {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${endpoint}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
};

const runTests = async () => {
  console.log('🧪 Testing Storage Auth Flows...');
  
  try {
    // 1. Developer Login
    const loginRes = await makeRequest('POST', '/auth/login', {}, { email: 'boilerplate@gmail.com', password: '123456' });
    const devToken = loginRes.data.data.tokens.accessToken;

    // 2. Create Project
    const projRes = await makeRequest('POST', '/projects', { 'Authorization': `Bearer ${devToken}` }, { name: `AuthTest_${Date.now()}` });
    const projectId = projRes.data.data.id;
    const projectRef = projRes.data.data.refId;

    // Get Project Keys
    const detailsRes = await makeRequest('GET', `/projects/${projectId}`, { 'Authorization': `Bearer ${devToken}` });
    const anonKey = detailsRes.data.data.apiKeys.find(k => k.keyType === 'anon').keyToken;

    console.log(`\n--- Test 1: Dev Token + Valid API Key ---`);
    const t1 = await makeRequest('POST', '/storage/buckets', { 
      'Authorization': `Bearer ${devToken}`,
      'apikey': anonKey
    }, { name: 't1-bucket' });
    console.log('T1 Status:', t1.status, t1.data);

    console.log(`\n--- Test 2: Dev Token + Invalid API Key ---`);
    const t2 = await makeRequest('POST', '/storage/buckets', { 
      'Authorization': `Bearer ${devToken}`,
      'apikey': 'invalid_key'
    }, { name: 't2-bucket' });
    console.log('T2 Status:', t2.status, t2.data);

    console.log(`\n--- Test 3: Dev Token + x-project-ref (NO apikey) ---`);
    const t3 = await makeRequest('POST', '/storage/buckets', { 
      'Authorization': `Bearer ${devToken}`,
      'x-project-ref': projectRef
    }, { name: 't3-bucket' });
    console.log('T3 Status:', t3.status, t3.data);

    console.log(`\n--- Test 4: Project User Token ONLY (NO apikey) ---`);
    // Create a user in the project
    const signupRes = await makeRequest('POST', '/auth/signup', {
      'apikey': anonKey
    }, { email: 'user@test.com', password: 'password123' });
    const userToken = signupRes.data.data.accessToken;

    const t4 = await makeRequest('GET', '/storage/buckets', { 
      'Authorization': `Bearer ${userToken}`
    });
    console.log('T4 Status:', t4.status, t4.data);

    console.log(`\n--- Test 5: Project User Token + Invalid API Key (POST) ---`);
    const t5 = await makeRequest('POST', '/storage/buckets', { 
      'Authorization': `Bearer ${userToken}`,
      'apikey': 'invalid_key'
    }, { name: 't5-bucket' });
    console.log('T5 Status:', t5.status, t5.data);

    console.log(`\n--- Test 6: Anon Key ONLY in Authorization Header ---`);
    const t6 = await makeRequest('GET', '/storage/buckets', { 
      'Authorization': `Bearer ${anonKey}`
    });
    console.log('T6 Status:', t6.status, t6.data);

    // Cleanup
    await makeRequest('DELETE', `/projects/${projectId}`, { 'Authorization': `Bearer ${devToken}` });
    
  } catch (error) {
    console.error('Test script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
};

runTests();
