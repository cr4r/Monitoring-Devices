// ================================================================
// DevWatch - db.js
// Koneksi basis data SQLite bawaan Node (node:sqlite)
// ================================================================

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan folder data ada
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(config.dbPath);

// Aktifkan foreign keys & WAL mode
db.exec('PRAGMA foreign_keys = ON;');

// Inisialisasi skema tabel jika belum ada
const schemaPath = path.resolve(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

// Migrasi skema: Pastikan device_status_logs memiliki device_created_at dan bebas dari ON DELETE CASCADE
try {
  const logCols = query('PRAGMA table_info(device_status_logs)');
  const hasCreatedAt = logCols.some((c) => c.name === 'device_created_at');
  if (!hasCreatedAt) {
    db.exec('ALTER TABLE device_status_logs ADD COLUMN device_created_at DATETIME;');
  }

  // Isi device_created_at yang masih kosong dari data devices
  db.exec(`
    UPDATE device_status_logs
    SET device_created_at = (SELECT created_at FROM devices WHERE devices.id = device_status_logs.device_id)
    WHERE device_created_at IS NULL AND device_id IS NOT NULL;
  `);

  // Cek apakah ada foreign key cascade di device_status_logs
  const fks = query('PRAGMA foreign_key_list(device_status_logs)');
  const hasCascade = fks.some((f) => f.table === 'devices' && f.on_delete === 'CASCADE');
  if (hasCascade) {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec(`
      CREATE TABLE IF NOT EXISTS device_status_logs_migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER,
        device_name TEXT NOT NULL,
        device_ip TEXT NOT NULL,
        device_created_at DATETIME,
        waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
        status_sebelumnya TEXT,
        status_baru TEXT NOT NULL,
        metode TEXT,
        response_time TEXT,
        pesan_log TEXT NOT NULL
      );
      INSERT INTO device_status_logs_migrated (
        id, device_id, device_name, device_ip, device_created_at, waktu, status_sebelumnya, status_baru, metode, response_time, pesan_log
      )
      SELECT id, device_id, device_name, device_ip, device_created_at, waktu, status_sebelumnya, status_baru, metode, response_time, pesan_log
      FROM device_status_logs;
      DROP TABLE device_status_logs;
      ALTER TABLE device_status_logs_migrated RENAME TO device_status_logs;
    `);
    db.exec('PRAGMA foreign_keys = ON;');
  }

  // Pastikan kunci konfigurasi monitoring & log penting selalu ada di sistem
  const missingDefaults = [
    ['monitoring', 'ping_timeout_ms', '2000'],
    ['monitoring', 'ping_retry_count', '3'],
    ['monitoring', 'engine_active', 'true'],
    ['log_backup', 'auto_delete_logs_enabled', 'true'],
    ['log_backup', 'backup_schedule', 'daily'],
  ];
  for (const [kat, key, val] of missingDefaults) {
    db.prepare('INSERT OR IGNORE INTO system_settings (kategori, kunci, nilai) VALUES (?, ?, ?)').run(kat, key, val);
  }

  // Migrasi skema: Pastikan tabel users memiliki username unik
  const userCols = query('PRAGMA table_info(users)');
  const hasUsername = userCols.some((c) => c.name === 'username');
  if (!hasUsername) {
    db.exec('ALTER TABLE users ADD COLUMN username TEXT;');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);');
  }

  // Isi username yang masih kosong dari email atau nama
  db.exec(`
    UPDATE users
    SET username = CASE 
      WHEN email LIKE '%@%' THEN LOWER(SUBSTR(email, 1, INSTR(email, '@') - 1))
      ELSE LOWER(REPLACE(nama, ' ', ''))
    END
    WHERE username IS NULL OR username = '';
  `);

  // Auto-backfill log inisial untuk seluruh perangkat aktif yang belum memiliki riwayat status
  db.exec(`
    INSERT INTO device_status_logs (device_id, device_name, device_ip, device_created_at, waktu, status_sebelumnya, status_baru, metode, response_time, pesan_log)
    SELECT 
      d.id, 
      d.nama, 
      d.ip, 
      d.created_at, 
      COALESCE(d.created_at, datetime('now')), 
      'Inisialisasi', 
      CASE 
        WHEN d.status = 'online' THEN 'Online' 
        WHEN d.status = 'maintenance' THEN 'Maintenance' 
        ELSE 'Offline' 
      END,
      COALESCE(d.metode, 'PING'), 
      COALESCE(d.response_time_ms || ' ms', '-'),
      'Perangkat ' || d.nama || ' (' || d.ip || ') terdaftar dalam sistem pemantauan (' || d.jenis || ').'
    FROM devices d
    WHERE d.is_active = 1
      AND d.id NOT IN (
        SELECT DISTINCT device_id 
        FROM device_status_logs 
        WHERE device_id IS NOT NULL
      );
  `);
} catch (migErr) {
  console.warn('[DB Migration Warning]:', migErr.message);
}

function sanitizeParams(params = []) {
  return Array.isArray(params) ? params.map((p) => (p === undefined ? null : p)) : params;
}

/**
 * Eksekusi query SELECT dengan hasil array object
 */
export function query(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...sanitizeParams(params));
}

/**
 * Eksekusi query SELECT dengan hasil 1 baris
 */
export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...sanitizeParams(params)) || null;
}

/**
 * Eksekusi INSERT / UPDATE / DELETE
 */
export function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...sanitizeParams(params));
}

/**
 * Eksekusi raw SQL multi-line
 */
export function exec(sql) {
  return db.exec(sql);
}

/**
 * Ambil nilai pengaturan sistem spesifik dari tabel system_settings
 */
export function getSystemSetting(kunci, fallback = '') {
  try {
    const row = queryOne('SELECT nilai FROM system_settings WHERE kunci = ?', [kunci]);
    return row && row.nilai !== undefined && row.nilai !== null ? row.nilai : fallback;
  } catch {
    return fallback;
  }
}
