const BASE_URL = 'http://localhost:5000/api/v1';

async function debug() {
  console.log('Logging in...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'boilerplate@gmail.com', password: '123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.tokens.accessToken;
  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log('Creating project...');
  const projRes = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'DebugProj' })
  });
  const projData = await projRes.json();
  const projectId = projData.data.id;

  console.log('Waiting 3.5 seconds...');
  await new Promise(r => setTimeout(r, 3500));

  // Get roles
  console.log('Fetching roles...');
  const rolesRes = await fetch(`${BASE_URL}/rbac/roles?projectId=${projectId}`, {
    method: 'GET',
    headers: authHeaders
  });
  const rolesData = await rolesRes.json();
  const devRole = rolesData.data.find(r => r.name === 'Developer');

  console.log('Fetching role permissions...');
  const url = `${BASE_URL}/rbac/roles/${devRole.id}/permissions`;
  const getRes = await fetch(url, {
    method: 'GET',
    headers: authHeaders
  });
  const getText = await getRes.text();
  console.log('GET role permissions response status:', getRes.status);
  console.log('GET role permissions response body:', getText);

  // cleanup
  await fetch(`${BASE_URL}/projects/${projectId}`, { method: 'DELETE', headers: authHeaders });
}

debug();
