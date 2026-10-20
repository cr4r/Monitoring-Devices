// ================================================================
// DevWatch — monitoringWorker.js
// Pekerja latar belakang (Scheduler) yang memantau seluruh perangkat
// ================================================================

import { query, run, queryOne, getSystemSetting } from '../database/db.js';
import { probeDevice } from './hikvisionService.js';
import { broadcast } from './websocketService.js';
import { saveWeeklySnapshot } from './reportService.js';
import { config } from '../config.js';

let workerIntervalId = null;
let isProcessing = false;

/**
 * Normalisasi timestamp UTC SQLite string ke epoch ms akurat
 */
export function parseSqliteUtc(dateStr) {
  if (!dateStr) return 0;
  let s = String(dateStr).trim();
  if (!s) return 0;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    s += 'Z';
  }
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Jalankan 1 siklus pengecekan untuk seluruh perangkat aktif
 */
export async function runMonitoringCycle() {
  if (isProcessing) return;

  // Cek apakah engine monitoring diaktifkan di pengaturan sistem
  const isEngineActive = getSystemSetting('engine_active', 'true') === 'true';
  if (!isEngineActive) {
    return;
  }

  isProcessing = true;

  try {
    const defaultInterval = parseInt(getSystemSetting('default_ping_interval', String(config.defaultIntervalSeconds)), 10) || 60;
    const pingTimeout = parseInt(getSystemSetting('ping_timeout_ms', String(config.pingTimeoutMs)), 10) || 3000;
    const retryCount = parseInt(getSystemSetting('ping_retry_count', String(config.consecutiveFailureThreshold)), 10) || 3;

    const devices = query(`
      SELECT * FROM devices
      WHERE is_active = 1
    `);

    const now = Date.now();

    for (const dev of devices) {
      // 1. Cek apakah masa maintenance sudah berakhir
      if (dev.status === 'maintenance' && dev.maintenance_until) {
        const untilTime = parseSqliteUtc(dev.maintenance_until);
        if (now >= untilTime) {
          // Masa maintenance habis, kembalikan ke pemantauan aktif
          run(
            `UPDATE devices SET status = 'offline', maintenance_reason = NULL, maintenance_until = NULL WHERE id = ?`,
            [dev.id]
          );
          run(
            `INSERT INTO device_status_logs (device_id, device_name, device_ip, device_created_at, status_sebelumnya, status_baru, metode, response_time, pesan_log)
             VALUES (?, ?, ?, ?, 'Maintenance', 'Offline', 'System', '-', ?)`,
            [dev.id, dev.nama, dev.ip, dev.created_at, `Masa pemeliharaan (maintenance) untuk ${dev.nama} telah berakhir. Sistem kembali memantau.`]
          );
          broadcast('maintenance_expired', { id: dev.id, nama: dev.nama });
        }
      }

      // 2. Evaluasi apakah sudah waktunya dipolling berdasarkan interval masing-masing
      const lastCheckTime = parseSqliteUtc(dev.last_check);
      const intervalMs = (dev.interval_detik || defaultInterval) * 1000;

      if (now - lastCheckTime < intervalMs && lastCheckTime !== 0) {
        continue; // Belum waktunya
      }

      // Jangan trigger alert jika sedang maintenance
      if (dev.status === 'maintenance') {
        continue;
      }

      // 3. Lakukan Probe Jaringan Nyata
      const probeResult = await probeDevice(dev, pingTimeout);

      if (probeResult.alive) {
        // PERANGKAT MERESPONS
        const wasOffline = dev.status === 'offline';

        run(
          `UPDATE devices
           SET status = 'online',
               response_time_ms = ?,
               consecutive_failures = 0,
               last_check = datetime('now'),
               last_seen_online = datetime('now')
           WHERE id = ?`,
          [probeResult.time, dev.id]
        );

        if (wasOffline) {
          // Buat log pemulihan bahasa manusiawi
          const msg = `${dev.nama} (${dev.ip}) kembali terhubung ke jaringan. Status berubah menjadi Online.`;
          run(
            `INSERT INTO device_status_logs (device_id, device_name, device_ip, device_created_at, status_sebelumnya, status_baru, metode, response_time, pesan_log)
             VALUES (?, ?, ?, ?, 'Offline', 'Online', ?, ?, ?)`,
            [dev.id, dev.nama, dev.ip, dev.created_at, dev.metode, `${probeResult.time} ms`, msg]
          );

          // Tutup insiden yang sedang berjalan
          const activeIncident = queryOne(
            `SELECT id, waktu_mulai FROM incidents WHERE device_id = ? AND status = 'terbuka' ORDER BY id DESC LIMIT 1`,
            [dev.id]
          );

          if (activeIncident) {
            const startMs = new Date(activeIncident.waktu_mulai).getTime();
            const durasiMenit = Math.max(1, Math.round((now - startMs) / 60000));
            run(
              `UPDATE incidents
               SET status = 'selesai', waktu_selesai = datetime('now'), durasi_menit = ?
               WHERE id = ?`,
              [durasiMenit, activeIncident.id]
            );
          }

          broadcast('status_change', {
            id: dev.id,
            nama: dev.nama,
            status: 'online',
            responseTime: probeResult.time,
            message: msg,
          });
        }

        // Siarkan telemetri latency
        broadcast('telemetry', {
          id: dev.id,
          status: 'online',
          responseTime: probeResult.time,
        });

      } else {
        // PERANGKAT GAGAL MERESPONS
        const newFailures = (dev.consecutive_failures || 0) + 1;
        const shouldBeOffline = newFailures >= retryCount;
        const wasOnline = dev.status === 'online';

        run(
          `UPDATE devices
           SET consecutive_failures = ?,
               response_time_ms = 0,
               last_check = datetime('now'),
               status = CASE WHEN ? THEN 'offline' ELSE status END
           WHERE id = ?`,
          [newFailures, shouldBeOffline ? 1 : 0, dev.id]
        );

        if (shouldBeOffline && wasOnline) {
          // Buat log pemadaman bahasa manusiawi
          const msg = `${dev.nama} (${dev.ip}) tidak merespons ${dev.metode} (${probeResult.statusText}). Status berubah menjadi Offline.`;
          run(
            `INSERT INTO device_status_logs (device_id, device_name, device_ip, device_created_at, status_sebelumnya, status_baru, metode, response_time, pesan_log)
             VALUES (?, ?, ?, ?, 'Online', 'Offline', ?, 'Timeout', ?)`,
            [dev.id, dev.nama, dev.ip, dev.created_at, dev.metode, msg]
          );

          // Buka insiden baru
          run(
            `INSERT INTO incidents (device_id, waktu_mulai, status, penyebab)
             VALUES (?, datetime('now'), 'terbuka', ?)`,
            [dev.id, probeResult.statusText]
          );

          broadcast('status_change', {
            id: dev.id,
            nama: dev.nama,
            status: 'offline',
            responseTime: 0,
            message: msg,
          });
        }
      }
    }
  } catch (err) {
    console.error('[Monitoring Worker Error]:', err);
  } finally {
    isProcessing = false;
  }
}

/**
 * Memulai scheduler interval pemantauan
 */
export function startMonitoringWorker(cycleIntervalMs = 5000) {
  if (workerIntervalId) return;

  console.log(`Monitoring Worker aktif (Evaluasi per ${cycleIntervalMs / 1000} detik).`);

  // Jalankan segera siklus pertama setelah 2 detik
  setTimeout(() => {
    runMonitoringCycle();
  }, 2000);

  // Buat / perbarui snapshot laporan mingguan otomatis
  setTimeout(() => {
    try {
      saveWeeklySnapshot();
    } catch (e) {
      console.warn('Snapshot mingguan otomatis gagal:', e.message);
    }
  }, 4000);

  // Evaluasi berkala snapshot laporan mingguan (tiap 30 menit)
  setInterval(() => {
    try {
      saveWeeklySnapshot();
    } catch {}
  }, 30 * 60 * 1000);

  // Jadwalkan siklus berulang
  workerIntervalId = setInterval(runMonitoringCycle, cycleIntervalMs);
}

/**
 * Menghentikan scheduler
 */
export function stopMonitoringWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log('Monitoring Worker dihentikan.');
  }
}
