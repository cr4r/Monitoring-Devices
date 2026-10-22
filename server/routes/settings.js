// ================================================================
// DevWatch — routes/settings.js
// Pengaturan sistem: Umum, Monitoring, Notifikasi, Keamanan, Backup, Laporan
// ================================================================

import express from 'express';
import fs from 'fs';
import path from 'path';
import { db, query, queryOne, run } from '../database/db.js';
import { config } from '../config.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { broadcast } from '../services/websocketService.js';

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
  const updates = req.body;

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, message: 'Data konfigurasi tidak valid.' });
  }

  let updatedCount = 0;

  for (const [kategoriOrKey, val] of Object.entries(updates)) {
    if (kategoriOrKey === '_categories') continue;
    if (typeof val === 'object' && val !== null) {
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

// POST /api/settings/backup — Membuat salinan cadangan database SQLite riil
router.post('/backup', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    // 1. Checkpoint WAL SQLite agar seluruh transaksi masuk ke file utama
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (e) {
      console.warn('WAL checkpoint warning:', e.message);
    }

    // 2. Tentukan direktori backup
    const settings = getSystemSettingsObject();
    const customPath = settings.backup_target_path || '';
    let backupDir = path.resolve(path.dirname(config.dbPath), 'backups');

    if (customPath && customPath.trim() !== '') {
      try {
        if (!fs.existsSync(customPath)) {
          fs.mkdirSync(customPath, { recursive: true });
        }
        backupDir = customPath;
      } catch {
        // Fallback ke folder backup default jika path kustom tidak bisa diakses
        backupDir = path.resolve(path.dirname(config.dbPath), 'backups');
      }
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `devwatch-backup-${ts}.sqlite`;
    const targetFile = path.join(backupDir, filename);

    // 3. Salin berkas database
    fs.copyFileSync(config.dbPath, targetFile);
    const stats = fs.statSync(targetFile);

    // 4. Catat aktivitas audit
    run(
      `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
       VALUES (?, ?, 'Backup Database', ?)`,
      [req.user.id, req.user.nama, `Membuat cadangan database SQLite (${(stats.size / 1024).toFixed(1)} KB) ke ${filename}`]
    );

    res.json({
      success: true,
      message: `Cadangan database berhasil dibuat (${(stats.size / 1024).toFixed(1)} KB).`,
      data: {
        filename,
        filepath: targetFile,
        sizeBytes: stats.size,
        sizeKb: +(stats.size / 1024).toFixed(1),
        timestamp: now.toISOString(),
      },
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, message: `Gagal membuat cadangan: ${err.message}` });
  }
});

// GET /api/settings/backup/download — Unduh berkas cadangan database langsung
router.get('/backup/download', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}

    const backupDir = path.resolve(path.dirname(config.dbPath), 'backups');
    let targetFile = config.dbPath;
    let downloadName = `devwatch-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;

    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sqlite')).sort().reverse();
      if (files.length > 0) {
        targetFile = path.join(backupDir, files[0]);
        downloadName = files[0];
      }
    }

    res.download(targetFile, downloadName);
  } catch (err) {
    res.status(500).json({ success: false, message: `Gagal mengunduh database: ${err.message}` });
  }
});

// GET /api/settings/logs-stat — Ringkasan jumlah dan tanggal log sistem
router.get('/logs-stat', authenticateToken, (req, res) => {
  try {
    const status = queryOne('SELECT count(*) as count, min(waktu) as oldest, max(waktu) as newest FROM device_status_logs') || {};
    const activity = queryOne('SELECT count(*) as count, min(waktu) as oldest, max(waktu) as newest FROM user_activity_logs') || {};
    const config = queryOne('SELECT count(*) as count, min(waktu) as oldest, max(waktu) as newest FROM config_logs') || {};

    const statusCount = status.count || 0;
    const activityCount = activity.count || 0;
    const configCount = config.count || 0;
    const total = statusCount + activityCount + configCount;

    // Tentukan waktu log tertua keseluruhan
    const timestamps = [status.oldest, activity.oldest, config.oldest].filter(Boolean);
    const oldestAll = timestamps.length > 0 ? timestamps.sort()[0] : null;

    res.json({
      success: true,
      stats: {
        total,
        oldestAll,
        status: { count: statusCount, oldest: status.oldest || null, newest: status.newest || null },
        activity: { count: activityCount, oldest: activity.oldest || null, newest: activity.newest || null },
        config: { count: configCount, oldest: config.oldest || null, newest: config.newest || null },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `Gagal mengambil statistik log: ${err.message}` });
  }
});

// POST /api/settings/clean-logs — Pembersihan riwayat log kadaluarsa sesuai batas retensi
router.post('/clean-logs', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const settings = getSystemSettingsObject();
    const rawDays = req.body.retentionDays !== undefined ? req.body.retentionDays : (settings.retention_days || '90');
    const days = parseInt(rawDays, 10);

    let statusRes, actRes, cfgRes;

    if (days === 0) {
      // Hapus total semua rekaman riwayat log
      statusRes = run('DELETE FROM device_status_logs');
      actRes = run('DELETE FROM user_activity_logs');
      cfgRes = run('DELETE FROM config_logs');
    } else {
      // Hapus berdasarkan batas waktu retensi hari
      statusRes = run(`DELETE FROM device_status_logs WHERE waktu < datetime('now', '-${days} days')`);
      actRes = run(`DELETE FROM user_activity_logs WHERE waktu < datetime('now', '-${days} days')`);
      cfgRes = run(`DELETE FROM config_logs WHERE waktu < datetime('now', '-${days} days')`);
    }

    const totalDeleted = (statusRes.changes || 0) + (actRes.changes || 0) + (cfgRes.changes || 0);

    // Reclaim disk space
    try {
      db.exec('PRAGMA incremental_vacuum;');
    } catch {}

    const detailPesan = days === 0
      ? `Membersihkan seluruh riwayat log sistem (${totalDeleted} baris dihapus)`
      : `Membersihkan ${totalDeleted} baris log lama (> ${days} hari)`;

    run(
      `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
       VALUES (?, ?, 'Pembersihan Log', ?)`,
      [req.user.id, req.user.nama, detailPesan]
    );

    // Siarkan pembaruan log ke semua browser yang terhubung
    try {
      broadcast('logs_updated', { action: 'clean_logs', deleted: totalDeleted, days });
    } catch {}

    res.json({
      success: true,
      message: days === 0
        ? `Seluruh riwayat log berhasil dibersihkan (${totalDeleted} baris dihapus).`
        : `Pembersihan berhasil. Sebanyak ${totalDeleted} entri log lama (> ${days} hari) telah dihapus.`,
      deleted: {
        statusLogs: statusRes.changes || 0,
        activityLogs: actRes.changes || 0,
        configLogs: cfgRes.changes || 0,
        total: totalDeleted,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `Gagal membersihkan log: ${err.message}` });
  }
});

export default router;
