// server/db.js
// Dual-Mode Database Layer: Supports PostgreSQL (Production/Docker) and SQLite (Local Development)

const path = require('node:path');
const fs = require('node:fs');
const { hashPassword } = require('./auth');

const DATABASE_URL = process.env.DATABASE_URL;
const isPostgres = !!DATABASE_URL;

let pgPool = null;
let sqliteDb = null;

// Default Application Settings with user-specified prefixes
const defaultSettings = {
  prefix_1: 'R$R',
  prefix_2: 'C$H',
  prefix_3: 'N$V',
  prefix_4: 'R$Y',
  yantra_group_title: 'YANTRA GROUP',
  event_code_title: 'Gift Event Code',
  enforce_operating_hours: '1',
  app_version: 'Version-1.0'
};

if (isPostgres) {
  const { Pool } = require('pg');
  console.log('[DB] Connecting to PostgreSQL via DATABASE_URL...');
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
} else {
  console.log('[DB] Running with SQLite local storage (node:sqlite)...');
  const { DatabaseSync } = require('node:sqlite');
  const DB_PATH = path.join(__dirname, 'database.sqlite');
  sqliteDb = new DatabaseSync(DB_PATH);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
}

/**
 * Initialize database schema and seeds
 */
async function initDb() {
  if (isPostgres) {
    // PostgreSQL schema
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        date VARCHAR(20) NOT NULL,
        slot_time VARCHAR(10) NOT NULL,
        r1 VARCHAR(10) NOT NULL,
        r2 VARCHAR(10) NOT NULL,
        r3 VARCHAR(10) NOT NULL,
        r4 VARCHAR(10) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, slot_time)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Seed admin in Postgres
    const adminCheck = await pgPool.query('SELECT COUNT(*) as count FROM admins');
    if (parseInt(adminCheck.rows[0].count, 10) === 0) {
      const { hash, salt } = hashPassword('admin123');
      await pgPool.query(
        'INSERT INTO admins (username, password_hash, salt) VALUES ($1, $2, $3)',
        ['admin', hash, salt]
      );
      console.log('[DB-PostgreSQL] Seeded default admin (username: admin, password: admin123)');
    }

    // Seed or update settings in Postgres
    for (const [key, value] of Object.entries(defaultSettings)) {
      await pgPool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, value]
      );
    }
    console.log('[DB-PostgreSQL] Initialized and verified schema.');
  } else {
    // SQLite schema
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        slot_time TEXT NOT NULL,
        r1 TEXT NOT NULL,
        r2 TEXT NOT NULL,
        r3 TEXT NOT NULL,
        r4 TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, slot_time)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Seed admin in SQLite
    const countRow = sqliteDb.prepare('SELECT COUNT(*) as count FROM admins').get();
    if (!countRow || countRow.count === 0) {
      const { hash, salt } = hashPassword('admin123');
      sqliteDb.prepare('INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)').run('admin', hash, salt);
      console.log('[DB-SQLite] Seeded default admin user (username: admin, password: admin123)');
    }

    // Update settings in SQLite with R$R, C$H, N$V, R$Y
    const upsertSetting = sqliteDb.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    for (const [key, value] of Object.entries(defaultSettings)) {
      upsertSetting.run(key, value);
    }
    console.log('[DB-SQLite] Updated default prefixes to R$R, C$H, N$V, R$Y.');
  }
}

// -------------------------------------------------------------
// UNIFIED ASYNC DB METHODS
// -------------------------------------------------------------

async function getAdminByUsername(username) {
  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM admins WHERE username = $1', [username]);
    return res.rows[0] || null;
  } else {
    return sqliteDb.prepare('SELECT * FROM admins WHERE username = ?').get(username) || null;
  }
}

async function updateAdminPassword(username, newPassword) {
  const { hash, salt } = hashPassword(newPassword);
  if (isPostgres) {
    return await pgPool.query(
      'UPDATE admins SET password_hash = $1, salt = $2 WHERE username = $3',
      [hash, salt, username]
    );
  } else {
    return sqliteDb.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE username = ?').run(hash, salt, username);
  }
}

async function getAllSettings() {
  if (isPostgres) {
    const res = await pgPool.query('SELECT key, value FROM settings');
    const settings = {};
    for (const row of res.rows) {
      settings[row.key] = row.value;
    }
    return { ...defaultSettings, ...settings };
  } else {
    const rows = sqliteDb.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return { ...defaultSettings, ...settings };
  }
}

async function updateSetting(key, value) {
  if (isPostgres) {
    return await pgPool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, String(value)]
    );
  } else {
    return sqliteDb.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
    ).run(key, String(value), String(value));
  }
}

async function updateSettings(settingsObj) {
  for (const [k, v] of Object.entries(settingsObj)) {
    await updateSetting(k, String(v));
  }
}

async function getResultBySlot(date, slotTime) {
  if (isPostgres) {
    const res = await pgPool.query(
      'SELECT * FROM results WHERE date = $1 AND slot_time = $2',
      [date, slotTime]
    );
    return res.rows[0] || null;
  } else {
    return sqliteDb.prepare('SELECT * FROM results WHERE date = ? AND slot_time = ?').get(date, slotTime) || null;
  }
}

async function getResultsByDate(date) {
  if (isPostgres) {
    const res = await pgPool.query(
      'SELECT * FROM results WHERE date = $1 ORDER BY slot_time DESC',
      [date]
    );
    return res.rows;
  } else {
    return sqliteDb.prepare('SELECT * FROM results WHERE date = ? ORDER BY slot_time DESC').all(date);
  }
}

async function getLatestResult(date, upToSlot = null) {
  if (isPostgres) {
    if (upToSlot) {
      const res = await pgPool.query(
        'SELECT * FROM results WHERE date = $1 AND slot_time <= $2 ORDER BY slot_time DESC LIMIT 1',
        [date, upToSlot]
      );
      return res.rows[0] || null;
    }
    const res = await pgPool.query(
      'SELECT * FROM results WHERE date = $1 ORDER BY slot_time DESC LIMIT 1',
      [date]
    );
    return res.rows[0] || null;
  } else {
    if (upToSlot) {
      return sqliteDb.prepare(
        'SELECT * FROM results WHERE date = ? AND slot_time <= ? ORDER BY slot_time DESC LIMIT 1'
      ).get(date, upToSlot) || null;
    }
    return sqliteDb.prepare('SELECT * FROM results WHERE date = ? ORDER BY slot_time DESC LIMIT 1').get(date) || null;
  }
}

async function saveResult(date, slotTime, r1, r2, r3, r4) {
  const now = new Date().toISOString();
  const v1 = String(r1).padStart(2, '0');
  const v2 = String(r2).padStart(2, '0');
  const v3 = String(r3).padStart(2, '0');
  const v4 = String(r4).padStart(2, '0');

  if (isPostgres) {
    return await pgPool.query(`
      INSERT INTO results (date, slot_time, r1, r2, r3, r4, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (date, slot_time) DO UPDATE SET
        r1 = EXCLUDED.r1,
        r2 = EXCLUDED.r2,
        r3 = EXCLUDED.r3,
        r4 = EXCLUDED.r4,
        updated_at = EXCLUDED.updated_at
    `, [date, slotTime, v1, v2, v3, v4, now]);
  } else {
    return sqliteDb.prepare(`
      INSERT INTO results (date, slot_time, r1, r2, r3, r4, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, slot_time) DO UPDATE SET
        r1 = excluded.r1,
        r2 = excluded.r2,
        r3 = excluded.r3,
        r4 = excluded.r4,
        updated_at = excluded.updated_at
    `).run(date, slotTime, v1, v2, v3, v4, now);
  }
}

async function clearResult(date, slotTime) {
  if (isPostgres) {
    return await pgPool.query(
      'DELETE FROM results WHERE date = $1 AND slot_time = $2',
      [date, slotTime]
    );
  } else {
    return sqliteDb.prepare('DELETE FROM results WHERE date = ? AND slot_time = ?').run(date, slotTime);
  }
}

module.exports = {
  isPostgres,
  initDb,
  getAdminByUsername,
  updateAdminPassword,
  getAllSettings,
  updateSetting,
  updateSettings,
  getResultBySlot,
  getResultsByDate,
  getLatestResult,
  saveResult,
  clearResult
};
