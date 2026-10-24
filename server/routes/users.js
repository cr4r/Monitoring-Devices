// ================================================================
// DevWatch - routes/users.js
// Manajemen akun pengguna & hak akses (Admin Only)
// ================================================================

import express from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, run } from '../database/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// PUT /api/users/profile/avatar - Update foto profil sendiri (Dapat diakses semua pengguna login)
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

// GET /api/users - Daftar seluruh pengguna
router.get('/', (req, res) => {
  const users = query(`
    SELECT id, nama, username, email, role, avatar, status, last_login, created_at
    FROM users
    ORDER BY id ASC
  `);
  res.json({ success: true, data: users });
});

// POST /api/users - Tambah akun pengguna baru
router.post('/', (req, res) => {
  const { nama, username, email, password, role = 'viewer', status = 'aktif', avatar: customAvatar } = req.body;

  if (!nama || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Nama, email, dan kata sandi wajib diisi.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = (username || cleanEmail.split('@')[0] || '').trim().toLowerCase();

  const existingUsername = queryOne('SELECT id FROM users WHERE LOWER(username) = ?', [cleanUsername]);
  if (existingUsername) {
    return res.status(409).json({
      success: false,
      message: `Username "${cleanUsername}" sudah digunakan oleh akun lain.`,
    });
  }

  const existingEmail = queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (existingEmail) {
    return res.status(409).json({
      success: false,
      message: `Pengguna dengan email ${cleanEmail} sudah terdaftar.`,
    });
  }

  const hash = bcrypt.hashSync(password, 10);
  const avatar = customAvatar && customAvatar.trim()
    ? customAvatar.trim()
    : nama
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

  const result = run(
    `INSERT INTO users (nama, username, email, password_hash, role, avatar, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nama.trim(), cleanUsername, cleanEmail, hash, role, avatar, status]
  );

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
     VALUES (?, ?, 'Tambah Pengguna', ?)`,
    [req.user.id, req.user.nama, `Membuat akun baru: ${nama} (@${cleanUsername}) dengan peran ${role}`]
  );

  res.status(201).json({
    success: true,
    message: `Pengguna ${nama} (@${cleanUsername}) berhasil dibuat.`,
    data: { id: result.lastInsertRowid, username: cleanUsername },
  });
});

// PUT /api/users/:id - Perbarui profil atau status pengguna
router.put('/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const user = queryOne('SELECT * FROM users WHERE id = ?', [targetId]);

  if (!user) {
    return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  }

  const { nama, username, email, role, status, avatar } = req.body;

  // Cek duplikasi username jika diubah
  if (username && username.trim().toLowerCase() !== (user.username || '').toLowerCase()) {
    const cleanUsername = username.trim().toLowerCase();
    const existing = queryOne('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?', [cleanUsername, targetId]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Username "${cleanUsername}" sudah digunakan oleh akun lain.`,
      });
    }
  }

  // Cek duplikasi email jika diubah
  if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
    const cleanEmail = email.trim().toLowerCase();
    const existing = queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, targetId]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Email "${cleanEmail}" sudah digunakan oleh akun lain.`,
      });
    }
  }

  const newNama = nama !== undefined ? nama.trim() : user.nama;
  const newUsername = username !== undefined ? username.trim().toLowerCase() : user.username;
  const newEmail = email !== undefined ? email.trim().toLowerCase() : user.email;
  const newRole = role !== undefined ? role : user.role;
  const newStatus = status !== undefined ? status : user.status;
  const newAvatar = avatar !== undefined ? avatar : user.avatar;

  run(
    `UPDATE users
     SET nama = ?,
         username = ?,
         email = ?,
         role = ?,
         status = ?,
         avatar = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [newNama, newUsername, newEmail, newRole, newStatus, newAvatar, targetId]
  );

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
     VALUES (?, ?, 'Edit Pengguna', ?)`,
    [req.user.id, req.user.nama, `Mengubah data pengguna ${user.nama} (@${newUsername})`]
  );

  res.json({
    success: true,
    message: `Pengguna ${newNama} berhasil diperbarui.`,
    data: {
      id: targetId,
      nama: newNama,
      username: newUsername,
      email: newEmail,
      role: newRole,
      status: newStatus,
      avatar: newAvatar,
    },
  });
});

// DELETE /api/users/:id - Hapus pengguna
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

// POST /api/users/:id/reset-password - Reset kata sandi staf
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
