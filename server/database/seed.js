// ================================================================
// DevWatch — seed.js
// Mengisi data awal database (Akun demo, perangkat, pengaturan, log)
// ================================================================

import bcrypt from 'bcryptjs';
import { db, queryOne, run } from './db.js';

export async function seedDatabase() {
  console.log('Memeriksa kelengkapan data database DevWatch...');

  // 1. Seed Pengguna (Admin, Teknisi, Viewer)
  const existingUser = queryOne('SELECT id FROM users LIMIT 1');
  if (!existingUser) {
    console.log('Menyemai data pengguna bawaan...');
    const salt = bcrypt.genSaltSync(10);

    const users = [
      {
        nama: 'Ahmad Rizky',
        email: 'admin@kantor.com',
        password: 'admin123',
        role: 'admin',
        avatar: 'AR',
        status: 'aktif',
      },
      {
        nama: 'Budi Santoso',
        email: 'teknisi@kantor.com',
        password: 'teknisi123',
        role: 'teknisi',
        avatar: 'BS',
        status: 'aktif',
      },
      {
        nama: 'Citra Dewi',
        email: 'viewer@kantor.com',
        password: 'viewer123',
        role: 'viewer',
        avatar: 'CD',
        status: 'aktif',
      },
    ];

    for (const u of users) {
      const hash = bcrypt.hashSync(u.password, salt);
      run(
        `INSERT INTO users (nama, email, password_hash, role, avatar, status, notif_settings)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [u.nama, u.email, hash, u.role, u.avatar, u.status, JSON.stringify({ enabled: true })]
      );
    }
  }

  // 2. Seed Perangkat Jaringan (20 Unit sesuai PRD)
  const existingDevice = queryOne('SELECT id FROM devices LIMIT 1');
  if (!existingDevice) {
    console.log('Menyemai 20 perangkat jaringan awal...');

    const sampleDevices = [
      // PC Kantor
      { nama: 'PC Akuntansi 01', ip: '192.168.1.20', hostname: 'PC-AKUNTING-01', jenis: 'Komputer', metode: 'PING', interval: 60, grup: 'Lantai 1', lokasi: 'Ruang Akuntansi', status: 'online', lat: 4, sla: 99.5 },
      { nama: 'PC HRD Manager', ip: '192.168.1.21', hostname: 'PC-HRD-MGR', jenis: 'Komputer', metode: 'PING', interval: 60, grup: 'Lantai 1', lokasi: 'Ruang HRD', status: 'online', lat: 7, sla: 99.0 },
      { nama: 'PC Server File', ip: '192.168.1.10', hostname: 'SERVER-FILE-01', jenis: 'Komputer', metode: 'PING', interval: 30, grup: 'Server Room', lokasi: 'Server Room Lantai 2', status: 'online', lat: 1, sla: 99.9 },
      { nama: 'PC Marketing 01', ip: '192.168.1.30', hostname: 'PC-MKTG-01', jenis: 'Komputer', metode: 'PING', interval: 60, grup: 'Lantai 2', lokasi: 'Ruang Marketing', status: 'offline', lat: 0, sla: 95.0 },
      { nama: 'PC Gudang', ip: '192.168.2.50', hostname: 'PC-GUDANG-01', jenis: 'Komputer', metode: 'PING', interval: 120, grup: 'Gudang', lokasi: 'Gudang Lantai G', status: 'maintenance', lat: 0, sla: 98.0, reason: 'Penggantian RAM dan SSD' },
      { nama: 'PC Direktur', ip: '192.168.1.2', hostname: 'PC-DIREKTUR', jenis: 'Komputer', metode: 'PING', interval: 60, grup: 'Lantai 3', lokasi: 'Ruang Direktur', status: 'online', lat: 5, sla: 99.8 },
      { nama: 'PC Resepsionis', ip: '192.168.1.50', hostname: 'PC-RECEPTION', jenis: 'Komputer', metode: 'PING', interval: 60, grup: 'Lantai 1', lokasi: 'Lobi Depan', status: 'online', lat: 6, sla: 99.0 },
      { nama: 'PC IT Support', ip: '192.168.1.9', hostname: 'PC-IT-SUPPORT', jenis: 'Komputer', metode: 'PING', interval: 30, grup: 'IT Room', lokasi: 'Ruang IT Lantai 2', status: 'online', lat: 2, sla: 99.9 },
      { nama: 'PC Legal', ip: '192.168.1.25', hostname: 'PC-LEGAL-01', jenis: 'Komputer', metode: 'PING', interval: 60, grup: 'Lantai 2', lokasi: 'Ruang Legal', status: 'online', lat: 5, sla: 98.5 },
      { nama: 'PC Kasir Kantin', ip: '192.168.1.80', hostname: 'PC-KASIR-01', jenis: 'Komputer', metode: 'PING', interval: 120, grup: 'Kantin', lokasi: 'Area Kantin Basemen', status: 'offline', lat: 0, sla: 94.0 },

      // CCTV Hikvision
      { nama: 'CCTV Lobi Utama', ip: '192.168.1.101', hostname: 'HIK-CAM-LOBBY', jenis: 'CCTV Hikvision', metode: 'ISAPI', port: 80, interval: 30, grup: 'Lantai 1', lokasi: 'Pintu Masuk Utama', status: 'online', lat: 12, sla: 99.9 },
      { nama: 'CCTV Koridor Lt 1', ip: '192.168.1.102', hostname: 'HIK-CAM-KORIDOR-1', jenis: 'CCTV Hikvision', metode: 'PING', interval: 60, grup: 'Lantai 1', lokasi: 'Koridor Sayap Barat', status: 'online', lat: 14, sla: 99.5 },
      { nama: 'CCTV Gudang Barang', ip: '192.168.2.103', hostname: 'HIK-CAM-GUDANG', jenis: 'CCTV Hikvision', metode: 'ISAPI', port: 80, interval: 30, grup: 'Gudang', lokasi: 'Pintu Gerbang Gudang', status: 'offline', lat: 0, sla: 92.0 },
      { nama: 'CCTV Ruang Server', ip: '192.168.1.104', hostname: 'HIK-CAM-SERVER', jenis: 'CCTV Hikvision', metode: 'ISAPI', port: 80, interval: 30, grup: 'Server Room', lokasi: 'Rak Server Utama', status: 'online', lat: 9, sla: 99.99 },
      { nama: 'CCTV Parkiran Depan', ip: '192.168.1.105', hostname: 'HIK-CAM-PARKIR-DPN', jenis: 'CCTV Hikvision', metode: 'PING', interval: 60, grup: 'Parkir', lokasi: 'Pos Satpam Depan', status: 'online', lat: 18, sla: 99.0 },
      { nama: 'CCTV Parkiran Belakang', ip: '192.168.1.106', hostname: 'HIK-CAM-PARKIR-BLK', jenis: 'CCTV Hikvision', metode: 'PING', interval: 60, grup: 'Parkir', lokasi: 'Area Bongkar Muat', status: 'maintenance', lat: 0, sla: 97.0, reason: 'Pembersihan lensa dan kalibrasi sudut kamera' },
      { nama: 'CCTV Tangga Darurat Lt 2', ip: '192.168.1.107', hostname: 'HIK-CAM-TANGGA-2', jenis: 'CCTV Hikvision', metode: 'PING', interval: 60, grup: 'Lantai 2', lokasi: 'Pintu Evakuasi', status: 'online', lat: 15, sla: 99.2 },
      { nama: 'CCTV Ruang Rapat Lt 3', ip: '192.168.1.108', hostname: 'HIK-CAM-RAPAT', jenis: 'CCTV Hikvision', metode: 'ISAPI', port: 80, interval: 60, grup: 'Lantai 3', lokasi: 'Boardroom VIP', status: 'online', lat: 11, sla: 99.7 },
      { nama: 'CCTV Gerbang Masuk', ip: '192.168.1.109', hostname: 'HIK-CAM-GATE-IN', jenis: 'CCTV Hikvision', metode: 'RTSP', port: 554, interval: 30, grup: 'Parkir', lokasi: 'Barrier Gate Masuk', status: 'online', lat: 16, sla: 99.5 },
      { nama: 'CCTV Gerbang Keluar', ip: '192.168.1.110', hostname: 'HIK-CAM-GATE-OUT', jenis: 'CCTV Hikvision', metode: 'RTSP', port: 554, interval: 30, grup: 'Parkir', lokasi: 'Barrier Gate Keluar', status: 'online', lat: 17, sla: 99.5 },
    ];

    for (const d of sampleDevices) {
      run(
        `INSERT INTO devices (nama, ip, hostname, jenis, metode, port, interval_detik, grup, lokasi, status, response_time_ms, target_sla, maintenance_reason, last_check, last_seen_online)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          d.nama,
          d.ip,
          d.hostname,
          d.jenis,
          d.metode,
          d.port || null,
          d.interval,
          d.grup,
          d.lokasi,
          d.status,
          d.lat,
          d.sla,
          d.reason || null,
        ]
      );
    }
  }

  // 3. Seed Pengaturan Sistem Default (6 Kategori)
  const existingSettings = queryOne('SELECT kunci FROM system_settings LIMIT 1');
  if (!existingSettings) {
    console.log('Menyemai pengaturan sistem bawaan...');
    const defaultSettings = [
      // Umum
      ['umum', 'app_name', 'DevWatch'],
      ['umum', 'timezone', 'Asia/Jakarta'],
      ['umum', 'language', 'id'],
      ['umum', 'dashboard_refresh_seconds', '30'],
      // Monitoring
      ['monitoring', 'global_ping_timeout_ms', '2000'],
      ['monitoring', 'global_retry_count', '3'],
      ['monitoring', 'packet_size_bytes', '32'],
      ['monitoring', 'default_rtsp_port', '554'],
      // Notifikasi
      ['notifikasi', 'browser_push_enabled', 'true'],
      ['notifikasi', 'telegram_bot_token', ''],
      ['notifikasi', 'telegram_chat_id', ''],
      ['notifikasi', 'work_hours_start', '08:00'],
      ['notifikasi', 'work_hours_end', '17:00'],
      // Keamanan
      ['keamanan', 'session_timeout_minutes', '120'],
      ['keamanan', 'max_login_attempts', '5'],
      ['keamanan', 'lockout_duration_minutes', '15'],
      ['keamanan', 'ip_whitelist', ''],
      // Log & Backup
      ['log_backup', 'retention_days', '90'],
      ['log_backup', 'auto_backup_enabled', 'true'],
      ['log_backup', 'backup_schedule', 'daily_midnight'],
      // Laporan Terjadwal
      ['laporan', 'auto_weekly_report', 'true'],
      ['laporan', 'report_recipients', 'it-reports@kantor.com'],
    ];

    for (const [kategori, kunci, nilai] of defaultSettings) {
      run(
        `INSERT INTO system_settings (kategori, kunci, nilai) VALUES (?, ?, ?)`,
        [kategori, kunci, nilai]
      );
    }
  }

  // 4. Seed Contoh Log
  const existingLogs = queryOne('SELECT id FROM device_status_logs LIMIT 1');
  if (!existingLogs) {
    console.log('Menyemai data log historis...');
    const sampleLogs = [
      [4, 'PC Marketing 01', '192.168.1.30', 'Online', 'Offline', 'PING', 'Timeout', 'PC Marketing 01 (192.168.1.30) tidak merespons ping. Status berubah menjadi Offline.'],
      [13, 'CCTV Gudang Barang', '192.168.2.103', 'Online', 'Offline', 'ISAPI', 'Connection Refused', 'CCTV Gudang Barang (192.168.2.103) tidak dapat dihubungi via ISAPI. Status berubah menjadi Offline.'],
      [5, 'PC Gudang', '192.168.2.50', 'Online', 'Maintenance', 'Manual', '-', 'PC Gudang (192.168.2.50) masuk mode Maintenance oleh Budi Santoso. Alasan: Penggantian RAM dan SSD.'],
      [16, 'CCTV Parkiran Belakang', '192.168.1.106', 'Online', 'Maintenance', 'Manual', '-', 'CCTV Parkiran Belakang (192.168.1.106) masuk mode Maintenance. Alasan: Pembersihan lensa dan kalibrasi sudut kamera.'],
      [1, 'PC Akuntansi 01', '192.168.1.20', 'Offline', 'Online', 'PING', '4 ms', 'PC Akuntansi 01 (192.168.1.20) kembali merespons ping. Status berubah menjadi Online.'],
    ];

    for (const [did, dname, dip, prev, curr, met, resp, msg] of sampleLogs) {
      run(
        `INSERT INTO device_status_logs (device_id, device_name, device_ip, status_sebelumnya, status_baru, metode, response_time, pesan_log)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [did, dname, dip, prev, curr, met, resp, msg]
      );
    }

    run(
      `INSERT INTO user_activity_logs (user_id, user_email, user_nama, aksi, ip_akses, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [1, 'admin@kantor.com', 'Ahmad Rizky', 'Login Berhasil', '127.0.0.1', 'Masuk ke dashboard DevWatch']
    );

    run(
      `INSERT INTO config_logs (user_id, user_nama, aksi, device_id, device_nama, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [1, 'Ahmad Rizky', 'Inisialisasi Sistem', null, null, 'Sistem DevWatch diinisialisasi pertama kali']
    );
  }

  console.log('Database DevWatch siap digunakan.');
}

// Jalankan jika dipanggil langsung via CLI
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase();
}
