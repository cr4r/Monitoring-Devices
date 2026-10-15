// ================================================================
// DevWatch — routes/reports.js
// Laporan mingguan otomatis, SLA tracker, riwayat insiden, dan arsip
// ================================================================

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getWeeklyReport,
  getSlaReport,
  getIncidentReport,
  saveWeeklySnapshot,
  getWeeklyArchives,
} from '../services/reportService.js';

const router = express.Router();

// GET /api/reports/weekly — Ambil laporan mingguan (terbaru atau berdasarkan ID arsip)
router.get('/weekly', authenticateToken, (req, res) => {
  const { id } = req.query;
  const report = getWeeklyReport(id ? parseInt(id, 10) : null);
  res.json({ success: true, data: report });
});

// GET /api/reports/weekly/archives — Ambil daftar riwayat arsip laporan mingguan
router.get('/weekly/archives', authenticateToken, (req, res) => {
  const archives = getWeeklyArchives();
  res.json({ success: true, data: archives });
});

// POST /api/reports/weekly/snapshot — Simpan / perbarui snapshot laporan mingguan ke basis data
router.post('/weekly/snapshot', authenticateToken, (req, res) => {
  const result = saveWeeklySnapshot();
  res.json({ success: true, message: 'Snapshot laporan mingguan berhasil disimpan ke database.', data: result });
});

// GET /api/reports/sla — Laporan Uptime & SLA Tracker
router.get('/sla', authenticateToken, (req, res) => {
  const report = getSlaReport();
  res.json({ success: true, data: report });
});

// GET /api/reports/incidents — Laporan seluruh riwayat insiden
router.get('/incidents', authenticateToken, (req, res) => {
  const report = getIncidentReport();
  res.json({ success: true, data: report });
});

export default router;
