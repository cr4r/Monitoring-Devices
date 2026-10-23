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
 * Eksekutor Antrean Konkuren (Concurrency Pool)
 * Membatasi jumlah eksekusi proses simultan agar aman bagi CPU sistem
 */
export async function asyncPool(limit, items, iteratorFn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
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

    // 1. Cek masa maintenance yang berakhir
    for (const dev of devices) {
      if (dev.status === 'maintenance' && dev.maintenance_until) {
        const untilTime = parseSqliteUtc(dev.maintenance_until);
        if (now >= untilTime) {
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
    }

    // 2. Filter perangkat yang sudah jatuh tempo pengecekan (dengan jitter offset 0-6 detik)
    const dueDevices = devices.filter((dev) => {
      if (dev.status === 'maintenance') return false;
      const lastCheckTime = parseSqliteUtc(dev.last_check);
      if (lastCheckTime === 0) return true; // Belum pernah dicek, prioritaskan langsung

      const intervalMs = (dev.interval_detik || defaultInterval) * 1000;
      const jitterMs = ((dev.id * 3) % 7) * 1000; // Sebar eksekusi agar tidak terjadi spike
      return (now - lastCheckTime >= (intervalMs + jitterMs));
    });

    if (dueDevices.length === 0) {
      return;
    }

    // 3. Eksekusi probe dengan Concurrency Pool (Maksimal 6 proses simultan)
    const MAX_CONCURRENT_PROBES = 6;
    await asyncPool(MAX_CONCURRENT_PROBES, dueDevices, async (dev) => {
      try {
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
            const msg = `${dev.nama} (${dev.ip}) kembali terhubung ke jaringan. Status berubah menjadi Online.`;
            run(
              `INSERT INTO device_status_logs (device_id, device_name, device_ip, device_created_at, status_sebelumnya, status_baru, metode, response_time, pesan_log)
               VALUES (?, ?, ?, ?, 'Offline', 'Online', ?, ?, ?)`,
              [dev.id, dev.nama, dev.ip, dev.created_at, dev.metode, `${probeResult.time} ms`, msg]
            );

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

          broadcast('telemetry', {
            id: dev.id,
            status: 'online',
            responseTime: probeResult.time,
          });
        } else {
          // PERANGKAT GAGAL MERESPONS
          const newFailures = Math.min(99, (dev.consecutive_failures || 0) + 1);
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
            const msg = `${dev.nama} (${dev.ip}) tidak merespons ${dev.metode} (${probeResult.statusText}). Status berubah menjadi Offline.`;
            run(
              `INSERT INTO device_status_logs (device_id, device_name, device_ip, device_created_at, status_sebelumnya, status_baru, metode, response_time, pesan_log)
               VALUES (?, ?, ?, ?, 'Online', 'Offline', ?, 'Timeout', ?)`,
              [dev.id, dev.nama, dev.ip, dev.created_at, dev.metode, msg]
            );

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
      } catch (devErr) {
        console.error(`[Worker Device Probe Error] Device ${dev.id} (${dev.ip}):`, devErr.message);
      }
    });
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
