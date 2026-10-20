// ================================================================
// DevWatch — routes/users.js
// Manajemen akun pengguna & hak akses (Admin Only)
// ================================================================

import express from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, run } from '../database/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// PUT /api/users/profile/avatar — Update foto profil sendiri (Dapat diakses semua pengguna login)
router.put('/profile/avatar', authenticateToken, (req, res) => {
  const { avatar } = req.body;
  if (!avatar || typeof avatar !== 'string') {
    return res.status(400).json({ success: false, message: 'Data foto avatar tidak valid.' });
  }

  run(
    `UPDATE users
     SET avatar = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [avatar, req.user.id]
  );

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  run(
    `INSERT INTO user_activity_logs (user_id, user_email, user_nama, aksi, ip_akses, detail)
     VALUES (?, ?, ?, 'Ubah Foto Profil', ?, 'Pengguna memperbarui foto profil terkompresi')`,
    [req.user.id, req.user.email, req.user.nama, ip]
  );

  res.json({
    success: true,
    message: 'Foto profil berhasil diperbarui.',
    data: { avatar },
  });
});

// Hanya role admin yang bisa mengakses seluruh route manajemen di bawah ini
router.use(authenticateToken, requireRole(['admin']));

// GET /api/users — Daftar seluruh pengguna
router.get('/', (req, res) => {
  const users = query(`
    SELECT id, nama, email, role, avatar, status, last_login, created_at
    FROM users
    ORDER BY id ASC
  `);
  res.json({ success: true, data: users });
});

// POST /api/users — Tambah akun pengguna baru
router.post('/', (req, res) => {
  const { nama, email, password, role = 'viewer', status = 'aktif' } = req.body;

  if (!nama || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Nama, email, dan kata sandi wajib diisi.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);

  if (existing) {
    return res.status(409).json({
      success: false,
      message: `Pengguna dengan email ${cleanEmail} sudah terdaftar.`,
    });
  }

  const hash = bcrypt.hashSync(password, 10);
  const avatar = nama
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const result = run(
    `INSERT INTO users (nama, email, password_hash, role, avatar, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nama.trim(), cleanEmail, hash, role, avatar, status]
  );

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
     VALUES (?, ?, 'Tambah Pengguna', ?)`,
    [req.user.id, req.user.nama, `Membuat akun baru: ${nama} (${cleanEmail}) dengan peran ${role}`]
  );

  res.status(201).json({
    success: true,
    message: `Pengguna ${nama} berhasil dibuat.`,
    data: { id: result.lastInsertRowid },
  });
});

// PUT /api/users/:id — Perbarui profil atau status pengguna
router.put('/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const user = queryOne('SELECT * FROM users WHERE id = ?', [targetId]);

  if (!user) {
    return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  }

  const { nama, role, status } = req.body;

  run(
    `UPDATE users
     SET nama = coalesce(?, nama),
         role = coalesce(?, role),
         status = coalesce(?, status),
         updated_at = datetime('now')
     WHERE id = ?`,
    [nama?.trim(), role, status, targetId]
  );

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
     VALUES (?, ?, 'Edit Pengguna', ?)`,
    [req.user.id, req.user.nama, `Mengubah data pengguna ${user.nama} (${user.email})`]
  );

  res.json({
    success: true,
    message: `Pengguna ${user.nama} berhasil diperbarui.`,
  });
});

// DELETE /api/users/:id — Hapus pengguna
router.delete('/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);

  if (targetId === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.',
    });
  }

  const user = queryOne('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  }

  run('DELETE FROM users WHERE id = ?', [targetId]);

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
     VALUES (?, ?, 'Hapus Pengguna', ?)`,
    [req.user.id, req.user.nama, `Menghapus akun pengguna ${user.nama} (${user.email})`]
  );

  res.json({
    success: true,
    message: `Pengguna ${user.nama} berhasil dihapus.`,
  });
});

// POST /api/users/:id/reset-password — Reset kata sandi staf
router.post('/:id/reset-password', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const user = queryOne('SELECT * FROM users WHERE id = ?', [targetId]);

  if (!user) {
    return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  }

  const { newPassword = 'Password123!' } = req.body;
  const hash = bcrypt.hashSync(newPassword, 10);

  run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, targetId]);

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
     VALUES (?, ?, 'Reset Password', ?)`,
    [req.user.id, req.user.nama, `Mereset kata sandi pengguna ${user.nama} (${user.email})`]
  );

  res.json({
    success: true,
    message: `Kata sandi untuk ${user.nama} berhasil direset.`,
  });
});

export default router;
