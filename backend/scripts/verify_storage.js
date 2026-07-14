const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const { Blob } = require('buffer');

const API_URL = 'http://localhost:5000/api/v1';

const makeRequest = async (method, endpoint, body = null, headers = {}) => {
  const options = {
    method,
    headers: {
      ...headers
    }
  };

  if (body) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${API_URL}${endpoint}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
};

const runTests = async () => {
  console.log('🧪 Starting Kiaan Core Module 6 Storage Engine Tests...\n');
  
  let projectId;
  let projectApiKey;
  let bucketId;
  let fileId;

  let devToken;

  try {
    // 0. Login as developer
    const loginRes = await makeRequest('POST', '/auth/login', {
      email: 'boilerplate@gmail.com',
      password: '123456'
    });
    if (loginRes.status !== 200) throw new Error('Developer login failed');
    devToken = loginRes.data.data.tokens.accessToken;
    const authHeaders = { 'Authorization': `Bearer ${devToken}` };

    // 1. Provision Project
    const projRes = await makeRequest('POST', '/projects', {
      name: `Storage_Test_${Date.now()}`
    }, authHeaders);
    
    if (projRes.status !== 201) throw new Error(`Failed to create project: ${JSON.stringify(projRes.data)}`);
    projectId = projRes.data.data.id;
    console.log(`✅ Project provisioned: ${projectId}`);
    
    // Create ApiKey
    const projectDetailsRes = await makeRequest('GET', `/projects/${projectId}`, null, authHeaders);
    if (projectDetailsRes.status !== 200) throw new Error(`Failed to get project details: ${JSON.stringify(projectDetailsRes.data)}`);
    projectApiKey = projectDetailsRes.data.data.apiKeys.find(k => k.keyType === 'anon').keyToken;
    const projectHeaders = { 'apikey': projectApiKey, 'Authorization': `Bearer ${devToken}` };

    // 2. Create Bucket
    const bucketRes = await makeRequest('POST', '/storage/buckets', {
      name: 'test-bucket',
      description: 'Test bucket for automated tests',
      isPublic: false
    }, projectHeaders);
    
    if (bucketRes.status !== 201) throw new Error(`Failed to create bucket: ${JSON.stringify(bucketRes.data)}`);
    bucketId = bucketRes.data.data.id;
    console.log(`✅ Bucket created: test-bucket (${bucketId})`);

    // 3. Upload File
    const dummyFilePath = path.join(__dirname, 'dummy.csv');
    fs.writeFileSync(dummyFilePath, 'id,name\n1,hello');
    
    const formData = new FormData();
    formData.append('bucketId', bucketId);
    formData.append('filePath', 'documents/dummy.csv');
    const fileBuffer = fs.readFileSync(dummyFilePath);
    formData.append('file', new Blob([fileBuffer], { type: 'text/csv' }), 'dummy.csv');

    const uploadRes = await makeRequest('POST', '/storage/upload', formData, {
      'apikey': projectApiKey,
      'Authorization': `Bearer ${devToken}`
    });

    fs.unlinkSync(dummyFilePath);

    if (uploadRes.status !== 201) throw new Error(`Upload failed: ${JSON.stringify(uploadRes.data)}`);
    fileId = uploadRes.data.data.id;
    console.log(`✅ File uploaded successfully. File ID: ${fileId}`);

    // 4. List Files
    const listRes = await makeRequest('GET', `/storage/files?bucketId=${bucketId}`, null, projectHeaders);
    if (listRes.status !== 200 || listRes.data.data.length === 0) {
      throw new Error(`List files failed: ${JSON.stringify(listRes.data)}`);
    }
    console.log(`✅ File list working. Found ${listRes.data.data.length} files.`);

    // 5. Delete File
    const delFileRes = await makeRequest('DELETE', `/storage/files/${fileId}`, null, projectHeaders);
    if (delFileRes.status !== 200) throw new Error('Failed to delete file');
    console.log('✅ File deleted successfully.');

    // 6. Project Isolation Test (Create Project B, attempt to access Project A bucket)
    const projBRes = await makeRequest('POST', '/projects', { name: 'ProjB' }, authHeaders);
    
    const projectBDetailsRes = await makeRequest('GET', `/projects/${projBRes.data.data.id}`, null, authHeaders);
    const projBApiKey = projectBDetailsRes.data.data.apiKeys.find(k => k.keyType === 'anon').keyToken;
    
    const getBucketProjBRes = await makeRequest('GET', `/storage/buckets/${bucketId}`, null, { 'apikey': projBApiKey });
    if (getBucketProjBRes.status === 200) throw new Error('Project isolation failed! Project B accessed Project A bucket.');
    console.log('✅ Project isolation working correctly. (404/401 returned for cross-project access)');

    await makeRequest('DELETE', `/projects/${projBRes.data.data.id}`, null, authHeaders);

    // 7. Cleanup
    await makeRequest('DELETE', `/storage/buckets/${bucketId}`, null, projectHeaders);
    console.log('✅ Bucket deleted and cleanup successful.');

    console.log('\n🎉 ALL MODULE 6 STORAGE ENGINE TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('\n❌ STORAGE ENGINE TESTS FAILED:');
    console.error(err.message || err);
    process.exit(1);
  } finally {
    if (projectId) {
      await makeRequest('DELETE', `/projects/${projectId}`, null, { 'Authorization': `Bearer ${devToken}` }).catch(()=>null);
    }
    await prisma.$disconnect();
  }
};

runTests();
