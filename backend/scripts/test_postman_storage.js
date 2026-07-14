const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

const runPostmanTests = async () => {
  console.log('🧪 Simulating Postman requests for Storage module...');
  
  try {
    // 1. Setup Data
    const loginRes = await makeRequest('POST', '/auth/login', {}, { email: 'boilerplate@gmail.com', password: '123456' });
    const devToken = loginRes.data.data.tokens.accessToken;

    const projRes = await makeRequest('POST', '/projects', { 'Authorization': `Bearer ${devToken}` }, { name: `PostmanTest_${Date.now()}` });
    const projectId = projRes.data.data.id;
    const projectRef = projRes.data.data.refId;

    const detailsRes = await makeRequest('GET', `/projects/${projectId}`, { 'Authorization': `Bearer ${devToken}` });
    const anonKey = detailsRes.data.data.apiKeys.find(k => k.keyType === 'anon').keyToken;

    // We will test 3 Postman variations that are common:
    // A. Postman Developer with x-project-ref only
    // B. Postman Developer with invalid apikey (Should return 401 Invalid API Key, but wait, now it falls back to projectRef if provided)
    // C. Postman Project User with NO apikey
    // D. Postman Developer with VALID apikey

    const headersA = { 'Authorization': `Bearer ${devToken}`, 'x-project-ref': projectRef };
    const headersB = { 'Authorization': `Bearer ${devToken}`, 'apikey': 'postman_invalid_key', 'x-project-ref': projectRef };
    const headersC = { 'Authorization': `Bearer ${devToken}`, 'apikey': anonKey };

    console.log(`\n--- [POST] /storage/buckets ---`);
    let res = await makeRequest('POST', '/storage/buckets', headersA, { name: 'bucket-a' });
    console.log(`POST (x-project-ref): ${res.status}`);
    
    res = await makeRequest('POST', '/storage/buckets', headersB, { name: 'bucket-b' });
    console.log(`POST (invalid apikey + valid x-project-ref): ${res.status}`);
    const bucketBId = res.data?.data?.id;

    res = await makeRequest('POST', '/storage/buckets', headersC, { name: 'bucket-c' });
    console.log(`POST (valid apikey): ${res.status}`);
    const bucketCId = res.data?.data?.id;

    console.log(`\n--- [GET] /storage/buckets ---`);
    res = await makeRequest('GET', '/storage/buckets', headersC);
    console.log(`GET list: ${res.status}`);

    console.log(`\n--- [GET] /storage/buckets/:id ---`);
    if (bucketCId) {
      res = await makeRequest('GET', `/storage/buckets/${bucketCId}`, headersC);
      console.log(`GET single: ${res.status}`);
    }

    console.log(`\n--- [PUT] /storage/buckets/:id ---`);
    if (bucketCId) {
      res = await makeRequest('PUT', `/storage/buckets/${bucketCId}`, headersC, { description: 'Updated bucket' });
      console.log(`PUT update: ${res.status}`);
    }

    console.log(`\n--- [DELETE] /storage/buckets/:id ---`);
    if (bucketBId) {
      res = await makeRequest('DELETE', `/storage/buckets/${bucketBId}`, headersC);
      console.log(`DELETE bucket B: ${res.status}`);
    }

    console.log(`\n--- [POST] /storage/upload ---`);
    const formData = new FormData();
    const blob = new Blob(['fake image content'], { type: 'image/png' });
    formData.append('file', blob, 'hello.png');
    formData.append('bucketId', bucketCId);
    formData.append('filePath', 'folder/hello.png');

    const uploadHeaders = { ...headersC };
    delete uploadHeaders['Content-Type'];

    const uploadRes = await fetch(`${API_URL}/storage/upload`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData
    });
    const uploadData = await uploadRes.json().catch(() => null);
    console.log(`POST upload: ${uploadRes.status}`, uploadData);
    const fileId = uploadData?.data?.id;

    console.log(`\n--- [GET] /storage/files ---`);
    res = await makeRequest('GET', `/storage/files?bucketId=${bucketCId}`, headersC);
    console.log(`GET files list: ${res.status}`);

    console.log(`\n--- [GET] /storage/files/:id ---`);
    if (fileId) {
      res = await makeRequest('GET', `/storage/files/${fileId}`, headersC);
      console.log(`GET single file: ${res.status}`);
    }

    console.log(`\n--- [DELETE] /storage/files/:id ---`);
    if (fileId) {
      res = await makeRequest('DELETE', `/storage/files/${fileId}`, headersC);
      console.log(`DELETE file: ${res.status}`);
    }

    // Cleanup
    await makeRequest('DELETE', `/projects/${projectId}`, { 'Authorization': `Bearer ${devToken}` });
    console.log(`\n✅ Postman simulation completed.`);
    
  } catch (error) {
    console.error('Test script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
};

runPostmanTests();
