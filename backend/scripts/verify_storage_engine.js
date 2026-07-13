/**
 * Integration Test Suite for Module 5: Dynamic Storage Engine
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

async function requestFormData(method, path, headers = {}, formData) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      ...headers
    },
    body: formData
  };
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
  console.log('🧪 Starting Kiaan Core Dynamic Storage Engine Integration Tests...\n');

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

    // 2. Provision the temporary test project
    const projName = `StorageProj_${Date.now()}`;
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
    const userEmail = `user_store_${Date.now()}@test.com`;
    const signupRes = await request('POST', '/auth/signup', { 'apikey': anonKey }, {
      email: userEmail,
      password: 'userstorepassword123'
    });

    if (signupRes.status !== 201) {
      throw new Error(`User signup failed: ${JSON.stringify(signupRes.body)}`);
    }
    console.log('✅ User registered successfully. Email:', userEmail);

    // 5. Login project user to get USER_ACCESS_TOKEN
    console.log('\n5. Logging in project user...');
    const userLoginRes = await request('POST', '/auth/login', { 'apikey': anonKey }, {
      email: userEmail,
      password: 'userstorepassword123'
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

    // 6. Create Bucket: "sandbox_bucket" (Private)
    console.log('\n6. Creating bucket "sandbox_bucket" using /storage/v1/bucket endpoint...');
    const createBucketRes = await request('POST', '/storage/v1/bucket', clientHeaders, {
      name: 'sandbox_bucket',
      isPublic: false
    });

    if (createBucketRes.status !== 201) {
      throw new Error(`Failed to create bucket: ${JSON.stringify(createBucketRes.body)}`);
    }
    console.log('✅ Bucket "sandbox_bucket" created successfully.');

    // 7. Upload dynamic image/PDF
    console.log('\n7. Uploading test PDF file to "sandbox_bucket/documents/contract.pdf"...');
    const formData = new FormData();
    const fileBlob = new Blob([Buffer.from('Fake PDF document bytes')], { type: 'application/pdf' });
    formData.append('file', fileBlob, 'contract.pdf');

    const uploadRes = await requestFormData(
      'POST', 
      '/storage/v1/object/sandbox_bucket/documents/contract.pdf', 
      clientHeaders, 
      formData
    );

    if (uploadRes.status !== 201) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadRes.body)}`);
    }
    console.log('✅ File uploaded successfully. Metadata:', uploadRes.body.data);

    // 8. List files
    console.log('\n8. Listing files in "sandbox_bucket"...');
    const listRes = await request('GET', '/storage/v1/object/list/sandbox_bucket', clientHeaders);
    if (listRes.status !== 200) {
      throw new Error(`List failed: ${JSON.stringify(listRes.body)}`);
    }
    console.log('Files returned:', listRes.body.data);
    if (listRes.body.data.length !== 1 || listRes.body.data[0].path !== 'documents/contract.pdf') {
      throw new Error('List verification failed.');
    }
    console.log('✅ File list verified.');

    // 9. Download file (Private - must block unauthenticated)
    console.log('\n9. Testing private download security bounds...');
    console.log(' - Requesting file without headers (should fail with 401 or 400)...');
    const badDlRes = await request('GET', '/storage/v1/object/sandbox_bucket/documents/contract.pdf');
    if (badDlRes.status !== 401 && badDlRes.status !== 400) {
      throw new Error('Private file accessible without authentication!');
    }
    console.log('   ✅ Unauthorized access rejected correctly.');

    console.log(' - Requesting file with valid credentials...');
    const dlUrl = `${BASE_URL}/storage/v1/object/sandbox_bucket/documents/contract.pdf`;
    const dlRes = await fetch(dlUrl, { headers: clientHeaders });
    if (dlRes.status !== 200) {
      throw new Error(`File download failed: status ${dlRes.status}`);
    }
    const contentType = dlRes.headers.get('Content-Type');
    const content = await dlRes.text();
    console.log('   Downloaded Content-Type:', contentType);
    console.log('   Downloaded Content:', content);
    if (contentType !== 'application/pdf' || content !== 'Fake PDF document bytes') {
      throw new Error('Downloaded file type or content mismatch.');
    }
    console.log('   ✅ Private file retrieved successfully with correct headers.');

    // 10. Generate Signed URL
    console.log('\n10. Generating temporary Signed URL for 5 minutes...');
    const signRes = await request('POST', '/storage/v1/object/sign/sandbox_bucket/documents/contract.pdf', clientHeaders, {
      expiresIn: 300
    });
    if (signRes.status !== 200) {
      throw new Error(`Failed to generate signed URL: ${JSON.stringify(signRes.body)}`);
    }
    const signedUrl = signRes.body.data.url;
    console.log('    Generated Signed Path:', signedUrl);

    // 11. Access Signed URL (Unauthenticated)
    console.log('\n11. Verifying Signed URL access (no headers)...');
    const signedFetch = await fetch(`${BASE_URL}${signedUrl}`);
    if (signedFetch.status !== 200) {
      throw new Error(`Signed URL fetch failed: status ${signedFetch.status}`);
    }
    const signedContent = await signedFetch.text();
    console.log('    Signed URL fetched content:', signedContent);
    if (signedContent !== 'Fake PDF document bytes') {
      throw new Error('Signed URL content mismatch.');
    }
    console.log('    ✅ Signed URL validated successfully.');

    // 12. Delete File
    console.log('\n12. Deleting file "documents/contract.pdf"...');
    const deleteFileRes = await request('DELETE', '/storage/v1/object/sandbox_bucket/documents/contract.pdf', clientHeaders);
    if (deleteFileRes.status !== 200) {
      throw new Error(`Delete file failed: ${JSON.stringify(deleteFileRes.body)}`);
    }
    console.log('✅ File deleted.');

    // 13. Delete Bucket
    console.log('\n13. Deleting bucket "sandbox_bucket"...');
    const deleteBucketRes = await request('DELETE', '/storage/v1/bucket/sandbox_bucket', clientHeaders);
    if (deleteBucketRes.status !== 200) {
      throw new Error(`Delete bucket failed: ${JSON.stringify(deleteBucketRes.body)}`);
    }
    console.log('✅ Bucket deleted.');

    // 14. Clean up Sandbox Project
    console.log('\n14. Deleting temporary project...');
    const deleteProjRes = await request('DELETE', `/projects/${projectId}`, authHeaders);
    if (deleteProjRes.status !== 200) {
      console.warn('⚠️ Warning: Failed to delete sandbox project.');
    } else {
      console.log('✅ Project deleted.');
    }

    console.log('\n🎉 ALL STORAGE ENGINE TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('\n❌ INTEGRATION TESTS FAILED: \n', error);
    process.exit(1);
  }
}

runTests();
