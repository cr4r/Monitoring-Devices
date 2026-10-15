// ================================================================
// DevWatch — routes/auth.js
// Autentikasi pengguna, pembuatan token JWT, dan penanganan sesi
// ================================================================

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, run } from '../database/db.js';
import { config } from '../config.js';
import { loginRateLimiter, recordFailedLogin, resetFailedLogin } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', loginRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email dan kata sandi wajib diisi.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = queryOne('SELECT * FROM users WHERE email = ?', [cleanEmail]);

  if (!user) {
    recordFailedLogin(cleanEmail);
    return res.status(401).json({
      success: false,
      message: 'Email atau kata sandi tidak sesuai.',
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
    const entry = recordFailedLogin(cleanEmail);
    const attemptsLeft = config.sessionLockoutAttempts - entry.count;
    return res.status(401).json({
      success: false,
      message: attemptsLeft > 0
        ? `Kata sandi salah. Sisa percobaan: ${attemptsLeft} kali.`
        : `Akun dikunci selama ${config.sessionLockoutMinutes} menit karena 5x gagal login.`,
    });
  }

  // Berhasil login: reset failure counter
  resetFailedLogin(cleanEmail);

  // Perbarui last_login dan ip_akses
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
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

  // Buat Token JWT
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role,
      avatar: user.avatar,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.json({
    success: true,
    message: 'Login berhasil.',
    token,
    user: {
      id: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role,
      avatar: user.avatar,
    },
  });
});

router.get('/me', authenticateToken, (req, res) => {
  const user = queryOne(
    `SELECT id, nama, email, role, avatar, status, last_login, created_at FROM users WHERE id = ?`,
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
