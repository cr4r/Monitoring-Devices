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

// POST /api/settings/backup — Membuat salinan cadangan database SQLite atau Log JSON
router.post('/backup', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const backupType = (req.query.type || req.body?.type || 'full').toLowerCase();
    const settings = getSystemSettingsObject();
    const customPath = settings.backup_target_path || '';
    let backupDir = path.resolve(path.dirname(config.dbPath), 'backups');

    if (customPath && customPath.trim() !== '') {
      try {
        if (!fs.existsSync(customPath)) fs.mkdirSync(customPath, { recursive: true });
        backupDir = customPath;
      } catch {
        backupDir = path.resolve(path.dirname(config.dbPath), 'backups');
      }
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (backupType === 'logs') {
      // Backup Log Saja (JSON)
      const filename = `devwatch-backup-logs-${ts}.json`;
      const targetFile = path.join(backupDir, filename);

      const logsData = {
        app: 'MonDev',
        version: '1.0.0',
        type: 'logs',
        timestamp: now.toISOString(),
        tables: {
          device_status_logs: query('SELECT * FROM device_status_logs ORDER BY id ASC'),
          user_activity_logs: query('SELECT * FROM user_activity_logs ORDER BY id ASC'),
          config_logs: query('SELECT * FROM config_logs ORDER BY id ASC'),
          incidents: query('SELECT * FROM incidents ORDER BY id ASC'),
        },
      };

      fs.writeFileSync(targetFile, JSON.stringify(logsData, null, 2), 'utf8');
      const stats = fs.statSync(targetFile);

      run(
        `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
         VALUES (?, ?, 'Backup Log', ?)`,
        [req.user.id, req.user.nama, `Membuat cadangan log sistem (${(stats.size / 1024).toFixed(1)} KB) ke ${filename}`]
      );

      return res.json({
        success: true,
        type: 'logs',
        message: `Cadangan log sistem berhasil dibuat (${(stats.size / 1024).toFixed(1)} KB).`,
        data: {
          filename,
          filepath: targetFile,
          sizeBytes: stats.size,
          sizeKb: +(stats.size / 1024).toFixed(1),
          timestamp: now.toISOString(),
          type: 'logs',
        },
      });
    }

    // Backup Seluruh Sistem (SQLite + JSON)
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (e) {
      console.warn('WAL checkpoint warning:', e.message);
    }

    const filename = `devwatch-backup-full-${ts}.sqlite`;
    const targetFile = path.join(backupDir, filename);

    // Salin berkas SQLite utama
    fs.copyFileSync(config.dbPath, targetFile);
    const stats = fs.statSync(targetFile);

    // Buat juga JSON dump terstruktur untuk fleksibilitas restore
    const jsonFilename = `devwatch-backup-full-${ts}.json`;
    const jsonTarget = path.join(backupDir, jsonFilename);
    const fullDump = {
      app: 'MonDev',
      version: '1.0.0',
      type: 'full',
      timestamp: now.toISOString(),
      tables: {
        devices: query('SELECT * FROM devices WHERE is_active = 1'),
        system_settings: query('SELECT * FROM system_settings'),
        users: query('SELECT id, nama, email, password_hash, role, avatar, status, notif_settings FROM users'),
        device_status_logs: query('SELECT * FROM device_status_logs ORDER BY id ASC'),
        user_activity_logs: query('SELECT * FROM user_activity_logs ORDER BY id ASC'),
        config_logs: query('SELECT * FROM config_logs ORDER BY id ASC'),
        incidents: query('SELECT * FROM incidents ORDER BY id ASC'),
      },
    };
    fs.writeFileSync(jsonTarget, JSON.stringify(fullDump, null, 2), 'utf8');

    run(
      `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
       VALUES (?, ?, 'Backup Sistem Penuh', ?)`,
      [req.user.id, req.user.nama, `Membuat cadangan seluruh sistem (${(stats.size / 1024).toFixed(1)} KB) ke ${filename}`]
    );

    res.json({
      success: true,
      type: 'full',
      message: `Cadangan seluruh sistem berhasil dibuat (${(stats.size / 1024).toFixed(1)} KB).`,
      data: {
        filename,
        jsonFilename,
        filepath: targetFile,
        sizeBytes: stats.size,
        sizeKb: +(stats.size / 1024).toFixed(1),
        timestamp: now.toISOString(),
        type: 'full',
      },
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, message: `Gagal membuat cadangan: ${err.message}` });
  }
});

// GET /api/settings/backup/download — Unduh berkas cadangan langsung
router.get('/backup/download', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const backupDir = path.resolve(path.dirname(config.dbPath), 'backups');
    const requestedFile = req.query.filename ? path.basename(req.query.filename) : null;
    let targetFile = null;
    let downloadName = null;

    if (requestedFile && fs.existsSync(path.join(backupDir, requestedFile))) {
      targetFile = path.join(backupDir, requestedFile);
      downloadName = requestedFile;
    } else {
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sqlite') || f.endsWith('.json')).sort().reverse();
        if (files.length > 0) {
          targetFile = path.join(backupDir, files[0]);
          downloadName = files[0];
        }
      }
    }

    if (!targetFile || !fs.existsSync(targetFile)) {
      targetFile = config.dbPath;
      downloadName = `devwatch-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
    }

    res.download(targetFile, downloadName);
  } catch (err) {
    res.status(500).json({ success: false, message: `Gagal mengunduh berkas: ${err.message}` });
  }
});

// POST /api/settings/restore — Memulihkan data sistem dari berkas cadangan (JSON / SQLite)
router.post('/restore', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { backupData, fileBase64, filename } = req.body;

    if (!backupData && !fileBase64) {
      return res.status(400).json({ success: false, message: 'Tidak ada data berkas cadangan yang dikirim.' });
    }

    const backupDir = path.resolve(path.dirname(config.dbPath), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    // 1. Safety Checkpoint: Simpan snapshot database saat ini sebelum restore
    const safetyTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safetyFile = path.join(backupDir, `pre-restore-checkpoint-${safetyTs}.sqlite`);
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      fs.copyFileSync(config.dbPath, safetyFile);
    } catch (e) {
      console.warn('Safety checkpoint warning:', e.message);
    }

    let restoredDevices = 0;
    let restoredLogs = 0;
    let restoredSettings = 0;
    let restoredUsers = 0;

    let payload = backupData;
    if (!payload && fileBase64) {
      const buf = Buffer.from(fileBase64, 'base64');
      // Periksa apakah format JSON
      try {
        const text = buf.toString('utf8');
        payload = JSON.parse(text);
      } catch {
        // Berkas biner SQLite
        if (buf.length > 16 && buf.toString('utf8', 0, 16).startsWith('SQLite format 3')) {
          fs.writeFileSync(config.dbPath, buf);
          run(
            `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
             VALUES (?, ?, 'Restore Database', ?)`,
            [req.user.id, req.user.nama, `Memulihkan database SQLite biner (${(buf.length / 1024).toFixed(1)} KB) dari ${filename || 'file'}`]
          );

          broadcast('settings_updated', { action: 'restore' });
          broadcast('devices_updated', { action: 'restore' });
          broadcast('logs_updated', { action: 'restore' });

          return res.json({
            success: true,
            type: 'sqlite',
            message: 'Database SQLite berhasil dipulihkan secara penuh.',
            safetyCheckpoint: path.basename(safetyFile),
          });
        } else {
          return res.status(400).json({ success: false, message: 'Format berkas cadangan tidak valid (bukan JSON atau SQLite valid).' });
        }
      }
    }

    if (!payload || typeof payload !== 'object' || !payload.tables) {
      return res.status(400).json({ success: false, message: 'Struktur payload cadangan JSON tidak valid (atribut tables tidak ditemukan).' });
    }

    const tables = payload.tables;
    const isFull = payload.type === 'full' || Boolean(tables.devices || tables.system_settings);

    // Jalankan pemulihan tabel di dalam transaksi
    db.exec('BEGIN TRANSACTION;');
    try {
      if (isFull && Array.isArray(tables.devices)) {
        run('DELETE FROM devices');
        for (const d of tables.devices) {
          run(
            `INSERT INTO devices (id, nama, ip, hostname, jenis, metode, port, interval_detik, grup, lokasi, deskripsi, status, target_sla, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              d.id, d.nama, d.ip, d.hostname || null, d.jenis || 'Komputer', d.metode || 'PING', d.port || null,
              d.interval_detik || 60, d.grup || 'Umum', d.lokasi || 'Kantor', d.deskripsi || null,
              d.status || 'offline', d.target_sla || 99.0, d.is_active !== undefined ? d.is_active : 1,
              d.created_at || new Date().toISOString(), d.updated_at || new Date().toISOString()
            ]
          );
          restoredDevices++;
        }
      }

      if (isFull && Array.isArray(tables.system_settings)) {
        run('DELETE FROM system_settings');
        for (const s of tables.system_settings) {
          run(
            `INSERT INTO system_settings (kategori, kunci, nilai, updated_at)
             VALUES (?, ?, ?, ?)`,
            [s.kategori, s.kunci, s.nilai, s.updated_at || new Date().toISOString()]
          );
          restoredSettings++;
        }
      }

      if (isFull && Array.isArray(tables.users)) {
        for (const u of tables.users) {
          const exists = queryOne('SELECT id FROM users WHERE email = ?', [u.email]);
          if (!exists) {
            run(
              `INSERT INTO users (nama, email, password_hash, role, avatar, status, notif_settings)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [u.nama, u.email, u.password_hash, u.role || 'viewer', u.avatar || null, u.status || 'aktif', u.notif_settings || null]
            );
            restoredUsers++;
          }
        }
      }

      if (Array.isArray(tables.device_status_logs)) {
        for (const log of tables.device_status_logs) {
          run(
            `INSERT INTO device_status_logs (device_id, device_name, device_ip, waktu, status_sebelumnya, status_baru, metode, response_time, pesan_log)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [log.device_id, log.device_name, log.device_ip, log.waktu, log.status_sebelumnya, log.status_baru, log.metode, log.response_time, log.pesan_log]
          );
          restoredLogs++;
        }
      }

      if (Array.isArray(tables.user_activity_logs)) {
        for (const log of tables.user_activity_logs) {
          run(
            `INSERT INTO user_activity_logs (user_id, user_email, user_nama, waktu, aksi, ip_akses, detail)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [log.user_id, log.user_email, log.user_nama, log.waktu, log.aksi, log.ip_akses, log.detail]
          );
          restoredLogs++;
        }
      }

      if (Array.isArray(tables.config_logs)) {
        for (const log of tables.config_logs) {
          run(
            `INSERT INTO config_logs (user_id, user_nama, waktu, aksi, device_id, device_nama, detail)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [log.user_id, log.user_nama, log.waktu, log.aksi, log.device_id, log.device_nama, log.detail]
          );
          restoredLogs++;
        }
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    run(
      `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
       VALUES (?, ?, 'Restore Sistem', ?)`,
      [req.user.id, req.user.nama, `Memulihkan data sistem (${isFull ? 'Full System' : 'Log Only'}): ${restoredDevices} perangkat, ${restoredLogs} baris log, ${restoredSettings} pengaturan`]
    );

    broadcast('settings_updated', { action: 'restore' });
    broadcast('devices_updated', { action: 'restore' });
    broadcast('logs_updated', { action: 'restore' });

    res.json({
      success: true,
      type: isFull ? 'full' : 'logs',
      message: `Pemulihan data berhasil (${isFull ? 'Seluruh Sistem' : 'Log Saja'}).`,
      safetyCheckpoint: path.basename(safetyFile),
      restored: {
        devices: restoredDevices,
        logs: restoredLogs,
        settings: restoredSettings,
        users: restoredUsers,
      },
    });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ success: false, message: `Gagal memulihkan cadangan: ${err.message}` });
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
