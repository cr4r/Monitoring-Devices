// ================================================================
// DevWatch — routes/logs.js
// Penampil 3 tab log sistem: Status, Aktivitas, dan Konfigurasi
// ================================================================

import express from 'express';
import { query, queryOne } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const {
    type = 'status',
    search,
    dateFrom,
    dateTo,
    page = 1,
    limit = 25,
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
