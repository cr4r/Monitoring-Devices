// ================================================================
// DevWatch — routes/settings.js
// Pengaturan sistem: Umum, Monitoring, Notifikasi, Keamanan, Backup, Laporan
// ================================================================

import express from 'express';
import { query, run } from '../database/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

function getSystemSettingsObject() {
  const rows = query('SELECT kategori, kunci, nilai FROM system_settings');
  const categorized = {};
  const flat = {};
  for (const row of rows) {
    if (!categorized[row.kategori]) {
      categorized[row.kategori] = {};
    }
    categorized[row.kategori][row.kunci] = row.nilai;
    flat[row.kunci] = row.nilai;
  }
  return { ...categorized, ...flat, _categories: categorized };
}

// GET /api/settings — Mengambil seluruh konfigurasi
router.get('/', authenticateToken, (req, res) => {
  const settings = getSystemSettingsObject();
  res.json({ success: true, data: settings });
});

// PUT /api/settings — Menyimpan pembaruan konfigurasi (Admin Only)
router.put('/', authenticateToken, requireRole(['admin']), (req, res) => {
  const updates = req.body; // { kategori: { kunci: nilai } } atau { [kunci]: nilai }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, message: 'Data konfigurasi tidak valid.' });
  }

  let updatedCount = 0;

  for (const [kategoriOrKey, val] of Object.entries(updates)) {
    if (kategoriOrKey === '_categories') continue;
    if (typeof val === 'object' && val !== null) {
      // Format { umum: { app_name: 'DevWatch' } }
      for (const [kunci, subVal] of Object.entries(val)) {
        run(
          `INSERT INTO system_settings (kategori, kunci, nilai, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, updated_at = excluded.updated_at`,
          [kategoriOrKey, kunci, String(subVal)]
        );
        updatedCount++;
      }
    } else {
      // Format langsung { app_name: 'DevWatch' }
      run(
        `INSERT INTO system_settings (kategori, kunci, nilai, updated_at)
         VALUES ('umum', ?, ?, datetime('now'))
         ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, updated_at = excluded.updated_at`,
        [kategoriOrKey, String(val)]
      );
      updatedCount++;
    }
  }

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
     VALUES (?, ?, 'Simpan Pengaturan', ?)`,
    [req.user.id, req.user.nama, `Memperbarui ${updatedCount} parameter konfigurasi sistem`]
  );

  const updatedSettings = getSystemSettingsObject();

  res.json({
    success: true,
    message: 'Pengaturan sistem berhasil disimpan.',
    data: updatedSettings,
  });
});

export default router;
