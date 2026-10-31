// tests/api_test.js
// Automated End-to-End Verification Suite for Result Publishing System

const http = require('node:http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (body) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(reqOptions, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = raw ? JSON.parse(raw) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING AUTOMATED SYSTEM VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Status API
    const statusRes = await request('/api/public/status');
    assert(statusRes.status === 200, 'GET /api/public/status returns 200 OK');
    assert(statusRes.body.settings.prefixes.length === 4, 'Status includes 4 prefixes (R$R, C$H, N$V, R$Y)');
    assert(statusRes.body.currentDate.length === 10, 'Status includes formatted date (DD-MM-YYYY)');

    // 2. Captcha Generation & Verification
    const captchaRes = await request('/api/public/captcha');
    assert(captchaRes.status === 200, 'GET /api/public/captcha returns 200 OK');
    assert(captchaRes.body.captchaText && captchaRes.body.captchaToken, 'Captcha returns text and signed token');

    const invalidVerify = await request('/api/public/verify-captcha', { method: 'POST' }, {
      captchaToken: captchaRes.body.captchaToken,
      userInput: 'WRONG'
    });
    assert(invalidVerify.status === 400 && !invalidVerify.body.success, 'Invalid captcha input is correctly rejected');

    const validVerify = await request('/api/public/verify-captcha', { method: 'POST' }, {
      captchaToken: captchaRes.body.captchaToken,
      userInput: captchaRes.body.captchaText
    });
    assert(validVerify.status === 200 && validVerify.body.success, 'Valid captcha input succeeds');

    // 3. Admin Authentication
    const badLogin = await request('/api/admin/login', { method: 'POST' }, {
      username: 'admin',
      password: 'wrongpassword'
    });
    assert(badLogin.status === 401, 'Bad admin password returns 401 Unauthorized');

    const goodLogin = await request('/api/admin/login', { method: 'POST' }, {
      username: 'admin',
      password: 'admin123'
    });
    assert(goodLogin.status === 200 && goodLogin.body.token, 'Good login returns 200 OK and JWT token');
    const adminToken = goodLogin.body.token;

    // 4. Admin Session Check
    const meRes = await request('/api/admin/me', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(meRes.status === 200 && meRes.body.user.username === 'admin', 'GET /api/admin/me validates token');

    // 5. Admin Publish Result for Slot 11:00
    const todayIso = statusRes.body.currentDateIso;
    const publishRes = await request('/api/admin/publish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      date: todayIso,
      slotTime: '11:00',
      r1: '15',
      r2: '48',
      r3: '92',
      r4: '30'
    });
    assert(publishRes.status === 200 && publishRes.body.success, 'POST /api/admin/publish declares result for 11:00');

    // 6. Public Live Result Check
    const liveRes = await request('/api/public/live');
    assert(liveRes.status === 200, 'GET /api/public/live returns 200 OK');
    if (liveRes.body.isOpen) {
      assert(liveRes.body.cards.length === 4, 'Live returns 4 cards');
      console.log('   Live cards:', liveRes.body.cards.map(c => c.code).join(' | '));
    } else {
      console.log('   (Service reported closed due to operating hours condition)');
    }

    // 7. Public All Results Table Check
    const allRes = await request(`/api/public/results?date=${todayIso}`);
    assert(allRes.status === 200, 'GET /api/public/results returns 200 OK');
    assert(allRes.body.slots.length === 59, 'Table contains exactly 59 slots (08:30 to 23:00 every 15 mins)');
    const slot11 = allRes.body.slots.find(s => s.slotTime === '11:00');
    assert(slot11 && slot11.isPublished, 'Slot 11:00 is marked published in table');
    assert(slot11.c1 === 'R$R15' && slot11.c2 === 'C$H48' && slot11.c3 === 'N$V92' && slot11.c4 === 'R$Y30',
      'Slot 11:00 has exact numbers R$R15, C$H48, N$V92, R$Y30');

    // 7b. Future Slot Protection Check (Pre-entered future slots must be concealed as '--')
    await request('/api/admin/publish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      date: todayIso,
      slotTime: '22:45',
      r1: '77',
      r2: '88',
      r3: '99',
      r4: '00'
    });
    const allResAfterFuture = await request(`/api/public/results?date=${todayIso}`);
    const slot2245 = allResAfterFuture.body.slots.find(s => s.slotTime === '22:45');
    assert(slot2245 && !slot2245.isPublished, 'Future slot 22:45 is strictly NOT published in public view');
    assert(slot2245.c1 === '--' && slot2245.c2 === '--' && slot2245.c3 === '--' && slot2245.c4 === '--',
      'Future slot 22:45 numbers are concealed as --');

    // 8. Static Frontend Files Serving Check
    const userPage = await request('/');
    assert(userPage.status === 200 && userPage.headers['content-type'].includes('text/html'),
      'User frontend index.html served at root /');

    const adminPage = await request('/admin');
    assert(adminPage.status === 200 && adminPage.headers['content-type'].includes('text/html'),
      'Admin panel index.html served at /admin');

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
