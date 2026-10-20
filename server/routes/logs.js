// ================================================================
// DevWatch — routes/logs.js
// Penampil 3 tab log sistem: Status, Aktivitas, dan Konfigurasi
// ================================================================

import express from 'express';
import { query, queryOne } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/logs/devices — Mengambil daftar instansi perangkat yang pernah tercatat di log (aktif maupun terhapus)
router.get('/devices', authenticateToken, (req, res) => {
  const devices = query(`
    SELECT 
      l.device_id,
      l.device_name,
      l.device_ip,
      l.device_created_at,
      CASE WHEN d.id IS NOT NULL THEN 1 ELSE 0 END as is_active,
      MIN(l.waktu) as log_pertama,
      MAX(l.waktu) as log_terakhir,
      COUNT(l.id) as total_log
    FROM device_status_logs l
    LEFT JOIN devices d ON d.id = l.device_id
    GROUP BY l.device_name, l.device_ip, coalesce(l.device_created_at, '')
    ORDER BY is_active DESC, l.device_name ASC
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
  const data = query(
    `SELECT * FROM ${tableName} ${whereSql} ORDER BY waktu DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

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
