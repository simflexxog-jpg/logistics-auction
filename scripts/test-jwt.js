const BASE = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const PASS = process.env.TEST_PASS || 'password123';

async function run() {
  console.log('Base URL:', BASE);
  try {
    const h = await fetch(`${BASE}/api/health`);
    console.log('/api/health', h.status, await h.text());
  } catch (e) {
    console.error('Health check failed:', e.message);
  }

  try {
    console.log('Attempting login for', EMAIL);
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASS })
    });
    const body = await r.json().catch(() => null);
    console.log('Login status', r.status, body);
    if (!body || !body.token) {
      console.error('No token returned from login; try registering or check credentials');
      return;
    }

    const token = body.token;
    console.log('Token length:', token.length);

    const p = await fetch(`${BASE}/api/listings`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('/api/listings', p.status);
    const pb = await p.text();
    console.log(pb);
  } catch (e) {
    console.error('Error during login/protected request:', e.message);
  }
}

run();
