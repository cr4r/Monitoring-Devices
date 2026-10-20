// ================================================================
// MonDev — routes/setup.js
// Setup awal pertama kali (First-Run Setup Wizard) & Anti-Bypass
// ================================================================

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, query, run } from '../database/db.js';
import { config } from '../config.js';

const router = express.Router();

/**
 * GET /api/setup/status
 * Memeriksa apakah sistem membutuhkan inisialisasi awal (0 pengguna di database)
 */
router.get('/status', (req, res) => {
  try {
    const row = queryOne('SELECT COUNT(*) as count FROM users');
    const userCount = row ? row.count : 0;
    const needsSetup = userCount === 0;

    const appSetting = queryOne("SELECT nilai FROM system_settings WHERE kunci = 'app_name'");
    const appName = appSetting ? appSetting.nilai : 'MonDev';

    res.json({
      success: true,
      needsSetup,
      userCount,
      appName,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal memeriksa status setup: ' + err.message,
    });
  }
});

/**
 * POST /api/setup
 * Menjalankan setup awal Superadmin jika dan hanya jika belum ada pengguna sama sekali
 * Proteksi Keamanan: Replay/Bypass dilarang keras (403 Forbidden jika count > 0)
 */
router.post('/', (req, res) => {
  try {
    // 1. Verifikasi Keamanan: Database harus memiliki 0 pengguna
    const row = queryOne('SELECT COUNT(*) as count FROM users');
    const userCount = row ? row.count : 0;

    if (userCount > 0) {
      // Catat potensi pelanggaran keamanan
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      console.warn(`[SECURITY ALERT]: Percobaan bypass setup kedua kali dicegah dari IP ${ip}!`);
      try {
        run(
          `INSERT INTO user_activity_logs (user_id, user_email, user_nama, aksi, ip_akses, detail)
           VALUES (NULL, 'security-alert', 'SYSTEM', 'Akses Ditolak', ?, 'Percobaan eksekusi ulang setup awal dicegah')`,
          [ip]
        );
      } catch {}

      return res.status(403).json({
        success: false,
        message: 'Setup awal sudah pernah dilakukan. Penyiapan ulang dilarang demi keamanan sistem!',
      });
    }

    const {
      nama,
      email,
      password,
      confirmPassword,
      appName = 'MonDev',
      timezone = 'Asia/Jakarta',
    } = req.body;

    // 2. Validasi Input
    if (!nama || !nama.trim()) {
      return res.status(400).json({ success: false, message: 'Nama lengkap Administrator wajib diisi.' });
    }

    if (!email || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Format alamat email tidak valid.' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Kata sandi minimal 8 karakter demi keamanan sistem.',
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Konfirmasi kata sandi tidak cocok dengan kata sandi utama.',
      });
    }

    // 3. Simpan Superadmin
    const cleanEmail = email.trim().toLowerCase();
    const cleanNama = nama.trim();
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Ambil inisial nama untuk avatar
    const initials = cleanNama
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');

    const userResult = run(
      `INSERT INTO users (nama, email, password_hash, role, avatar, status, notif_settings, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', ?, 'aktif', ?, datetime('now'), datetime('now'))`,
      [
        cleanNama,
        cleanEmail,
        passwordHash,
        initials || 'AD',
        JSON.stringify({ enabled: true, push: true, sound: true }),
      ]
    );

    const newUserId = userResult.lastInsertRowid;

    // 4. Inisialisasi Pengaturan Sistem
    const cleanAppName = appName.trim() || 'MonDev';
    const cleanTimezone = timezone.trim() || 'Asia/Jakarta';

    run(
      `INSERT INTO system_settings (kategori, kunci, nilai, updated_at)
       VALUES ('umum', 'app_name', ?, datetime('now'))
       ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, updated_at = datetime('now')`,
      [cleanAppName]
    );

    run(
      `INSERT INTO system_settings (kategori, kunci, nilai, updated_at)
       VALUES ('umum', 'timezone', ?, datetime('now'))
       ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, updated_at = datetime('now')`,
      [cleanTimezone]
    );

    // 5. Catat Log Audit
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    run(
      `INSERT INTO user_activity_logs (user_id, user_email, user_nama, aksi, ip_akses, detail)
       VALUES (?, ?, ?, 'Setup Awal Berhasil', ?, ?)`,
      [
        newUserId,
        cleanEmail,
        cleanNama,
        ip,
        `Setup awal MonDev selesai. Superadmin ${cleanNama} (${cleanEmail}) dibuat.`,
      ]
    );

    // 6. Buat JWT Token agar Superadmin langsung login aman
    const token = jwt.sign(
      {
        id: newUserId,
        email: cleanEmail,
        nama: cleanNama,
        role: 'admin',
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    res.json({
      success: true,
      message: 'Setup awal berhasil! Sistem MonDev telah siap digunakan.',
      token,
      user: {
        id: newUserId,
        email: cleanEmail,
        nama: cleanNama,
        role: 'admin',
        avatar: initials || 'AD',
      },
    });
  } catch (err) {
    console.error('[Setup Error]:', err);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses setup awal: ' + err.message,
    });
  }
});

export default router;
