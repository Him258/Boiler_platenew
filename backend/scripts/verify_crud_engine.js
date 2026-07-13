/**
 * Integration Test Suite for Module 4C: Dynamic CRUD Engine
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
    // No json body
  }
  return {
    status: res.status,
    body: responseBody
  };
}

async function runTests() {
  console.log('🧪 Starting Kiaan Core Dynamic CRUD Engine Integration Tests...\n');

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
    const projName = `CrudProj_${Date.now()}`;
    console.log(`\n2. Provisioning temporary test project: ${projName}...`);
    const projRes = await request('POST', '/projects', authHeaders, {
      name: projName
    });

    if (projRes.status !== 201) {
      throw new Error(`Failed to create test project: ${JSON.stringify(projRes.body)}`);
    }

    const project = projRes.body.data;
    const projectId = project.id;
    console.log(`✅ Test project created. Project ID: ${projectId}`);
    console.log('Waiting 3 seconds for database provisioning and schema bootstrap...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Create a temporary table "contacts"
    console.log('\n3. Creating temporary table "contacts"...');
    const tableRes = await request('POST', `/projects/${projectId}/schema/tables`, authHeaders, {
      name: 'contacts',
      columns: [
        { name: 'first_name', type: 'string' },
        { name: 'last_name', type: 'string' },
        { name: 'age', type: 'integer' },
        { name: 'status', type: 'string' }
      ]
    });

    if (tableRes.status !== 201) {
      throw new Error(`Failed to create table: ${JSON.stringify(tableRes.body)}`);
    }
    console.log('✅ Table "contacts" created.');

    // 4. Insert dynamic records
    console.log('\n4. Inserting record 1 (John Doe, age 25, status active)...');
    const r1 = await request('POST', `/projects/${projectId}/data/contacts`, authHeaders, {
      first_name: 'John',
      last_name: 'Doe',
      age: 25,
      status: 'active'
    });
    if (r1.status !== 201) throw new Error(`Insert 1 failed: ${JSON.stringify(r1.body)}`);
    console.log('✅ Record 1 inserted. ID:', r1.body.data.id);

    console.log('Inserting record 2 (Jane Smith, age 30, status active)...');
    const r2 = await request('POST', `/projects/${projectId}/data/contacts`, authHeaders, {
      first_name: 'Jane',
      last_name: 'Smith',
      age: 30,
      status: 'active'
    });
    if (r2.status !== 201) throw new Error(`Insert 2 failed: ${JSON.stringify(r2.body)}`);
    console.log('✅ Record 2 inserted. ID:', r2.body.data.id);

    console.log('Inserting record 3 (Bob Johnson, age 45, status suspended)...');
    const r3 = await request('POST', `/projects/${projectId}/data/contacts`, authHeaders, {
      first_name: 'Bob',
      last_name: 'Johnson',
      age: 45,
      status: 'suspended'
    });
    if (r3.status !== 201) throw new Error(`Insert 3 failed: ${JSON.stringify(r3.body)}`);
    console.log('✅ Record 3 inserted. ID:', r3.body.data.id);

    // 5. Query and verify listings
    console.log('\n5. Listing records with count query parameter...');
    const listRes = await request('GET', `/projects/${projectId}/data/contacts?count=true`, authHeaders);
    if (listRes.status !== 200) throw new Error(`List failed: ${JSON.stringify(listRes.body)}`);
    console.log('Count metadata total:', listRes.body.meta.total);
    if (listRes.body.meta.total !== 3) throw new Error('Count verification failed.');
    console.log('✅ Count verified successfully.');

    // Query filters
    console.log('\nTesting equality filters (?status=active)...');
    const filterRes = await request('GET', `/projects/${projectId}/data/contacts?status=active&count=true`, authHeaders);
    if (filterRes.status !== 200) throw new Error(`Filter failed: ${JSON.stringify(filterRes.body)}`);
    console.log('Active status count:', filterRes.body.meta.total);
    if (filterRes.body.meta.total !== 2) throw new Error('Filter verification failed.');
    console.log('✅ Filter verified successfully.');

    // Full text search
    console.log('\nTesting text search (?search=john)...');
    const searchRes = await request('GET', `/projects/${projectId}/data/contacts?search=john`, authHeaders);
    if (searchRes.status !== 200) throw new Error(`Search failed: ${JSON.stringify(searchRes.body)}`);
    console.log('Matched search records count:', searchRes.body.data.length);
    if (searchRes.body.data.length !== 2) {
      throw new Error('Search verification failed.');
    }
    console.log('✅ Text search verified successfully.');

    // Select fields
    console.log('\nTesting column selection (?select=first_name,age)...');
    const selectRes = await request('GET', `/projects/${projectId}/data/contacts?select=first_name,age`, authHeaders);
    if (selectRes.status !== 200) throw new Error(`Select failed: ${JSON.stringify(selectRes.body)}`);
    const item = selectRes.body.data[0];
    console.log('Select item returned fields:', Object.keys(item));
    if (item.last_name !== undefined || item.first_name === undefined || item.age === undefined) {
      throw new Error('Select verification failed.');
    }
    console.log('✅ Field selection verified successfully.');

    // Sorting and pagination
    console.log('\nTesting pagination and sorting (?sort=age&order=desc&limit=1)...');
    const sortRes = await request('GET', `/projects/${projectId}/data/contacts?sort=age&order=desc&limit=1`, authHeaders);
    if (sortRes.status !== 200) throw new Error(`Sort failed: ${JSON.stringify(sortRes.body)}`);
    console.log('Top record age:', sortRes.body.data[0].age);
    if (sortRes.body.data[0].age !== 45 || sortRes.body.data.length !== 1) {
      throw new Error('Sort/pagination verification failed.');
    }
    console.log('✅ Sorting and pagination verified successfully.');

    // 6. Get a single record
    const targetId = r1.body.data.id;
    console.log(`\n6. Retrieving single record by ID: ${targetId}...`);
    const singleRes = await request('GET', `/projects/${projectId}/data/contacts/${targetId}`, authHeaders);
    if (singleRes.status !== 200) throw new Error(`Get single record failed: ${JSON.stringify(singleRes.body)}`);
    console.log('Single record username:', singleRes.body.data.first_name);
    if (singleRes.body.data.first_name !== 'John') throw new Error('Single record verification failed.');
    console.log('✅ Get single record verified successfully.');

    // 7. Update record
    console.log(`\n7. Updating record ${targetId} (status: suspended)...`);
    const updateRes = await request('PATCH', `/projects/${projectId}/data/contacts/${targetId}`, authHeaders, {
      status: 'suspended'
    });
    if (updateRes.status !== 200) throw new Error(`Update failed: ${JSON.stringify(updateRes.body)}`);
    console.log('Updated status:', updateRes.body.data.status);
    if (updateRes.body.data.status !== 'suspended') throw new Error('Update verification failed.');
    console.log('✅ Update verified successfully.');

    // 8. Security guards (should be blocked)
    console.log('\n8. Verifying security and validation guards...');
    
    // Guard 1: Block CRUD on system tables
    console.log(' - Attempting to select from "users" system table (should be blocked)...');
    const systemRes = await request('GET', `/projects/${projectId}/data/users`, authHeaders);
    if (systemRes.status !== 400 || !systemRes.body.error.message.includes('restricted')) {
      throw new Error(`Safety guard failed: Allowed querying system table "users" ${JSON.stringify(systemRes.body)}`);
    }
    console.log('   ✅ System table query blocked correctly.');

    // Guard 2: Block dynamic columns that do not exist
    console.log(' - Attempting to insert unknown column "location" (should be blocked)...');
    const unknownColRes = await request('POST', `/projects/${projectId}/data/contacts`, authHeaders, {
      first_name: 'Alice',
      location: 'New York'
    });
    if (unknownColRes.status !== 400 || !unknownColRes.body.error.message.includes('does not exist')) {
      throw new Error(`Safety guard failed: Allowed unknown column insertion ${JSON.stringify(unknownColRes.body)}`);
    }
    console.log('   ✅ Unknown column insertion blocked correctly.');

    // 9. Delete record
    console.log(`\n9. Deleting record ${targetId}...`);
    const deleteRes = await request('DELETE', `/projects/${projectId}/data/contacts/${targetId}`, authHeaders);
    if (deleteRes.status !== 200) throw new Error(`Delete failed: ${JSON.stringify(deleteRes.body)}`);
    console.log('✅ Record deleted.');

    // Verify record is gone
    const checkRes = await request('GET', `/projects/${projectId}/data/contacts/${targetId}`, authHeaders);
    if (checkRes.status !== 404) {
      throw new Error(`Verification failed: Record still found after deletion: ${JSON.stringify(checkRes.body)}`);
    }
    console.log('✅ Delete verification successful.');

    // 10. Clean up table and project
    console.log('\n10. Cleaning up table and project...');
    const dropTableRes = await request('DELETE', `/projects/${projectId}/schema/tables/contacts`, authHeaders);
    if (dropTableRes.status !== 200) {
      console.warn('⚠️ Warning: Failed to drop temporary table.');
    } else {
      console.log('✅ Dynamic table dropped.');
    }

    const deleteProjRes = await request('DELETE', `/projects/${projectId}`, authHeaders);
    if (deleteProjRes.status !== 200) {
      console.warn('⚠️ Warning: Failed to delete test project.');
    } else {
      console.log('✅ Test project deleted.');
    }

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('\n❌ INTEGRATION TESTS FAILED: \n', error);
    process.exit(1);
  }
}

runTests();
