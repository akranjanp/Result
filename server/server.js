// server/server.js
// Ultra-fast HTTP + REST API + SSE Server with PostgreSQL & SQLite Dual Database Support

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const db = require('./db');
const auth = require('./auth');
const captcha = require('./captcha');
const timeSlots = require('./timeSlots');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.apk': 'application/vnd.android.package-archive'
};

// Set of connected SSE clients
const sseClients = new Set();

/**
 * Broadcast event to all connected SSE clients
 */
function broadcastSSE(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

/**
 * Send JSON response with CORS headers
 */
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  });
  res.end(body);
}

/**
 * Parse incoming JSON body
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Middleware: Verify Admin Token
 */
function requireAdmin(req) {
  const authHeader = req.headers['authorization'];
  const token = auth.extractToken(authHeader);
  if (!token) return null;
  const decoded = auth.verifyToken(token);
  return decoded;
}

/**
 * Helper to serve static files
 */
function serveStaticFile(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=3600'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // -------------------------------------------------------------
  // PUBLIC API ROUTES
  // -------------------------------------------------------------

  // SSE Stream for live updates
  if (pathname === '/api/public/stream' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: connected\ndata: {"status":"connected"}\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // Get current status & settings
  if (pathname === '/api/public/status' && method === 'GET') {
    const now = new Date();
    const dateInfo = timeSlots.getDateStrings(now);
    const settings = await db.getAllSettings();
    const isOperatingHours = timeSlots.isWithinOperatingHours(now);
    const enforceHours = settings.enforce_operating_hours === '1';
    const isOpen = enforceHours ? isOperatingHours : true;
    const activeSlot = timeSlots.getCurrentSlot(now);

    return sendJson(res, 200, {
      success: true,
      currentDate: dateInfo.display,
      currentDateIso: dateInfo.iso,
      currentTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      activeSlot,
      isOperatingHours,
      isOpen,
      settings: {
        prefixes: [
          settings.prefix_1 || 'R$R',
          settings.prefix_2 || 'C$H',
          settings.prefix_3 || 'N$V',
          settings.prefix_4 || 'R$Y'
        ],
        groupTitle: settings.yantra_group_title || 'YANTRA GROUP',
        eventTitle: settings.event_code_title || 'Gift Event Code',
        version: settings.app_version || 'Version-1.0'
      }
    });
  }

  // Generate Captcha
  if (pathname === '/api/public/captcha' && method === 'GET') {
    const newCaptcha = captcha.createCaptcha(5);
    return sendJson(res, 200, {
      success: true,
      captchaText: newCaptcha.captchaText,
      captchaToken: newCaptcha.captchaToken
    });
  }

  // Verify Captcha
  if (pathname === '/api/public/verify-captcha' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const isValid = captcha.verifyCaptcha(body.captchaToken, body.userInput);
      if (!isValid) {
        return sendJson(res, 400, {
          success: false,
          message: 'Incorrect or expired captcha. Please try again.'
        });
      }
      return sendJson(res, 200, {
        success: true,
        message: 'Captcha verified successfully'
      });
    } catch (e) {
      return sendJson(res, 400, { success: false, message: e.message });
    }
  }

  // Get Live 4 Results
  if (pathname === '/api/public/live' && method === 'GET') {
    const now = new Date();
    const dateInfo = timeSlots.getDateStrings(now);
    const settings = await db.getAllSettings();
    const isOperatingHours = timeSlots.isWithinOperatingHours(now);
    const enforceHours = settings.enforce_operating_hours === '1';
    const isOpen = enforceHours ? isOperatingHours : true;

    // Condition: Outside 08:30 AM - 11:00 PM, return blank
    if (!isOpen) {
      return sendJson(res, 200, {
        success: true,
        isOpen: false,
        message: 'Operating hours are 08:30 AM to 11:00 PM. Results are currently unavailable.',
        date: dateInfo.display,
        slot: null,
        cards: null
      });
    }

    const activeSlot = timeSlots.getCurrentSlot(now);
    let result = null;

    if (activeSlot) {
      result = await db.getResultBySlot(dateInfo.iso, activeSlot);
    }

    if (!result) {
      result = await db.getLatestResult(dateInfo.iso);
    }

    const prefixes = [
      settings.prefix_1 || 'R$R',
      settings.prefix_2 || 'C$H',
      settings.prefix_3 || 'N$V',
      settings.prefix_4 || 'R$Y'
    ];

    if (!result) {
      return sendJson(res, 200, {
        success: true,
        isOpen: true,
        date: dateInfo.display,
        slot: activeSlot || '08:30',
        cards: [
          { prefix: prefixes[0], num: '--', code: `${prefixes[0]}--` },
          { prefix: prefixes[1], num: '--', code: `${prefixes[1]}--` },
          { prefix: prefixes[2], num: '--', code: `${prefixes[2]}--` },
          { prefix: prefixes[3], num: '--', code: `${prefixes[3]}--` }
        ],
        isDeclared: false
      });
    }

    return sendJson(res, 200, {
      success: true,
      isOpen: true,
      date: dateInfo.display,
      slot: result.slot_time,
      cards: [
        { prefix: prefixes[0], num: result.r1, code: `${prefixes[0]}${result.r1}` },
        { prefix: prefixes[1], num: result.r2, code: `${prefixes[1]}${result.r2}` },
        { prefix: prefixes[2], num: result.r3, code: `${prefixes[2]}${result.r3}` },
        { prefix: prefixes[3], num: result.r4, code: `${prefixes[3]}${result.r4}` }
      ],
      isDeclared: true,
      updatedAt: result.updated_at
    });
  }

  // Get All Results (All 59 slots in reverse chronological order)
  if (pathname === '/api/public/results' && method === 'GET') {
    const requestedDateIso = parsedUrl.query.date || timeSlots.getDateStrings(new Date()).iso;
    const settings = await db.getAllSettings();
    const prefixes = [
      settings.prefix_1 || 'R$R',
      settings.prefix_2 || 'C$H',
      settings.prefix_3 || 'N$V',
      settings.prefix_4 || 'R$Y'
    ];

    const storedList = await db.getResultsByDate(requestedDateIso);
    const storedMap = new Map();
    for (const r of storedList) {
      storedMap.set(r.slot_time, r);
    }

    const allSlots = timeSlots.getAllSlots().reverse();
    const rows = allSlots.map(slotTime => {
      const item = storedMap.get(slotTime);
      if (item) {
        return {
          slotTime,
          isPublished: true,
          c1: `${prefixes[0]}${item.r1}`,
          c2: `${prefixes[1]}${item.r2}`,
          c3: `${prefixes[2]}${item.r3}`,
          c4: `${prefixes[3]}${item.r4}`,
          r1: item.r1,
          r2: item.r2,
          r3: item.r3,
          r4: item.r4,
          updatedAt: item.updated_at
        };
      }
      return {
        slotTime,
        isPublished: false,
        c1: '--',
        c2: '--',
        c3: '--',
        c4: '--',
        r1: '',
        r2: '',
        r3: '',
        r4: '',
        updatedAt: null
      };
    });

    const [y, m, d] = requestedDateIso.split('-');
    const displayDate = `${d}-${m}-${y}`;

    return sendJson(res, 200, {
      success: true,
      date: displayDate,
      dateIso: requestedDateIso,
      prefixes,
      groupTitle: settings.yantra_group_title || 'YANTRA GROUP',
      eventTitle: settings.event_code_title || 'Gift Event Code',
      slots: rows
    });
  }

  // -------------------------------------------------------------
  // ADMIN API ROUTES
  // -------------------------------------------------------------

  // Admin Login
  if (pathname === '/api/admin/login' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { username, password } = body;

      if (!username || !password) {
        return sendJson(res, 400, { success: false, message: 'Username and password are required' });
      }

      const adminUser = await db.getAdminByUsername(username);
      if (!adminUser) {
        return sendJson(res, 401, { success: false, message: 'Invalid username or password' });
      }

      const isValid = auth.verifyPassword(password, adminUser.password_hash, adminUser.salt);
      if (!isValid) {
        return sendJson(res, 401, { success: false, message: 'Invalid username or password' });
      }

      const token = auth.generateToken({ id: adminUser.id, username: adminUser.username });
      return sendJson(res, 200, {
        success: true,
        message: 'Login successful',
        token,
        username: adminUser.username
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, message: e.message });
    }
  }

  // Admin Check Session
  if (pathname === '/api/admin/me' && method === 'GET') {
    const adminUser = requireAdmin(req);
    if (!adminUser) {
      return sendJson(res, 401, { success: false, message: 'Unauthorized' });
    }
    return sendJson(res, 200, { success: true, user: adminUser });
  }

  // Admin: Get Slots with Data for a Date
  if (pathname === '/api/admin/slots' && method === 'GET') {
    const adminUser = requireAdmin(req);
    if (!adminUser) return sendJson(res, 401, { success: false, message: 'Unauthorized' });

    const requestedDateIso = parsedUrl.query.date || timeSlots.getDateStrings(new Date()).iso;
    const settings = await db.getAllSettings();
    const prefixes = [
      settings.prefix_1 || 'R$R',
      settings.prefix_2 || 'C$H',
      settings.prefix_3 || 'N$V',
      settings.prefix_4 || 'R$Y'
    ];

    const storedList = await db.getResultsByDate(requestedDateIso);
    const storedMap = new Map();
    for (const r of storedList) {
      storedMap.set(r.slot_time, r);
    }

    const allSlots = timeSlots.getAllSlots();
    const slots = allSlots.map(slotTime => {
      const item = storedMap.get(slotTime);
      return {
        slotTime,
        isPublished: !!item,
        r1: item ? item.r1 : '',
        r2: item ? item.r2 : '',
        r3: item ? item.r3 : '',
        r4: item ? item.r4 : '',
        updatedAt: item ? item.updated_at : null
      };
    });

    return sendJson(res, 200, {
      success: true,
      dateIso: requestedDateIso,
      prefixes,
      slots
    });
  }

  // Admin: Publish / Update Result
  if (pathname === '/api/admin/publish' && method === 'POST') {
    const adminUser = requireAdmin(req);
    if (!adminUser) return sendJson(res, 401, { success: false, message: 'Unauthorized' });

    try {
      const body = await parseJsonBody(req);
      const { date, slotTime, r1, r2, r3, r4 } = body;

      if (!date || !slotTime) {
        return sendJson(res, 400, { success: false, message: 'Date and slotTime are required' });
      }

      const sanitizeNum = (v) => {
        const num = parseInt(v, 10);
        if (isNaN(num) || num < 0 || num > 99) {
          throw new Error('All values must be valid numbers between 00 and 99');
        }
        return String(num).padStart(2, '0');
      };

      const val1 = sanitizeNum(r1);
      const val2 = sanitizeNum(r2);
      const val3 = sanitizeNum(r3);
      const val4 = sanitizeNum(r4);

      await db.saveResult(date, slotTime, val1, val2, val3, val4);

      const settings = await db.getAllSettings();
      broadcastSSE('result_updated', {
        date,
        slotTime,
        r1: val1,
        r2: val2,
        r3: val3,
        r4: val4,
        prefixes: [
          settings.prefix_1 || 'R$R',
          settings.prefix_2 || 'C$H',
          settings.prefix_3 || 'N$V',
          settings.prefix_4 || 'R$Y'
        ]
      });

      return sendJson(res, 200, {
        success: true,
        message: `Result for ${slotTime} published successfully!`
      });
    } catch (e) {
      return sendJson(res, 400, { success: false, message: e.message });
    }
  }

  // Admin: Clear Result
  if (pathname === '/api/admin/clear' && method === 'POST') {
    const adminUser = requireAdmin(req);
    if (!adminUser) return sendJson(res, 401, { success: false, message: 'Unauthorized' });

    try {
      const body = await parseJsonBody(req);
      const { date, slotTime } = body;
      await db.clearResult(date, slotTime);

      broadcastSSE('result_cleared', { date, slotTime });
      return sendJson(res, 200, { success: true, message: `Result for ${slotTime} cleared` });
    } catch (e) {
      return sendJson(res, 400, { success: false, message: e.message });
    }
  }

  // Admin: Get Settings
  if (pathname === '/api/admin/settings' && method === 'GET') {
    const adminUser = requireAdmin(req);
    if (!adminUser) return sendJson(res, 401, { success: false, message: 'Unauthorized' });

    const settings = await db.getAllSettings();
    return sendJson(res, 200, { success: true, settings });
  }

  // Admin: Update Settings
  if (pathname === '/api/admin/settings' && method === 'POST') {
    const adminUser = requireAdmin(req);
    if (!adminUser) return sendJson(res, 401, { success: false, message: 'Unauthorized' });

    try {
      const body = await parseJsonBody(req);
      await db.updateSettings(body);
      const updated = await db.getAllSettings();
      broadcastSSE('settings_updated', updated);
      return sendJson(res, 200, { success: true, message: 'Settings saved successfully' });
    } catch (e) {
      return sendJson(res, 400, { success: false, message: e.message });
    }
  }

  // Admin: Change Password
  if (pathname === '/api/admin/change-password' && method === 'POST') {
    const adminUser = requireAdmin(req);
    if (!adminUser) return sendJson(res, 401, { success: false, message: 'Unauthorized' });

    try {
      const body = await parseJsonBody(req);
      const { currentPassword, newPassword } = body;

      if (!newPassword || newPassword.length < 6) {
        return sendJson(res, 400, { success: false, message: 'New password must be at least 6 characters' });
      }

      const userRecord = await db.getAdminByUsername(adminUser.username);
      const isMatch = auth.verifyPassword(currentPassword, userRecord.password_hash, userRecord.salt);
      if (!isMatch) {
        return sendJson(res, 400, { success: false, message: 'Current password is incorrect' });
      }

      await db.updateAdminPassword(adminUser.username, newPassword);
      return sendJson(res, 200, { success: true, message: 'Password changed successfully' });
    } catch (e) {
      return sendJson(res, 400, { success: false, message: e.message });
    }
  }

  // -------------------------------------------------------------
  // STATIC FILE SERVING
  // -------------------------------------------------------------

  // Download APK Endpoint
  if (pathname === '/app.apk' || pathname === '/download/app.apk' || pathname === '/app-release.apk') {
    const apkPath = path.join(PUBLIC_DIR, 'user', 'app.apk');
    if (fs.existsSync(apkPath) && fs.statSync(apkPath).isFile()) {
      const stats = fs.statSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stats.size,
        'Content-Disposition': 'attachment; filename="ResultApp.apk"',
        'Cache-Control': 'no-cache'
      });
      return fs.createReadStream(apkPath).pipe(res);
    }
  }

  // User App HTML
  if (pathname === '/' || pathname === '/user' || pathname === '/user/') {
    return serveStaticFile(res, path.join(PUBLIC_DIR, 'user', 'index.html'));
  }

  // Admin App HTML
  if (pathname === '/admin' || pathname === '/admin/') {
    return serveStaticFile(res, path.join(PUBLIC_DIR, 'admin', 'index.html'));
  }

  // Serve static assets from public/admin/
  if (pathname.startsWith('/admin/')) {
    const relative = pathname.replace(/^\/admin\//, '');
    const target = path.join(PUBLIC_DIR, 'admin', relative);
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      return serveStaticFile(res, target);
    }
  }

  // Serve static assets from public/user/
  if (pathname.startsWith('/user/')) {
    const relative = pathname.replace(/^\/user\//, '');
    const target = path.join(PUBLIC_DIR, 'user', relative);
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      return serveStaticFile(res, target);
    }
  }

  // Fallback: Check if file exists in public/user/ (e.g. /style.css, /app.js)
  const userAssetPath = path.join(PUBLIC_DIR, 'user', pathname.replace(/^\//, ''));
  if (fs.existsSync(userAssetPath) && fs.statSync(userAssetPath).isFile()) {
    return serveStaticFile(res, userAssetPath);
  }

  // Fallback: Check public root
  const directPath = path.join(PUBLIC_DIR, pathname.replace(/^\//, ''));
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return serveStaticFile(res, directPath);
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

// Boot Database then start server
db.initDb().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`Live Result Publishing System running on port ${PORT}`);
    console.log(`Database Mode:  ${db.isPostgres ? 'PostgreSQL (Production)' : 'SQLite (Local)'}`);
    console.log(`User Frontend:  http://localhost:${PORT}/`);
    console.log(`Admin Panel:    http://localhost:${PORT}/admin/`);
    console.log(`====================================================`);
  });
}).catch(err => {
  console.error('[FATAL] Failed to initialize database:', err);
  process.exit(1);
});
