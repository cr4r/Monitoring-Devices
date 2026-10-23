// ================================================================
// DevWatch — routes/auth.js
// Autentikasi pengguna, pembuatan token JWT, dan penanganan sesi
// ================================================================

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, run, getSystemSetting } from '../database/db.js';
import { config } from '../config.js';
import { loginRateLimiter, recordFailedLogin, resetFailedLogin, getSecuritySettings } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', loginRateLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  const identifier = (username || email || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username dan kata sandi wajib diisi.',
    });
  }

  // 1. Verifikasi IP Whitelist jika diaktifkan di pengaturan sistem
  const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').trim();
  const rawWhitelist = getSystemSetting('ip_whitelist', '').trim();
  if (rawWhitelist) {
    const allowedIps = rawWhitelist.split(',').map((s) => s.trim()).filter(Boolean);
    const isAllowed = allowedIps.some((allowed) => {
      if (allowed === '127.0.0.1' && (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.endsWith('127.0.0.1'))) return true;
      return clientIp === allowed || clientIp.includes(allowed);
    });
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Alamat IP Anda (${clientIp}) tidak terdaftar dalam whitelist keamanan sistem. Hubungi Administrator.`,
      });
    }
  }

  const cleanIdentifier = identifier.toLowerCase();

  const userCountRow = queryOne('SELECT COUNT(*) as count FROM users');
  if (!userCountRow || userCountRow.count === 0) {
    return res.status(400).json({
      success: false,
      needsSetup: true,
      message: 'Sistem belum dikonfigurasi. Silakan lakukan setup awal untuk membuat akun Administrator.',
    });
  }

  const user = queryOne('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', [cleanIdentifier, cleanIdentifier]);

  if (!user) {
    recordFailedLogin(cleanIdentifier);
    return res.status(401).json({
      success: false,
      message: 'Username atau kata sandi tidak sesuai.',
    });
  }

  if (user.status !== 'aktif') {
    return res.status(403).json({
      success: false,
      message: 'Akun Anda dinonaktifkan oleh Administrator. Hubungi IT Support.',
    });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    const { maxAttempts, lockoutMins } = getSecuritySettings();
    const entry = recordFailedLogin(cleanIdentifier);
    const attemptsLeft = maxAttempts - entry.count;
    return res.status(401).json({
      success: false,
      message: attemptsLeft > 0
        ? `Kata sandi salah. Sisa percobaan: ${attemptsLeft} kali.`
        : `Akun dikunci selama ${lockoutMins} menit karena ${maxAttempts}x gagal login.`,
    });
  }

  // Berhasil login: reset failure counter
  resetFailedLogin(cleanIdentifier);

  // Perbarui last_login dan ip_akses
  const ip = clientIp;
  run(
    `UPDATE users SET last_login = datetime('now'), ip_akses = ? WHERE id = ?`,
    [ip, user.id]
  );

  // Catat audit activity log
  run(
    `INSERT INTO user_activity_logs (user_id, user_email, user_nama, aksi, ip_akses, detail)
     VALUES (?, ?, ?, 'Login Berhasil', ?, 'Masuk ke dashboard DevWatch')`,
    [user.id, user.email, user.nama, ip]
  );

  // Buat Token JWT dengan durasi dari pengaturan sistem
  const sessionMinutes = parseInt(getSystemSetting('session_timeout_minutes', '60'), 10) || 60;
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      nama: user.nama,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: `${sessionMinutes}m` }
  );

  res.json({
    success: true,
    message: 'Login berhasil.',
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      nama: user.nama,
      role: user.role,
      avatar: user.avatar,
    },
  });
});

router.get('/me', authenticateToken, (req, res) => {
  const user = queryOne(
    `SELECT id, nama, username, email, role, avatar, status, last_login, created_at FROM users WHERE id = ?`,
    [req.user.id]
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  }

  res.json({ success: true, user });
});

router.post('/logout', authenticateToken, (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  run(
    `INSERT INTO user_activity_logs (user_id, user_email, user_nama, aksi, ip_akses, detail)
     VALUES (?, ?, ?, 'Logout', ?, 'Keluar dari aplikasi')`,
    [req.user.id, req.user.email, req.user.nama, ip]
  );

  res.json({ success: true, message: 'Logout berhasil dicatat.' });
});

export default router;
