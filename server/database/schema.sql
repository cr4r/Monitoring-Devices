-- ================================================================
-- DevWatch — schema.sql
-- Definisi skema tabel basis data SQLite
-- ================================================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'teknisi', 'viewer')) NOT NULL DEFAULT 'viewer',
  avatar TEXT,
  status TEXT CHECK(status IN ('aktif', 'nonaktif')) NOT NULL DEFAULT 'aktif',
  last_login DATETIME,
  ip_akses TEXT,
  notif_settings TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
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

CREATE TABLE IF NOT EXISTS device_status_logs (
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

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_email TEXT NOT NULL,
  user_nama TEXT NOT NULL,
  waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
  aksi TEXT NOT NULL,
  ip_akses TEXT,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS config_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_nama TEXT NOT NULL,
  waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
  aksi TEXT NOT NULL,
  device_id INTEGER,
  device_nama TEXT,
  detail TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  waktu_mulai DATETIME NOT NULL,
  waktu_selesai DATETIME,
  durasi_menit INTEGER DEFAULT 0,
  penyebab TEXT,
  status TEXT CHECK(status IN ('terbuka', 'selesai')) DEFAULT 'terbuka',
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_settings (
  kategori TEXT NOT NULL,
  kunci TEXT NOT NULL PRIMARY KEY,
  nilai TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  minggu_ke TEXT NOT NULL,
  tahun INTEGER NOT NULL,
  periode_label TEXT NOT NULL,
  periode_mulai DATETIME NOT NULL,
  periode_selesai DATETIME NOT NULL,
  total_devices INTEGER NOT NULL DEFAULT 0,
  online_devices INTEGER NOT NULL DEFAULT 0,
  average_uptime REAL NOT NULL DEFAULT 100.0,
  target_sla REAL NOT NULL DEFAULT 99.0,
  total_incidents INTEGER NOT NULL DEFAULT 0,
  total_downtime_hours REAL NOT NULL DEFAULT 0.0,
  summary_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_ip ON devices(ip);
CREATE INDEX IF NOT EXISTS idx_device_status_logs_waktu ON device_status_logs(waktu);
CREATE INDEX IF NOT EXISTS idx_user_activity_waktu ON user_activity_logs(waktu);
CREATE INDEX IF NOT EXISTS idx_config_logs_waktu ON config_logs(waktu);
CREATE INDEX IF NOT EXISTS idx_incidents_device ON incidents(device_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_minggu ON weekly_reports(minggu_ke, tahun);

