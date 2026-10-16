import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../../data/devwatch.db');

console.log(`Connecting to database at: ${dbPath}`);
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = OFF;');

db.exec(`
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS devices_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  ip TEXT NOT NULL,
  hostname TEXT,
  jenis TEXT CHECK(jenis IN ('Komputer', 'CCTV Hikvision', 'Router', 'Switch', 'Server', 'Access Point')) NOT NULL,
  metode TEXT CHECK(metode IN ('PING', 'ISAPI', 'RTSP', 'ONVIF')) NOT NULL DEFAULT 'PING',
  port INTEGER,
  username TEXT,
  password_encrypted TEXT,
  interval_detik INTEGER NOT NULL DEFAULT 60,
  grup TEXT NOT NULL,
  lokasi TEXT NOT NULL,
  deskripsi TEXT,
  status TEXT CHECK(status IN ('online', 'offline', 'maintenance')) NOT NULL DEFAULT 'offline',
  last_check DATETIME,
  last_seen_online DATETIME,
  response_time_ms INTEGER DEFAULT 0,
  target_sla REAL DEFAULT 99.0,
  maintenance_reason TEXT,
  maintenance_until DATETIME,
  is_active INTEGER NOT NULL DEFAULT 1,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  parent_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO devices_new (
  id, nama, ip, hostname, jenis, metode, port, username, password_encrypted,
  interval_detik, grup, lokasi, deskripsi, status, last_check, last_seen_online,
  response_time_ms, target_sla, maintenance_reason, maintenance_until, is_active,
  consecutive_failures, created_at, updated_at
)
SELECT 
  id, nama, ip, hostname, jenis, metode, port, username, password_encrypted,
  interval_detik, grup, lokasi, deskripsi, status, last_check, last_seen_online,
  response_time_ms, target_sla, maintenance_reason, maintenance_until, is_active,
  consecutive_failures, created_at, updated_at
FROM devices;

DROP TABLE devices;

ALTER TABLE devices_new RENAME TO devices;

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_ip ON devices(ip);
CREATE INDEX IF NOT EXISTS idx_devices_parent ON devices(parent_id);

COMMIT;
`);

db.exec('PRAGMA foreign_keys = ON;');

console.log('Migration completed successfully!');
console.log('Columns in devices table:');
console.log(db.prepare('PRAGMA table_info(devices)').all().map(c => c.name));
