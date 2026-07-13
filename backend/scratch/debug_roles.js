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
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  console.log('Fetching roles (without any project context headers)...');
  const rolesRes = await fetch(`${BASE_URL}/rbac/roles`, {
    method: 'GET',
    headers: authHeaders
  });
  const rolesText = await rolesRes.text();
  console.log('Roles response status:', rolesRes.status);
  console.log('Roles response body:', rolesText);
}

debug();
