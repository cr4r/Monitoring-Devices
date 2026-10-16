// ================================================================
// DevWatch — routes/devices.js
// CRUD Manajemen perangkat, uji ping langsung, mode pemeliharaan, CSV
// ================================================================

import express from 'express';
import { query, queryOne, run } from '../database/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { probeDevice, getIsapiDeviceInfo } from '../services/hikvisionService.js';
import { broadcast } from '../services/websocketService.js';

const router = express.Router();

function normalizeJenis(val) {
  if (!val) return 'Komputer';
  const low = String(val).toLowerCase();
  return low.includes('cctv') ? 'CCTV Hikvision' : 'Komputer';
}

function normalizeMetode(val) {
  if (!val) return 'PING';
  const up = String(val).toUpperCase();
  const valid = ['PING', 'ISAPI', 'RTSP', 'ONVIF'];
  return valid.includes(up) ? up : 'PING';
}

// GET /api/devices — Daftar perangkat dengan filter & statistik
router.get('/', authenticateToken, (req, res) => {
  const { status, jenis, grup, search } = req.query;

  let sql = 'SELECT * FROM devices WHERE is_active = 1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (jenis && jenis !== 'all') {
    sql += ' AND jenis = ?';
    params.push(jenis);
  }

  if (grup && grup !== 'all') {
    sql += ' AND grup = ?';
    params.push(grup);
  }

  if (search && search.trim()) {
    sql += ' AND (nama LIKE ? OR ip LIKE ? OR hostname LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY id ASC';

  const devices = query(sql, params);

  // Hitung ringkasan status
  const allDevices = query('SELECT status, grup FROM devices WHERE is_active = 1');
  const counts = {
    total: allDevices.length,
    online: allDevices.filter((d) => d.status === 'online').length,
    offline: allDevices.filter((d) => d.status === 'offline').length,
    maintenance: allDevices.filter((d) => d.status === 'maintenance').length,
  };

  const groups = [...new Set(allDevices.map((d) => d.grup))].filter(Boolean);

  res.json({
    success: true,
    data: devices,
    counts,
    groups,
  });
});

// GET /api/devices/:id — Detail 1 perangkat beserta metrik & riwayat
router.get('/:id', authenticateToken, (req, res) => {
  const device = queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);

  if (!device) {
    return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
  }

  // Riwayat insiden perangkat ini
  const incidents = query(
    `SELECT * FROM incidents WHERE device_id = ? ORDER BY waktu_mulai DESC LIMIT 10`,
    [device.id]
  );

  // Log status terakhir perangkat ini
  const recentLogs = query(
    `SELECT * FROM device_status_logs WHERE device_id = ? ORDER BY waktu DESC LIMIT 10`,
    [device.id]
  );

  // Buat data titik status 24 jam riil berdasarkan waktu pembuatan dan log
  const now = new Date();
  let createdAt = new Date(0);
  if (device.created_at) {
    const raw = String(device.created_at).trim();
    createdAt = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
    if (isNaN(createdAt.getTime())) {
      createdAt = new Date(raw);
    }
  }

  // Ambil log status historis dalam 24 jam terakhir
  const past24hLogs = query(
    `SELECT * FROM device_status_logs WHERE device_id = ? AND waktu >= datetime('now', '-24 hours') ORDER BY waktu ASC`,
    [device.id]
  );

  const timeline24h = Array.from({ length: 24 }, (_, i) => {
    const hTime = new Date(now.getTime() - (23 - i) * 3600000);
    const hourLabel = `${hTime.getHours().toString().padStart(2, '0')}:00`;

    // Jika jam ini berakhir sebelum perangkat didaftarkan, tandai 'nodata'
    if (hTime.getTime() + 3600000 < createdAt.getTime()) {
      return {
        hour: hourLabel,
        status: 'nodata',
        latency: null,
      };
    }

    // Perangkat sudah terdaftar pada jam ini: evaluasi status dari log atau status saat ini
    let statusAtHour = (device.status || 'offline').toLowerCase();
    let latencyAtHour = statusAtHour === 'online' ? (device.response_time_ms || 1) : null;

    if (past24hLogs.length > 0) {
      const logsUpToHour = past24hLogs.filter((l) => {
        const lw = new Date(l.waktu?.includes('T') ? l.waktu : String(l.waktu).replace(' ', 'T') + 'Z');
        return !isNaN(lw.getTime()) && lw.getTime() <= hTime.getTime() + 3600000;
      });
      if (logsUpToHour.length > 0) {
        const lastLog = logsUpToHour[logsUpToHour.length - 1];
        statusAtHour = (lastLog.status_baru || device.status).toLowerCase();
        if (statusAtHour !== 'online') {
          latencyAtHour = null;
        } else if (lastLog.response_time && !isNaN(parseInt(lastLog.response_time))) {
          latencyAtHour = parseInt(lastLog.response_time);
        }
      }
    }

    return {
      hour: hourLabel,
      status: statusAtHour,
      latency: latencyAtHour,
    };
  });

  res.json({
    success: true,
    data: {
      ...device,
      incidents,
      recentLogs,
      timeline24h,
    },
  });
});

// GET /api/devices/:id/isapi — Ambil detail metadata ISAPI Hikvision
router.get('/:id/isapi', authenticateToken, async (req, res) => {
  const device = queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
  }

  const isapiData = await getIsapiDeviceInfo(device);
  res.json({ success: true, data: isapiData });
});

// POST /api/devices — Tambah perangkat baru
router.post('/', authenticateToken, requireRole(['admin', 'teknisi']), (req, res) => {
  const {
    nama,
    ip,
    hostname,
    jenis,
    metode = 'PING',
    port,
    interval_detik = 60,
    grup,
    lokasi,
    deskripsi,
    target_sla = 99.0,
  } = req.body;

  if (!nama || !ip || !jenis || !grup || !lokasi) {
    return res.status(400).json({
      success: false,
      message: 'Bidang Nama, IP, Jenis, Grup, dan Lokasi wajib diisi.',
    });
  }

  const cleanJenis = normalizeJenis(jenis);
  const cleanMetode = normalizeMetode(metode);

  const result = run(
    `INSERT INTO devices (nama, ip, hostname, jenis, metode, port, interval_detik, grup, lokasi, deskripsi, target_sla, status, last_check, last_seen_online)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', datetime('now'), datetime('now'))`,
    [
      nama.trim(),
      ip.trim(),
      hostname ? hostname.trim() : null,
      cleanJenis,
      cleanMetode,
      port ? parseInt(port, 10) : null,
      parseInt(interval_detik, 10) || 60,
      grup.trim(),
      lokasi.trim(),
      deskripsi || null,
      parseFloat(target_sla) || 99.0,
    ]
  );

  const newId = result.lastInsertRowid;

  // Catat konfigurasi log
  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, device_id, device_nama, detail)
     VALUES (?, ?, 'Tambah Perangkat', ?, ?, ?)`,
    [
      req.user.id,
      req.user.nama,
      newId,
      nama,
      `Menambahkan perangkat baru: ${nama} (${ip}) dengan metode ${metode}`,
    ]
  );

  broadcast('device_created', { id: newId, nama, ip, jenis, grup });

  res.status(201).json({
    success: true,
    message: `Perangkat ${nama} berhasil ditambahkan.`,
    data: { id: newId },
  });
});

// PUT /api/devices/:id — Perbarui konfigurasi perangkat
router.put('/:id', authenticateToken, requireRole(['admin', 'teknisi']), (req, res) => {
  const dev = queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);

  if (!dev) {
    return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
  }

  const {
    nama,
    ip,
    hostname,
    jenis,
    metode,
    port,
    interval_detik,
    grup,
    lokasi,
    deskripsi,
    target_sla,
  } = req.body;

  const cleanJenis = jenis ? normalizeJenis(jenis) : null;
  const cleanMetode = metode ? normalizeMetode(metode) : null;

  run(
    `UPDATE devices
     SET nama = coalesce(?, nama),
         ip = coalesce(?, ip),
         hostname = coalesce(?, hostname),
         jenis = coalesce(?, jenis),
         metode = coalesce(?, metode),
         port = coalesce(?, port),
         interval_detik = coalesce(?, interval_detik),
         grup = coalesce(?, grup),
         lokasi = coalesce(?, lokasi),
         deskripsi = coalesce(?, deskripsi),
         target_sla = coalesce(?, target_sla),
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      nama?.trim() ?? null,
      ip?.trim() ?? null,
      hostname?.trim() ?? null,
      cleanJenis ?? null,
      cleanMetode ?? null,
      port !== undefined && port !== '' ? parseInt(port, 10) : null,
      interval_detik !== undefined && interval_detik !== '' ? parseInt(interval_detik, 10) : null,
      grup?.trim() ?? null,
      lokasi?.trim() ?? null,
      deskripsi ?? null,
      target_sla !== undefined && target_sla !== '' ? parseFloat(target_sla) : null,
      dev.id,
    ]
  );

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, device_id, device_nama, detail)
     VALUES (?, ?, 'Edit Perangkat', ?, ?, ?)`,
    [req.user.id, req.user.nama, dev.id, dev.nama, `Memperbarui konfigurasi perangkat ${dev.nama}`]
  );

  broadcast('device_updated', { id: dev.id, nama: nama || dev.nama });

  res.json({
    success: true,
    message: `Perangkat ${dev.nama} berhasil diperbarui.`,
  });
});

// POST /api/devices/bulk-delete — Hapus banyak perangkat sekaligus (Admin only)
router.post('/bulk-delete', authenticateToken, requireRole(['admin']), (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Daftar ID perangkat yang akan dihapus tidak valid.' });
  }

  const validIds = ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id) && id > 0);
  if (validIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada ID perangkat valid yang dipilih.' });
  }

  const placeholders = validIds.map(() => '?').join(',');
  const devicesToDelete = query(`SELECT id, nama, ip FROM devices WHERE id IN (${placeholders})`, validIds);

  run(`DELETE FROM devices WHERE id IN (${placeholders})`, validIds);

  for (const d of devicesToDelete) {
    run(
      `INSERT INTO config_logs (user_id, user_nama, aksi, device_id, device_nama, detail)
       VALUES (?, ?, 'Hapus Perangkat (Massal)', ?, ?, ?)`,
      [req.user.id, req.user.nama, d.id, d.nama, `Menghapus massal perangkat ${d.nama} (${d.ip})`]
    );
  }

  broadcast('devices_deleted', { ids: validIds });

  res.json({
    success: true,
    message: `${devicesToDelete.length} perangkat berhasil dihapus dari sistem.`,
    deletedCount: devicesToDelete.length,
    deletedIds: validIds,
  });
});

// DELETE /api/devices/:id — Hapus perangkat (Admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const dev = queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);

  if (!dev) {
    return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
  }

  run('DELETE FROM devices WHERE id = ?', [dev.id]);

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, device_id, device_nama, detail)
     VALUES (?, ?, 'Hapus Perangkat', ?, ?, ?)`,
    [req.user.id, req.user.nama, dev.id, dev.nama, `Menghapus perangkat ${dev.nama} (${dev.ip})`]
  );

  broadcast('device_deleted', { id: dev.id });

  res.json({
    success: true,
    message: `Perangkat ${dev.nama} berhasil dihapus dari pemantauan.`,
  });
});

// POST /api/devices/:id/ping — Uji ping langsung on-demand
router.post('/:id/ping', authenticateToken, requireRole(['admin', 'teknisi']), async (req, res) => {
  const dev = queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);

  if (!dev) {
    return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
  }

  const result = await probeDevice(dev, 2500);

  if (result.alive) {
    run(
      `UPDATE devices SET response_time_ms = ?, last_check = datetime('now'), last_seen_online = datetime('now'), status = 'online' WHERE id = ?`,
      [result.time, dev.id]
    );
  } else {
    run(
      `UPDATE devices SET last_check = datetime('now') WHERE id = ?`,
      [dev.id]
    );
  }

  const status = result.alive ? 'online' : 'offline';
  res.json({
    success: true,
    data: {
      id: dev.id,
      nama: dev.nama,
      ip: dev.ip,
      alive: result.alive,
      status,
      time: result.time,
      responseTime: result.time,
      statusText: result.statusText,
      method: dev.metode || 'PING',
    },
    alive: result.alive,
    status,
    time: result.time,
    responseTime: result.time,
    statusText: result.statusText,
    method: dev.metode || 'PING',
  });
});

// POST /api/devices/:id/maintenance — Aktifkan atau selesaikan Maintenance Mode
router.post('/:id/maintenance', authenticateToken, requireRole(['admin', 'teknisi']), (req, res) => {
  const dev = queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);

  if (!dev) {
    return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
  }

  const { action = 'start', reason = 'Pemeliharaan berkala', durationMinutes = 120 } = req.body;

  if (action === 'start') {
    const minutes = parseInt(durationMinutes, 10) || 120;
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    run(
      `UPDATE devices
       SET status = 'maintenance',
           maintenance_reason = ?,
           maintenance_until = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [reason.trim(), until, dev.id]
    );

    const logMsg = `${dev.nama} (${dev.ip}) masuk mode Maintenance oleh ${req.user.nama}. Alasan: ${reason}. Estimasi: ${minutes} menit.`;
    run(
      `INSERT INTO device_status_logs (device_id, device_name, device_ip, status_sebelumnya, status_baru, metode, response_time, pesan_log)
       VALUES (?, ?, ?, ?, 'Maintenance', 'Manual', '-', ?)`,
      [dev.id, dev.nama, dev.ip, dev.status, logMsg]
    );

    run(
      `INSERT INTO user_activity_logs (user_id, user_email, user_nama, aksi, ip_akses, detail)
       VALUES (?, ?, ?, 'Set Maintenance', ?, ?)`,
      [req.user.id, req.user.email, req.user.nama, req.ip, logMsg]
    );

    broadcast('maintenance_update', { id: dev.id, status: 'maintenance', reason, until });

    return res.json({
      success: true,
      message: `Perangkat ${dev.nama} beralih ke Mode Maintenance hingga ${new Date(until).toLocaleTimeString('id-ID')}.`,
      data: { status: 'maintenance', reason, until },
    });
  }

  // Selesai Maintenance
  run(
    `UPDATE devices
     SET status = 'online',
         maintenance_reason = NULL,
         maintenance_until = NULL,
         updated_at = datetime('now')
     WHERE id = ?`,
    [dev.id]
  );

  const logFinish = `Mode pemeliharaan untuk ${dev.nama} selesai oleh ${req.user.nama}. Perangkat kembali aktif dipantau.`;
  run(
    `INSERT INTO device_status_logs (device_id, device_name, device_ip, status_sebelumnya, status_baru, metode, response_time, pesan_log)
     VALUES (?, ?, ?, 'Maintenance', 'Online', 'Manual', '-', ?)`,
    [dev.id, dev.nama, dev.ip, logFinish]
  );

  broadcast('maintenance_update', { id: dev.id, status: 'online' });

  res.json({
    success: true,
    message: `Mode maintenance untuk ${dev.nama} selesai. Pemantauan normal aktif kembali.`,
  });
});

// POST /api/devices/import-csv — Impor massal perangkat dari CSV
router.post('/import-csv', authenticateToken, requireRole(['admin', 'teknisi']), (req, res) => {
  const { devices = [] } = req.body;

  if (!Array.isArray(devices) || devices.length === 0) {
    return res.status(400).json({ success: false, message: 'Data CSV kosong atau tidak valid.' });
  }

  let imported = 0;
  let skipped = 0;
  for (const d of devices) {
    if (!d.nama || !d.ip) {
      skipped++;
      continue;
    }

    try {
      const jenisClean = normalizeJenis(d.jenis);
      const metodeClean = normalizeMetode(d.metode);
      const intervalClean = Math.max(10, Math.min(3600, parseInt(d.interval_detik || d.interval || d.intervalDetik, 10) || 60));
      const portClean = d.port ? parseInt(d.port, 10) || null : (metodeClean === 'RTSP' ? 554 : metodeClean === 'ISAPI' ? 80 : null);

      run(
        `INSERT INTO devices (nama, ip, hostname, jenis, metode, port, interval_detik, grup, lokasi, deskripsi, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline')`,
        [
          String(d.nama).trim(),
          String(d.ip).trim(),
          d.hostname ? String(d.hostname).trim() : null,
          jenisClean,
          metodeClean,
          portClean,
          intervalClean,
          (d.grup && String(d.grup).trim()) || 'Umum',
          (d.lokasi && String(d.lokasi).trim()) || 'Kantor',
          d.deskripsi ? String(d.deskripsi).trim() : null,
        ]
      );
      imported++;
    } catch (err) {
      console.warn('Gagal mengimpor baris CSV:', d, err.message);
      skipped++;
    }
  }

  run(
    `INSERT INTO config_logs (user_id, user_nama, aksi, detail)
     VALUES (?, ?, 'Impor CSV', ?)`,
    [req.user.id, req.user.nama, `Mengimpor ${imported} perangkat dari berkas CSV (${skipped} dilewati)`]
  );

  broadcast('devices_updated', { action: 'import_csv', count: imported });

  res.json({
    success: true,
    message: `Berhasil mengimpor ${imported} perangkat ke dalam sistem. ${skipped > 0 ? `(${skipped} dilewati)` : ''}`,
    imported,
    skipped,
    count: imported,
  });
});

// GET /api/devices/export-csv — Unduh data perangkat dalam format CSV
router.get('/export/csv', authenticateToken, (req, res) => {
  const devices = query('SELECT * FROM devices WHERE is_active = 1');

  const headers = ['ID', 'Nama', 'IP Address', 'Hostname', 'Jenis', 'Metode', 'Interval (Detik)', 'Grup', 'Lokasi', 'Status', 'SLA Target'];
  const rows = devices.map((d) => [
    d.id,
    `"${d.nama.replace(/"/g, '""')}"`,
    d.ip,
    d.hostname || '',
    `"${d.jenis}"`,
    d.metode,
    d.interval_detik,
    `"${d.grup}"`,
    `"${d.lokasi}"`,
    d.status,
    `${d.target_sla}%`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="devwatch-devices-${Date.now()}.csv"`);
  res.send(csvContent);
});

export default router;
