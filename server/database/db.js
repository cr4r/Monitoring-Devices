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
