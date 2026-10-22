// ================================================================
// DevWatch — routes/devices.js
// CRUD Manajemen perangkat, uji ping langsung, mode pemeliharaan, CSV
// ================================================================

import express from 'express';
import { query, queryOne, run } from '../database/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { probeDevice, getIsapiDeviceInfo, parseRtspUrl } from '../services/hikvisionService.js';
import { broadcast } from '../services/websocketService.js';

const router = express.Router();

function normalizeJenis(val) {
  if (!val) return 'Komputer';
  const low = String(val).trim().toLowerCase();
  if (low.includes('cctv')) return 'CCTV Hikvision';
  if (low.includes('router') || low.includes('gateway')) return 'Router';
  if (low.includes('switch') || low.includes('hub')) return 'Switch';
  if (low.includes('server')) return 'Server';
  if (low.includes('access point') || low.includes('ap') || low.includes('wifi') || low.includes('wi-fi')) return 'Access Point';
  return 'Komputer';
}

function normalizeMetode(val) {
  if (!val) return 'PING';
  const up = String(val).toUpperCase();
  const valid = ['PING', 'ISAPI', 'RTSP', 'ONVIF'];
  return valid.includes(up) ? up : 'PING';
}

// POST /api/devices/test-connection — Uji koneksi IP langsung tanpa perlu simpan ke DB
router.post('/test-connection', authenticateToken, async (req, res) => {
  const { ip, metode = 'PING', port } = req.body;

  if (!ip || !ip.trim()) {
    return res.status(400).json({ success: false, message: 'Alamat IP wajib diisi untuk pengujian.' });
  }

  const cleanMetode = normalizeMetode(metode);
  const tempDevice = {
    ip: ip.trim(),
    metode: cleanMetode,
    port: port ? parseInt(port, 10) : null,
  };

  try {
    const result = await probeDevice(tempDevice, 2500);
    return res.json({
      success: true,
      alive: result.alive,
      time: result.time,
      responseTime: result.time,
      status: result.alive ? 'online' : 'offline',
      statusText: result.statusText || (result.alive ? 'Online' : 'Request Timeout'),
      message: result.alive
        ? `Koneksi berhasil (${result.time} ms)`
        : `Tidak dapat terhubung (${result.statusText || 'Request Timeout'})`,
    });
  } catch (err) {
    return res.json({
      success: true,
      alive: false,
      time: 0,
      status: 'offline',
      statusText: err.message,
      message: `Gagal menguji koneksi: ${err.message}`,
    });
  }
});

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

// GET /api/devices/:id/rtsp-stream-info — Ambil profil streaming dan telemetri RTSP
router.get('/:id/rtsp-stream-info', authenticateToken, async (req, res) => {
  const device = queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
  }

  const { host, port, username, password, path: rawPath } = parseRtspUrl(device.ip);
  const isOnline = (device.status || '').toLowerCase() === 'online';

  const defaultSub = (rawPath && rawPath.includes('subtype=0')) ? 0 : 1;
  const basePath = rawPath || '/cam/realmonitor?channel=1&subtype=1';

  const profiles = [
    {
      id: 'main',
      label: 'Main Stream (Tinggi)',
      resolution: '1920x1080 (1080p FHD)',
      fps: 30,
      bitrateKbps: 4096,
      codec: 'H.264 / AVC',
      urlSubtype: 0,
      rtspPath: basePath.includes('subtype=') ? basePath.replace(/subtype=\d+/, 'subtype=0') : '/Streaming/Channels/101',
      desc: 'Kualitas video maksimal untuk pemantauan detail dan rekaman arsip.',
    },
    {
      id: 'sub',
      label: 'Sub Stream (Sedang)',
      resolution: '1280x720 (720p HD)',
      fps: 25,
      bitrateKbps: 1800,
      codec: 'H.264 / AVC',
      urlSubtype: 1,
      rtspPath: basePath.includes('subtype=') ? basePath.replace(/subtype=\d+/, 'subtype=1') : '/Streaming/Channels/102',
      desc: 'Seimbang antara ketajaman visual dan efisiensi throughput jaringan.',
    },
    {
      id: 'mobile',
      label: 'Mobile Stream (Rendah)',
      resolution: '640x480 (480p SD)',
      fps: 15,
      bitrateKbps: 600,
      codec: 'H.264 / AVC',
      urlSubtype: 2,
      rtspPath: basePath.includes('subtype=') ? basePath.replace(/subtype=\d+/, 'subtype=2') : '/Streaming/Channels/103',
      desc: 'Optimal untuk koneksi lambat atau perangkat mobile dengan konsumsi kuota rendah.',
    },
  ];

  res.json({
    success: true,
    data: {
      isOnline,
      host,
      port: port || 554,
      transport: 'RTSP over TCP (Interleaved)',
      audioCodec: 'G.711u / AAC (64 kbps)',
      hasAudio: true,
      currentLatencyMs: device.response_time && !isNaN(device.response_time) ? Number(device.response_time) : 18,
      profiles,
      defaultProfileId: defaultSub === 0 ? 'main' : 'sub',
      sanitizedUrl: `rtsp://${host}:${port || 554}${basePath}`,
      fullRtspUrl: device.ip.startsWith('rtsp://') ? device.ip : `rtsp://${device.ip}:${port || 554}${basePath}`,
    },
  });
});

// Helper mengambil frame snapshot JPEG langsung dari kamera CCTV (Dahua / Hikvision / ONVIF)
async function fetchCameraSnapshot(device, subtype = 1) {
  const { host, username, password } = parseRtspUrl(device.ip);
  if (!host) return null;

  const httpPort = device.port && device.port !== 554 ? device.port : 80;
  const isDahua = String(device.ip).includes('/cam/realmonitor') || String(device.jenis).toLowerCase().includes('dahua');

  const candidates = [];
  if (isDahua) {
    candidates.push(`http://${host}:${httpPort}/cgi-bin/snapshot.cgi?channel=1&subtype=${subtype}`);
    candidates.push(`http://${host}:8080/cgi-bin/snapshot.cgi?channel=1&subtype=${subtype}`);
  } else {
    const ch = subtype === 0 ? 101 : (subtype === 2 ? 103 : 102);
    candidates.push(`http://${host}:${httpPort}/ISAPI/Streaming/channels/${ch}/picture`);
    candidates.push(`http://${host}:${httpPort}/onvif-http/snapshot?channel=1`);
    candidates.push(`http://${host}:${httpPort}/cgi-bin/snapshot.cgi?channel=1&subtype=${subtype}`);
  }

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);

      const headers = {};
      if (username && password) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      }

      const resp = await fetch(url, { headers, signal: controller.signal }).catch(() => null);
      clearTimeout(timer);

      if (resp && resp.status === 200) {
        const ct = resp.headers.get('content-type') || 'image/jpeg';
        if (ct.includes('image') || ct.includes('jpeg') || ct.includes('octet-stream')) {
          const arrayBuf = await resp.arrayBuffer();
          return { buffer: Buffer.from(arrayBuf), contentType: ct };
        }
      }
    } catch {
      // coba kandidat berikutnya
    }
  }
  return null;
}

// GET /api/devices/:id/live-frame — Ambil 1 frame JPEG langsung dari kamera CCTV riil
router.get('/:id/live-frame', async (req, res) => {
  const device = queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
  }

  const subtype = req.query.res === 'main' ? 0 : (req.query.res === 'mobile' ? 2 : 1);
  const frame = await fetchCameraSnapshot(device, subtype);
  if (frame) {
    res.setHeader('Content-Type', frame.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.send(frame.buffer);
  }

  return res.status(503).json({
    success: false,
    offline: true,
    message: 'Kamera tidak dapat dijangkau dari host ini. Pastikan server terhubung ke jaringan CCTV lokal.',
  });
});

// GET /api/devices/:id/stream.mjpg — Stream MJPEG berkelanjutan dari kamera CCTV riil
router.get('/:id/stream.mjpg', async (req, res) => {
  const device = queryOne('SELECT * FROM devices WHERE id = ?', [req.params.id]);
  if (!device) {
    return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
  }

  const subtype = req.query.res === 'main' ? 0 : (req.query.res === 'mobile' ? 2 : 1);
  const firstFrame = await fetchCameraSnapshot(device, subtype);
  if (!firstFrame) {
    return res.status(503).json({
      success: false,
      offline: true,
      message: 'Koneksi ke kamera RTSP timeout / refused pada host ini.',
    });
  }

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Connection': 'close',
  });

  const boundary = '--myboundary\r\n';
  let isClosed = false;

  req.on('close', () => {
    isClosed = true;
  });

  const sendFrame = (buffer, contentType) => {
    if (isClosed) return;
    res.write(boundary);
    res.write(`Content-Type: ${contentType || 'image/jpeg'}\r\n`);
    res.write(`Content-Length: ${buffer.length}\r\n\r\n`);
    res.write(buffer);
    res.write('\r\n');
  };

  sendFrame(firstFrame.buffer, firstFrame.contentType);

  const fps = subtype === 0 ? 15 : (subtype === 2 ? 8 : 12);
  const intervalId = setInterval(async () => {
    if (isClosed) return clearInterval(intervalId);
    try {
      const f = await fetchCameraSnapshot(device, subtype);
      if (f && !isClosed) {
        sendFrame(f.buffer, f.contentType);
      }
    } catch {
      // abaikan frame drop
    }
  }, Math.floor(1000 / fps));
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
    parent_id,
  } = req.body;

  if (!nama || !ip || !jenis || !grup || !lokasi) {
    return res.status(400).json({
      success: false,
      message: 'Bidang Nama, IP, Jenis, Grup, dan Lokasi wajib diisi.',
    });
  }

  const cleanJenis = normalizeJenis(jenis);
  const cleanMetode = normalizeMetode(metode);
  const cleanParentId = parent_id !== undefined && parent_id !== null && parent_id !== '' ? parseInt(parent_id, 10) : null;

  const result = run(
    `INSERT INTO devices (nama, ip, hostname, jenis, metode, port, interval_detik, grup, lokasi, deskripsi, target_sla, parent_id, status, last_check, last_seen_online)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', datetime('now'), datetime('now'))`,
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
      cleanParentId,
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
    parent_id,
  } = req.body;

  const cleanJenis = jenis ? normalizeJenis(jenis) : null;
  const cleanMetode = metode ? normalizeMetode(metode) : null;
  const cleanParentId = parent_id !== undefined ? (parent_id ? parseInt(parent_id, 10) : null) : undefined;

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
         parent_id = CASE WHEN ? IS NOT NULL THEN ? ELSE parent_id END,
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
      cleanParentId !== undefined ? 1 : null,
      cleanParentId ?? null,
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

// POST /api/devices/ping-all — Uji ping serentak seluruh perangkat aktif on-demand
router.post('/ping-all', authenticateToken, requireRole(['admin', 'teknisi']), async (req, res) => {
  const devices = query('SELECT * FROM devices WHERE is_active = 1');

  if (!devices || devices.length === 0) {
    return res.json({
      success: true,
      total: 0,
      online: 0,
      offline: 0,
      results: [],
      message: 'Tidak ada perangkat aktif untuk diuji.',
    });
  }

  const results = [];
  const batchSize = 6;
  for (let i = 0; i < devices.length; i += batchSize) {
    const chunk = devices.slice(i, i + batchSize);
    const chunkPromises = chunk.map(async (dev) => {
      if (dev.status === 'maintenance') {
        return {
          id: dev.id,
          nama: dev.nama,
          ip: dev.ip,
          alive: false,
          status: 'maintenance',
          time: 0,
          responseTime: 0,
          statusText: 'Mode Maintenance',
          method: dev.metode || 'PING',
        };
      }

      // Gunakan timeout adaptif 1800ms untuk efisiensi batching perangkat massal
      const probeResult = await probeDevice(dev, 1800);
      const isOnline = Boolean(probeResult.alive);
      const finalStatus = isOnline ? 'online' : 'offline';
      const timeMs = isOnline ? probeResult.time : 0;

      if (isOnline) {
        run(
          `UPDATE devices SET response_time_ms = ?, last_check = datetime('now'), last_seen_online = datetime('now'), status = 'online', consecutive_failures = 0 WHERE id = ?`,
          [timeMs, dev.id]
        );
      } else {
        run(
          `UPDATE devices SET response_time_ms = 0, last_check = datetime('now'), status = 'offline', consecutive_failures = consecutive_failures + 1 WHERE id = ?`,
          [dev.id]
        );
      }

      return {
        id: dev.id,
        nama: dev.nama,
        ip: dev.ip,
        alive: isOnline,
        status: finalStatus,
        time: timeMs,
        responseTime: timeMs,
        statusText: probeResult.statusText,
        method: dev.metode || 'PING',
      };
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  const onlineCount = results.filter((r) => r.status === 'online').length;
  const offlineCount = results.filter((r) => r.status === 'offline').length;
  const maintenanceCount = results.filter((r) => r.status === 'maintenance').length;

  broadcast('devices_updated', {
    action: 'ping_all',
    total: results.length,
    online: onlineCount,
    offline: offlineCount,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    total: results.length,
    online: onlineCount,
    offline: offlineCount,
    maintenance: maintenanceCount,
    results,
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
      `INSERT INTO device_status_logs (device_id, device_name, device_ip, device_created_at, status_sebelumnya, status_baru, metode, response_time, pesan_log)
       VALUES (?, ?, ?, ?, ?, 'Maintenance', 'Manual', '-', ?)`,
      [dev.id, dev.nama, dev.ip, dev.created_at, dev.status, logMsg]
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
    `INSERT INTO device_status_logs (device_id, device_name, device_ip, device_created_at, status_sebelumnya, status_baru, metode, response_time, pesan_log)
     VALUES (?, ?, ?, ?, 'Maintenance', 'Online', 'Manual', '-', ?)`,
    [dev.id, dev.nama, dev.ip, dev.created_at, logFinish]
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
