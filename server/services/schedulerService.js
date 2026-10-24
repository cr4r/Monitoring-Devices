// ================================================================
// DevWatch - schedulerService.js
// Pekerja terjadwal di latar belakang:
// 1. Eksekusi Backup Otomatis Database SQLite & JSON sesuai jadwal
// 2. Pembersihan otomatis log lama (Auto-Delete Log Retention)
// ================================================================

import fs from 'fs';
import path from 'path';
import { db, query, queryOne, run, getSystemSetting } from '../database/db.js';
import { config } from '../config.js';
import { broadcast } from './websocketService.js';

let schedulerIntervalId = null;
let isRunningScheduledJob = false;

/**
 * Menghitung apakah jadwal backup sudah jatuh tempo
 */
function isBackupDue(schedule, lastBackupDateStr) {
  if (!schedule || schedule === 'none') return false;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  if (!lastBackupDateStr) {
    // Belum pernah backup otomatis, jalankan pertama kali
    return true;
  }

  const lastDate = new Date(lastBackupDateStr);
  const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

  if (schedule === 'daily' || schedule === 'daily_midnight') {
    return diffDays >= 1 || lastBackupDateStr.slice(0, 10) !== todayStr;
  }

  if (schedule === 'weekly') {
    return diffDays >= 7;
  }

  if (schedule === 'monthly') {
    return diffDays >= 30;
  }

  return false;
}

/**
 * Menjalankan proses backup otomatis penuh
 */
export async function executeScheduledBackup() {
  try {
    const isAutoBackupEnabled = getSystemSetting('auto_backup_enabled', 'true') === 'true';
    const schedule = getSystemSetting('backup_schedule', 'daily');

    if (!isAutoBackupEnabled || schedule === 'none') {
      return null;
    }

    const lastBackupDate = getSystemSetting('last_auto_backup_timestamp', '');
    if (!isBackupDue(schedule, lastBackupDate)) {
      return null;
    }

    const customPath = getSystemSetting('backup_target_path', '');
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

    // 1. Truncate WAL checkpoint sebelum salin
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (e) {
      console.warn('[Scheduler Backup] WAL Checkpoint warning:', e.message);
    }

    const filename = `devwatch-auto-backup-${schedule}-${ts}.sqlite`;
    const targetFile = path.join(backupDir, filename);

    // 2. Salin berkas SQLite biner
    fs.copyFileSync(config.dbPath, targetFile);
    const stats = fs.statSync(targetFile);

    // 3. Buat JSON dump pelengkap
    const jsonFilename = `devwatch-auto-backup-${schedule}-${ts}.json`;
    const jsonTarget = path.join(backupDir, jsonFilename);
    const fullDump = {
      app: 'MonDev',
      version: '1.0.0',
      type: 'scheduled_auto',
      schedule,
      timestamp: now.toISOString(),
      tables: {
        devices: query('SELECT * FROM devices'),
        system_settings: query('SELECT * FROM system_settings'),
        users: query('SELECT id, nama, email, password_hash, role, avatar, status, notif_settings FROM users'),
        device_status_logs: query('SELECT * FROM device_status_logs ORDER BY id ASC'),
        user_activity_logs: query('SELECT * FROM user_activity_logs ORDER BY id ASC'),
        config_logs: query('SELECT * FROM config_logs ORDER BY id ASC'),
        incidents: query('SELECT * FROM incidents ORDER BY id ASC'),
        weekly_reports: query('SELECT * FROM weekly_reports ORDER BY id ASC'),
      },
    };
    fs.writeFileSync(jsonTarget, JSON.stringify(fullDump, null, 2), 'utf8');

    // 4. Catat waktu eksekusi terakhir
    run(
      `INSERT INTO system_settings (kategori, kunci, nilai, updated_at)
       VALUES ('log_backup', 'last_auto_backup_timestamp', ?, datetime('now'))
       ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, updated_at = excluded.updated_at`,
      [now.toISOString()]
    );

    // 5. Catat log konfigurasi
    run(
      `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
       VALUES (0, 'System Scheduler', 'Backup Otomatis Terjadwal', ?)`,
      [`Membuat cadangan terjadwal (${schedule}) ukuran ${(stats.size / 1024).toFixed(1)} KB ke ${filename}`]
    );

    console.log(`[Scheduler] Backup otomatis (${schedule}) sukses dibuat: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);

    broadcast('backup_completed', {
      type: 'auto',
      schedule,
      filename,
      timestamp: now.toISOString(),
    });

    return { filename, sizeBytes: stats.size };
  } catch (err) {
    console.error('[Scheduler Backup Error]:', err.message);
    return null;
  }
}

/**
 * Menjalankan pembersihan otomatis log kadaluarsa sesuai batas retensi
 */
export async function executeScheduledLogCleanup() {
  try {
    const isAutoDeleteEnabled = getSystemSetting('auto_delete_logs_enabled', getSystemSetting('auto_backup_enabled', 'true')) === 'true';
    if (!isAutoDeleteEnabled) {
      return null;
    }

    const rawDays = getSystemSetting('retention_days', '90');
    const days = parseInt(rawDays, 10);
    if (isNaN(days) || days <= 0) {
      return null;
    }

    const statusRes = run(`DELETE FROM device_status_logs WHERE datetime(replace(replace(waktu, 'T', ' '), 'Z', '')) < datetime('now', '-' || ? || ' days')`, [days]);
    const actRes = run(`DELETE FROM user_activity_logs WHERE datetime(replace(replace(waktu, 'T', ' '), 'Z', '')) < datetime('now', '-' || ? || ' days')`, [days]);
    const cfgRes = run(`DELETE FROM config_logs WHERE datetime(replace(replace(waktu, 'T', ' '), 'Z', '')) < datetime('now', '-' || ? || ' days')`, [days]);

    const totalDeleted = (statusRes.changes || 0) + (actRes.changes || 0) + (cfgRes.changes || 0);

    if (totalDeleted > 0) {
      try {
        db.exec('PRAGMA incremental_vacuum;');
      } catch {}

      run(
        `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
         VALUES (0, 'System Scheduler', 'Auto-Delete Log Kadaluarsa', ?)`,
        [`Membersihkan otomatis ${totalDeleted} baris log yang melampaui batas retensi (${days} hari)`]
      );

      console.log(`[Scheduler] Auto-delete log: Berhasil membersihkan ${totalDeleted} baris log lama (> ${days} hari)`);

      broadcast('logs_updated', {
        action: 'auto_clean',
        deleted: totalDeleted,
        days,
      });
    }

    return totalDeleted;
  } catch (err) {
    console.error('[Scheduler Log Cleanup Error]:', err.message);
    return null;
  }
}

/**
 * Evaluasi 1 siklus scheduler
 */
export async function runSchedulerCycle() {
  if (isRunningScheduledJob) return;
  isRunningScheduledJob = true;

  try {
    await executeScheduledBackup();
    await executeScheduledLogCleanup();
  } catch (cycleErr) {
    console.error('[Scheduler Cycle Error]:', cycleErr.message);
  } finally {
    isRunningScheduledJob = false;
  }
}

/**
 * Memulai scheduler latar belakang (dijalankan setiap interval evaluasi)
 */
export function startScheduler(evalIntervalMs = 60000) {
  if (schedulerIntervalId) return;

  console.log(`System Scheduler aktif (Evaluasi per ${evalIntervalMs / 1000} detik).`);

  // Jalankan evaluasi pertama setelah 5 detik server hidup
  setTimeout(() => {
    runSchedulerCycle();
  }, 5000);

  // Interval evaluasi berkala
  schedulerIntervalId = setInterval(runSchedulerCycle, evalIntervalMs);
}

/**
 * Menghentikan scheduler latar belakang
 */
export function stopScheduler() {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log('System Scheduler dihentikan.');
  }
}
