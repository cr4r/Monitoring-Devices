// ================================================================
// DevWatch — routes/logs.js
// Penampil 3 tab log sistem: Status, Aktivitas, dan Konfigurasi
// ================================================================

import express from 'express';
import { query, queryOne } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/logs/devices — Mengambil seluruh daftar perangkat terdaftar & arsip perangkat yang pernah tercatat di log
router.get('/devices', authenticateToken, (req, res) => {
  const devices = query(`
    SELECT 
      d.id as device_id,
      d.nama as device_name,
      d.ip as device_ip,
      d.jenis as device_jenis,
      d.grup as device_grup,
      d.created_at as device_created_at,
      1 as is_active,
      MIN(l.waktu) as log_pertama,
      MAX(l.waktu) as log_terakhir,
      COUNT(l.id) as total_log
    FROM devices d
    LEFT JOIN device_status_logs l ON l.device_id = d.id
    WHERE d.is_active = 1
    GROUP BY d.id

    UNION ALL

    SELECT 
      l.device_id,
      COALESCE(l.device_name, 'Perangkat Terhapus') as device_name,
      COALESCE(l.device_ip, '-') as device_ip,
      CASE 
        WHEN l.device_ip LIKE 'rtsp%' OR l.device_ip LIKE 'rstp%' THEN 'CCTV Hikvision'
        WHEN LOWER(l.device_name) LIKE '%cctv%' OR LOWER(l.device_name) LIKE '%cam%' THEN 'CCTV Hikvision'
        ELSE 'Arsip'
      END as device_jenis,
      'Arsip' as device_grup,
      l.device_created_at,
      0 as is_active,
      MIN(l.waktu) as log_pertama,
      MAX(l.waktu) as log_terakhir,
      COUNT(l.id) as total_log
    FROM device_status_logs l
    WHERE l.device_id IS NOT NULL AND l.device_id NOT IN (SELECT id FROM devices WHERE is_active = 1)
    GROUP BY l.device_id

    ORDER BY is_active DESC, device_name ASC
  `);
  res.json({ success: true, data: devices });
});

router.get('/', authenticateToken, (req, res) => {
  const {
    type = 'status',
    search,
    dateFrom,
    dateTo,
    page = 1,
    limit = 25,
    deviceId,
    deviceName,
    deviceIp,
    deviceCreatedAt,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
  const offset = (pageNum - 1) * limitNum;

  let tableName = 'device_status_logs';
  let searchCols = ['device_name', 'device_ip', 'pesan_log'];

  if (type === 'aktivitas') {
    tableName = 'user_activity_logs';
    searchCols = ['user_email', 'user_nama', 'aksi', 'detail'];
  } else if (type === 'konfigurasi') {
    tableName = 'config_logs';
    searchCols = ['user_nama', 'aksi', 'device_nama', 'detail'];
  }

  let whereClauses = [];
  const params = [];

  // Filter spesifik perangkat pada log status
  if (type === 'status') {
    if (deviceName && deviceName.trim()) {
      whereClauses.push('device_name = ?');
      params.push(deviceName.trim());
    }
    if (deviceIp && deviceIp.trim()) {
      whereClauses.push('device_ip = ?');
      params.push(deviceIp.trim());
    }
    if (deviceCreatedAt && deviceCreatedAt.trim()) {
      whereClauses.push('(device_created_at = ? OR device_created_at LIKE ?)');
      params.push(deviceCreatedAt.trim(), `${deviceCreatedAt.trim().slice(0, 10)}%`);
    } else if (deviceId && deviceId !== 'all') {
      whereClauses.push('device_id = ?');
      params.push(parseInt(deviceId, 10));
    }

    if (req.query.tipe && req.query.tipe !== 'all') {
      whereClauses.push('LOWER(status_baru) = ?');
      params.push(req.query.tipe.toLowerCase().trim());
    }
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const searchCondition = searchCols.map((c) => `${c} LIKE ?`).join(' OR ');
    whereClauses.push(`(${searchCondition})`);
    searchCols.forEach(() => params.push(term));
  }

  if (dateFrom) {
    whereClauses.push(`waktu >= ?`);
    params.push(`${dateFrom} 00:00:00`);
  }

  if (dateTo) {
    whereClauses.push(`waktu <= ?`);
    params.push(`${dateTo} 23:59:59`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Hitung total baris
  const countRow = queryOne(
    `SELECT count(*) as total FROM ${tableName} ${whereSql}`,
    params
  );
  const total = countRow ? countRow.total : 0;

  // Ambil data halaman aktif
  let data;
  if (type === 'status') {
    const rows = query(
      `SELECT * FROM ${tableName} ${whereSql} ORDER BY waktu DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    const activeDevices = query('SELECT id, jenis FROM devices');
    const devJenisMap = new Map(activeDevices.map((d) => [d.id, d.jenis]));
    data = rows.map((r) => {
      let j = devJenisMap.get(r.device_id);
      if (!j) {
        const ipLow = (r.device_ip || '').toLowerCase();
        const nameLow = (r.device_name || '').toLowerCase();
        if (ipLow.startsWith('rtsp') || ipLow.startsWith('rstp') || nameLow.includes('cctv') || nameLow.includes('cam')) {
          j = 'CCTV Hikvision';
        } else if (nameLow.includes('router') || nameLow.includes('gateway')) {
          j = 'Router';
        } else if (nameLow.includes('switch') || nameLow.includes('hub')) {
          j = 'Switch';
        } else if (nameLow.includes('server')) {
          j = 'Server';
        } else if (nameLow.includes('access point') || nameLow.includes('wifi') || nameLow.includes('ap')) {
          j = 'Access Point';
        } else {
          j = 'Komputer';
        }
      }
      return { ...r, jenis: j };
    });
  } else {
    data = query(
      `SELECT * FROM ${tableName} ${whereSql} ORDER BY waktu DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
  }

  // Hitung jumlah baris per kategori tab untuk badge
  const statusCount = queryOne('SELECT count(*) as c FROM device_status_logs')?.c || 0;
  const aktivitasCount = queryOne('SELECT count(*) as c FROM user_activity_logs')?.c || 0;
  const konfigurasiCount = queryOne('SELECT count(*) as c FROM config_logs')?.c || 0;

  res.json({
    success: true,
    data,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    counts: {
      status: statusCount,
      aktivitas: aktivitasCount,
      konfigurasi: konfigurasiCount,
    },
  });
});

export default router;
