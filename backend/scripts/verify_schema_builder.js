async function run() {
  console.log('🧪 Starting Kiaan Core Dynamic Schema Builder Integration Tests...\n');

  const API_URL = 'http://localhost:5000/api/v1';
  let token = '';
  let projectId = '';
  let projectRefId = '';

  try {
    // 1. Login to Control Plane
    console.log('1. Logging in to Control Plane...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'boilerplate@gmail.com',
        password: '123456'
      })
    });
    
    if (!loginRes.ok) {
      const errText = await loginRes.text();
      throw new Error(`Login failed with status ${loginRes.status}: ${errText}`);
    }
    const loginData = await loginRes.json();
    token = loginData.data.tokens.accessToken;
    console.log('✅ Control plane login success.\n');

    // 2. Create a temporary project for testing
    console.log('2. Provisioning Project for schema testing...');
    const projRes = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: `SchemaTestProj_${Date.now()}` })
    });

    if (!projRes.ok) {
      const errText = await projRes.text();
      throw new Error(`Project creation failed with status ${projRes.status}: ${errText}`);
    }
    const projData = await projRes.json();
    projectId = projData.data.id;
    projectRefId = projData.data.refId;
    console.log(`✅ Project Created. ID: ${projectId}, RefId: ${projectRefId}`);
    
    // Wait for provisioning & schema bootstrap
    console.log('Waiting 5 seconds for database provisioning...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('');

    // 3. Create a table: customers
    console.log('3. Creating dynamic table "customers"...');
    const createRes = await fetch(`${API_URL}/projects/${projectId}/schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tableName: 'customers',
        columns: [
          { name: 'name', type: 'VARCHAR(255)' },
          { name: 'email', type: 'VARCHAR(255)' },
          { name: 'phone', type: 'VARCHAR(30)' },
          { name: 'notes', type: 'TEXT' },
          { name: 'age', type: 'INT' },
          { name: 'is_active', type: 'BOOLEAN' }
        ]
      })
    });

    const createData = await createRes.json();
    console.log('Response:', createData);
    if (!createRes.ok) {
      throw new Error(`Table creation failed with status ${createRes.status}: ${JSON.stringify(createData)}`);
    }
    console.log('✅ Table "customers" created successfully.\n');

    // 4. List tables in the database
    console.log('4. Listing tables from the project database...');
    const listRes = await fetch(`${API_URL}/projects/${projectId}/schema`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!listRes.ok) {
      throw new Error(`Listing tables failed with status ${listRes.status}`);
    }
    const listData = await listRes.json();
    console.log('Tables found:', listData.data);
    if (!listData.data.includes('customers')) {
      throw new Error('Created table "customers" not found in the tables list!');
    }
    console.log('✅ Tables listed correctly (includes "customers").\n');

    // 5. Describe table structure
    console.log('5. Describing structure of table "customers"...');
    const descRes = await fetch(`${API_URL}/projects/${projectId}/schema/customers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!descRes.ok) {
      throw new Error(`Describing table failed with status ${descRes.status}`);
    }
    const descData = await descRes.json();
    console.log('Columns structure:');
    console.table(descData.data);
    
    const colNames = descData.data.map(c => c.name);
    const expectedCols = ['id', 'name', 'email', 'phone', 'notes', 'age', 'is_active', 'created_at', 'updated_at'];
    for (const expCol of expectedCols) {
      if (!colNames.includes(expCol)) {
        throw new Error(`Expected column "${expCol}" was not found in table structure!`);
      }
    }
    console.log('✅ Table structure verified (all dynamic and system fields present).\n');

    // 6. SQL Injection & Type Validation checks (must fail)
    console.log('6. Verification of input validation constraints...');
    
    // Test case A: Invalid table name characters
    const testARes = await fetch(`${API_URL}/projects/${projectId}/schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tableName: 'customers; DROP TABLE users; --',
        columns: [{ name: 'name', type: 'VARCHAR(255)' }]
      })
    });
    if (testARes.ok) {
      throw new Error('Test Case A failed: SQL injection table name was allowed!');
    }
    console.log('✅ Test Case A passed: Rejected invalid table name identifier.');

    // Test case B: Invalid column name characters
    const testBRes = await fetch(`${API_URL}/projects/${projectId}/schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tableName: 'orders',
        columns: [{ name: 'customer-id', type: 'INT' }]
      })
    });
    if (testBRes.ok) {
      throw new Error('Test Case B failed: Invalid column name with hyphen was allowed!');
    }
    console.log('✅ Test Case B passed: Rejected invalid column name identifier.');

    // Test case C: Unauthorized database data type
    const testCRes = await fetch(`${API_URL}/projects/${projectId}/schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tableName: 'logs',
        columns: [{ name: 'payload', type: 'BLOB' }]
      })
    });
    if (testCRes.ok) {
      throw new Error('Test Case C failed: Unauthorized type "BLOB" was allowed!');
    }
    console.log('✅ Test Case C passed: Rejected invalid column type.');

    // Test case D: Attempting to create column with a reserved system name
    const testDRes = await fetch(`${API_URL}/projects/${projectId}/schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tableName: 'orders',
        columns: [{ name: 'created_at', type: 'DATETIME' }]
      })
    });
    if (testDRes.ok) {
      throw new Error('Test Case D failed: Reserved name "created_at" was allowed!');
    }
    console.log('✅ Test Case D passed: Rejected reserved system field override.');
    console.log('');

    // 7. Drop Table
    console.log('7. Dropping dynamic table "customers"...');
    const dropRes = await fetch(`${API_URL}/projects/${projectId}/schema/customers`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!dropRes.ok) {
      throw new Error(`Dropping table failed with status ${dropRes.status}`);
    }
    const dropData = await dropRes.json();
    console.log('Response:', dropData);

    // Verify it was actually dropped
    const listAfterDropRes = await fetch(`${API_URL}/projects/${projectId}/schema`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const listAfterDropData = await listAfterDropRes.json();
    if (listAfterDropData.data.includes('customers')) {
      throw new Error('Table "customers" still exists after drop request!');
    }
    console.log('✅ Table "customers" dropped successfully.\n');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    process.exit(1);
  } finally {
    // 8. Clean up created project
    if (projectId) {
      console.log('8. Cleaning up test project...');
      try {
        const cleanupRes = await fetch(`${API_URL}/projects/${projectId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (cleanupRes.ok) {
          console.log('✅ Test project cleaned up successfully.\n');
        } else {
          console.error(`Failed to clean up test project with status ${cleanupRes.status}`);
        }
      } catch (err) {
        console.error('Failed to clean up test project:', err.message);
      }
    }
  }

  console.log('🎉 ALL DYNAMIC SCHEMA BUILDER TESTS PASSED SUCCESSFULLY! 🎉');
}

run();
