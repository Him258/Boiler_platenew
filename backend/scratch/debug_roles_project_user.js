const BASE_URL = 'http://localhost:5001/api/v1';

async function debug() {
  console.log('1. Logging in as developer...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'boilerplate@gmail.com', password: '123456' })
  });
  const loginData = await loginRes.json();
  const devToken = loginData.data.tokens.accessToken;
  const devHeaders = { 'Authorization': `Bearer ${devToken}`, 'Content-Type': 'application/json' };

  console.log('2. Creating temporary test project...');
  const projRes = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ name: 'ProjC' })
  });
  const projData = await projRes.json();
  const projectId = projData.data.id;
  const anonApiKey = projData.data.apiKeys.find(k => k.keyType === 'anon').keyToken;

  console.log('Waiting 3.5 seconds for provisioning...');
  await new Promise(r => setTimeout(r, 3500));

  console.log('3. Registering project user...');
  const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonApiKey },
    body: JSON.stringify({ email: 'user_c@test.com', password: 'userpassword123' })
  });
  const signupData = await signupRes.json();
  console.log('Signup status:', signupRes.status);

  console.log('4. Logging in project user...');
  const userLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonApiKey },
    body: JSON.stringify({ email: 'user_c@test.com', password: 'userpassword123' })
  });
  const userLoginData = await userLoginRes.json();
  const userToken = userLoginData.data.accessToken;
  const userHeaders = { 'Authorization': `Bearer ${userToken}` };

  console.log('5. Fetching roles using ONLY project user Bearer token...');
  const rolesRes = await fetch(`${BASE_URL}/rbac/roles`, {
    method: 'GET',
    headers: userHeaders
  });
  const rolesText = await rolesRes.text();
  console.log('Roles response status:', rolesRes.status);
  console.log('Roles response body:', rolesText.substring(0, 300));

  // cleanup
  await fetch(`${BASE_URL}/projects/${projectId}`, { method: 'DELETE', headers: devHeaders });
}

debug();
