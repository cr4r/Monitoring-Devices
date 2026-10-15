// ================================================================
// DevWatch — routes/reports.js
// Laporan mingguan otomatis, SLA tracker, dan riwayat insiden
// ================================================================

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getWeeklyReport, getSlaReport, getIncidentReport } from '../services/reportService.js';

const router = express.Router();

router.get('/weekly', authenticateToken, (req, res) => {
  const report = getWeeklyReport();
  res.json({ success: true, data: report });
});

router.get('/sla', authenticateToken, (req, res) => {
  const report = getSlaReport();
  res.json({ success: true, data: report });
});

router.get('/incidents', authenticateToken, (req, res) => {
  const report = getIncidentReport();
  res.json({ success: true, data: report });
});

export default router;
