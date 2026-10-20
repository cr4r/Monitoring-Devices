// ================================================================
// DevWatch — db.js
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
