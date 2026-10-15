// ================================================================
// DevWatch — monitoringWorker.js
// Pekerja latar belakang (Scheduler) yang memantau seluruh perangkat
// ================================================================

import { query, run, queryOne } from '../database/db.js';
import { probeDevice } from './hikvisionService.js';
import { broadcast } from './websocketService.js';
import { config } from '../config.js';

let workerIntervalId = null;
let isProcessing = false;

/**
 * Jalankan 1 siklus pengecekan untuk seluruh perangkat aktif
 */
export async function runMonitoringCycle() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const devices = query(`
      SELECT * FROM devices
      WHERE is_active = 1
    `);

    const now = Date.now();

    for (const dev of devices) {
      // 1. Cek apakah masa maintenance sudah berakhir
      if (dev.status === 'maintenance' && dev.maintenance_until) {
        const untilTime = new Date(dev.maintenance_until).getTime();
        if (now >= untilTime) {
          // Masa maintenance habis, kembalikan ke pemantauan aktif
          run(
            `UPDATE devices SET status = 'offline', maintenance_reason = NULL, maintenance_until = NULL WHERE id = ?`,
            [dev.id]
          );
          run(
            `INSERT INTO device_status_logs (device_id, device_name, device_ip, status_sebelumnya, status_baru, metode, response_time, pesan_log)
             VALUES (?, ?, ?, 'Maintenance', 'Offline', 'System', '-', ?)`,
            [dev.id, dev.nama, dev.ip, `Masa pemeliharaan (maintenance) untuk ${dev.nama} telah berakhir. Sistem kembali memantau.`]
          );
          broadcast('maintenance_expired', { id: dev.id, nama: dev.nama });
        }
      }

      // 2. Evaluasi apakah sudah waktunya dipolling berdasarkan interval masing-masing
      const lastCheckTime = dev.last_check ? new Date(dev.last_check).getTime() : 0;
      const intervalMs = (dev.interval_detik || config.defaultIntervalSeconds) * 1000;

      if (now - lastCheckTime < intervalMs && lastCheckTime !== 0) {
        continue; // Belum waktunya
      }

      // Jangan trigger alert jika sedang maintenance
      if (dev.status === 'maintenance') {
        continue;
      }

      // 3. Lakukan Probe Jaringan Nyata
      const probeResult = await probeDevice(dev, config.pingTimeoutMs);

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
            `INSERT INTO device_status_logs (device_id, device_name, device_ip, status_sebelumnya, status_baru, metode, response_time, pesan_log)
             VALUES (?, ?, ?, 'Offline', 'Online', ?, ?, ?)`,
            [dev.id, dev.nama, dev.ip, dev.metode, `${probeResult.time} ms`, msg]
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
        const shouldBeOffline = newFailures >= config.consecutiveFailureThreshold;
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
            `INSERT INTO device_status_logs (device_id, device_name, device_ip, status_sebelumnya, status_baru, metode, response_time, pesan_log)
             VALUES (?, ?, ?, 'Online', 'Offline', ?, 'Timeout', ?)`,
            [dev.id, dev.nama, dev.ip, dev.metode, msg]
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
