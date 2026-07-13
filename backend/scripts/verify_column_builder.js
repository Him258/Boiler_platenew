/**
 * Integration Test Suite for Module 4B: Dynamic Column Builder
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
  console.log('🧪 Starting Kiaan Core Dynamic Column Builder Integration Tests...\n');

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
    const projName = `ColProj_${Date.now()}`;
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

    // 3. Create a temporary table
    console.log('\n3. Creating temporary table "users_profiles"...');
    const tableRes = await request('POST', `/projects/${projectId}/schema`, authHeaders, {
      tableName: 'users_profiles',
      columns: [
        { name: 'username', type: 'VARCHAR(255)' }
      ]
    });

    if (tableRes.status !== 201) {
      throw new Error(`Failed to create table: ${JSON.stringify(tableRes.body)}`);
    }
    console.log('✅ Table "users_profiles" created.');

    // 4. List columns initially
    console.log('\n4. Verifying initial table columns (system defaults + custom fields)...');
    const listRes1 = await request('GET', `/projects/${projectId}/schema/tables/users_profiles/columns`, authHeaders);
    
    if (listRes1.status !== 200) {
      throw new Error(`Failed to list columns: ${JSON.stringify(listRes1.body)}`);
    }

    const columns1 = listRes1.body.data;
    console.log('Initial Columns:');
    columns1.forEach(c => console.log(` - ${c.name} (${c.type}, nullable: ${c.nullable}, default: ${c.defaultValue}, indexed: ${c.indexed}, unique: ${c.unique})`));

    // Verify system columns are present
    const names1 = columns1.map(c => c.name);
    if (!names1.includes('id') || !names1.includes('created_at') || !names1.includes('updated_at') || !names1.includes('username')) {
      throw new Error('Initial columns are missing expected fields.');
    }
    console.log('✅ Initial columns verified.');

    // 5. Add a new column
    console.log('\n5. Adding column "bio" (type string, comment, indexed)...');
    const addColRes = await request('POST', `/projects/${projectId}/schema/tables/users_profiles/columns`, authHeaders, {
      name: 'bio',
      type: 'string',
      options: {
        nullable: true,
        indexed: true,
        comment: 'User biography details'
      }
    });

    if (addColRes.status !== 201) {
      throw new Error(`Failed to add column: ${JSON.stringify(addColRes.body)}`);
    }
    console.log('✅ Column "bio" added.');

    // List and check the new column
    const listRes2 = await request('GET', `/projects/${projectId}/schema/tables/users_profiles/columns`, authHeaders);
    const columns2 = listRes2.body.data;
    const bioCol = columns2.find(c => c.name === 'bio');
    if (!bioCol || bioCol.comment !== 'User biography details' || !bioCol.indexed) {
      throw new Error(`Verification of column "bio" failed: ${JSON.stringify(bioCol)}`);
    }
    console.log('✅ Column "bio" verified successfully.');

    // 6. Modify the column (Rename to "biography" and convert to text NOT NULL)
    console.log('\n6. Updating column "bio" to "biography" (type text, nullable: false)...');
    const updateColRes = await request('PATCH', `/projects/${projectId}/schema/tables/users_profiles/columns/bio`, authHeaders, {
      name: 'biography',
      type: 'text',
      options: {
        nullable: false,
        comment: 'Detailed biography description'
      }
    });

    if (updateColRes.status !== 200) {
      throw new Error(`Failed to update column: ${JSON.stringify(updateColRes.body)}`);
    }
    console.log('✅ Column "bio" updated.');

    // List and check the modified column
    const listRes3 = await request('GET', `/projects/${projectId}/schema/tables/users_profiles/columns`, authHeaders);
    const columns3 = listRes3.body.data;
    const oldBio = columns3.find(c => c.name === 'bio');
    const newBio = columns3.find(c => c.name === 'biography');

    if (oldBio) {
      throw new Error('Column "bio" still exists after rename.');
    }
    if (!newBio || newBio.type !== 'text' || newBio.nullable !== false || newBio.comment !== 'Detailed biography description') {
      throw new Error(`Verification of column "biography" failed: ${JSON.stringify(newBio)}`);
    }
    console.log('✅ Modified column "biography" verified successfully.');

    // 7. Verify security / safety guards (should fail)
    console.log('\n7. Verifying safety guards (attempting forbidden operations)...');
    
    // Guard 1: Drop system column
    console.log(' - Attempting to drop system column "id" (should be blocked)...');
    const dropSystemRes = await request('DELETE', `/projects/${projectId}/schema/tables/users_profiles/columns/id`, authHeaders);
    if (dropSystemRes.status !== 400 || !dropSystemRes.body.error.message.includes('Cannot drop system column')) {
      throw new Error(`Safety guard failed: Allowed dropping system column "id" ${JSON.stringify(dropSystemRes.body)}`);
    }
    console.log('   ✅ Drop system column blocked correctly.');

    // Guard 2: SQL Injection block check
    console.log(' - Attempting SQL injection in column name (should be blocked)...');
    const sqlInjectionRes = await request('POST', `/projects/${projectId}/schema/tables/users_profiles/columns`, authHeaders, {
      name: 'test_col`; DROP TABLE `users_profiles`; --',
      type: 'string'
    });
    if (sqlInjectionRes.status !== 400 || !sqlInjectionRes.body.error.message.includes('Invalid database identifier')) {
      throw new Error(`Safety guard failed: Allowed SQL injection identifier ${JSON.stringify(sqlInjectionRes.body)}`);
    }
    console.log('   ✅ SQL injection identifier blocked correctly.');

    // 8. Drop the column
    console.log('\n8. Dropping column "biography"...');
    const dropColRes = await request('DELETE', `/projects/${projectId}/schema/tables/users_profiles/columns/biography`, authHeaders);
    if (dropColRes.status !== 200) {
      throw new Error(`Failed to drop column: ${JSON.stringify(dropColRes.body)}`);
    }
    console.log('✅ Column "biography" dropped.');

    // Verify it is gone
    const listRes4 = await request('GET', `/projects/${projectId}/schema/tables/users_profiles/columns`, authHeaders);
    const columns4 = listRes4.body.data;
    if (columns4.find(c => c.name === 'biography')) {
      throw new Error('Column "biography" still exists after dropping.');
    }
    console.log('✅ Drop verification successful.');

    // 9. Clean up temporary table and project
    console.log('\n9. Cleaning up table and project...');
    const dropTableRes = await request('DELETE', `/projects/${projectId}/schema/users_profiles`, authHeaders);
    if (dropTableRes.status !== 200) {
      console.warn('⚠️ Warning: Failed to drop temporary table during cleanup.');
    } else {
      console.log('✅ Table dropped.');
    }

    const deleteProjRes = await request('DELETE', `/projects/${projectId}`, authHeaders);
    if (deleteProjRes.status !== 200) {
      console.warn('⚠️ Warning: Failed to delete temporary test project during cleanup.');
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
