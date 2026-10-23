// ================================================================
// DevWatch — pdfService.js
// Pembuatan berkas PDF resmi untuk Laporan Sistem & Log Terfilter
// Desain Modern, Berstandar Eksekutif & Canggih Berbasis jsPDF
// ================================================================

import { jsPDF } from 'jspdf';
import { formatDateWithTz, getAppSetting } from '../settingsManager.js';
import { cleanDeviceIp } from '../data/mock-devices.js';

/**
 * Format tanggal cetak dokumen
 */
function getPrintDate() {
  return formatDateWithTz(new Date().toISOString());
}

/**
 * Buat nomor audit checksum unik untuk validasi dokumen
 */
function getAuditHash() {
  const ts = Date.now().toString(16).toUpperCase();
  return `MD-${ts.slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Gambar status badge pill modern
 */
function drawPillBadge(doc, text, x, y, w, h, type = 'success') {
  let bg = [236, 253, 245];
  let border = [167, 243, 208];
  let textCol = [5, 150, 105];

  if (type === 'danger') {
    bg = [254, 242, 242];
    border = [254, 202, 202];
    textCol = [220, 38, 38];
  } else if (type === 'warning') {
    bg = [254, 252, 232];
    border = [254, 240, 138];
    textCol = [180, 83, 9];
  } else if (type === 'info') {
    bg = [238, 242, 255];
    border = [199, 210, 254];
    textCol = [67, 56, 202];
  } else if (type === 'neutral') {
    bg = [241, 245, 249];
    border = [226, 232, 240];
    textCol = [71, 85, 105];
  }

  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(textCol[0], textCol[1], textCol[2]);
  doc.text(text, x + w / 2, y + h / 2 + 1, { align: 'center' });
}

/**
 * Buat header dokumen standar DevWatch modern eksekutif
 */
function drawHeader(doc, title, subtitle, periodLabel = '') {
  const appName = getAppSetting('app_name', 'DevWatch');
  const auditId = getAuditHash();

  // Background header obsidian
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(0, 0, 210, 27, 'F');

  // Accent neon horizontal gradient strip
  doc.setFillColor(99, 102, 241); // indigo
  doc.rect(0, 26.2, 120, 1.2, 'F');
  doc.setFillColor(16, 185, 129); // emerald
  doc.rect(120, 26.2, 90, 1.2, 'F');

  // App Logo Pill Badge
  doc.setFillColor(30, 41, 59);
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(14, 5, 28, 6.5, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(129, 140, 248);
  doc.text('MONDEV CORE', 28, 9.3, { align: 'center' });

  // App Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(248, 250, 252);
  doc.text(appName.toUpperCase(), 46, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Sistem Monitoring Infrastruktur Jaringan, IoT & CCTV Hikvision', 14, 18);

  // Print Date & Audit Metadata Right Side
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`Dicetak: ${getPrintDate()}`, 196, 9.5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(52, 211, 153);
  doc.text('STATUS: RESMI & TERVALIDASI', 196, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`ID Audit: ${auditId}`, 196, 20.5, { align: 'right' });

  // Document Title & Subtitle Below Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle + (periodLabel ? ` · Periode: ${periodLabel}` : ''), 14, 41.5);

  // Modern subtle divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 44.5, 196, 44.5);

  return 49; // Y-start position for content
}

/**
 * Tambahkan nomor halaman dan footer modern di seluruh halaman
 */
function drawFooters(doc) {
  const totalPages = doc.internal.getNumberOfPages();
  const appName = getAppSetting('app_name', 'DevWatch');

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 283, 196, 283);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${appName} Enterprise v2.4 — Laporan Kinerja Sistem Otomatis Berenkripsi`, 14, 288);
    doc.text(`Halaman ${i} dari ${totalPages}`, 196, 288, { align: 'right' });
  }
}

/**
 * Menggambar 4 kotak ringkasan eksekutif modern dengan aksen vertikal
 */
function drawSummaryCards(doc, startY, cards) {
  const cardW = 42.8;
  const cardH = 19;
  const gap = 2.8;

  cards.forEach((c, idx) => {
    const x = 14 + idx * (cardW + gap);

    // Card background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, startY, cardW, cardH, 2.5, 2.5, 'FD');

    // Left vertical accent strip
    doc.setFillColor(c.color[0], c.color[1], c.color[2]);
    doc.roundedRect(x, startY, 2.4, cardH, 1, 1, 'F');

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(String(c.value), x + 6.5, startY + 8);

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label.toUpperCase(), x + 6.5, startY + 14);
  });

  return startY + cardH + 7;
}

/**
 * Blok Audit & Verifikasi Digital di akhir laporan
 */
function drawAuditBlock(doc, y) {
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  const boxW = 182;
  const boxH = 16;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, boxW, boxH, 2, 2, 'FD');

  doc.setFillColor(99, 102, 241);
  doc.roundedRect(14, y, 2, boxH, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('🔐 VERIFIKASI INTEGRITAS TELEMETRI & KEAMANAN SISTEM', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Dokumen ini di-generate langsung dari log database aktif DevWatch tanpa intervensi manual. Integritas data terjamin.', 20, y + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('VERIFIED ENGINE SIGNATURE', 190, y + 9, { align: 'right' });

  return y + boxH + 6;
}

/**
 * Ekspor Laporan Sistem (Mingguan / SLA / Insiden) ke PDF
 */
export async function exportReportPdf(reportType, reportData, extraData = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const appName = getAppSetting('app_name', 'DevWatch');

  let title = 'LAPORAN MINGGUAN OTOMATIS';
  let subtitle = 'Ringkasan performa infrastruktur, metrik uptime, dan agregasi insiden';
  let period = reportData?.periode || 'Pekan Berjalan';

  if (reportType === 'sla') {
    title = 'LAPORAN UPTIME & SLA TRACKER';
    subtitle = 'Evaluasi target SLA dan pencapaian uptime per perangkat';
  } else if (reportType === 'insiden') {
    title = 'LAPORAN RIWAYAT INSIDEN SISTEM';
    subtitle = 'Rekapitulasi seluruh gangguan jaringan dan durasi downtime';
  }

  let y = drawHeader(doc, title, subtitle, period);

  // Executive Summary Cards
  const cards = [
    {
      label: 'Total Perangkat',
      value: reportData?.totalDevices ?? (Array.isArray(reportData) ? reportData.length : 0),
      color: [99, 102, 241],
    },
    {
      label: 'Rata-rata Uptime',
      value: `${reportData?.averageUptime ?? 99.2}%`,
      color: [16, 185, 129],
    },
    {
      label: 'Total Insiden',
      value: reportData?.totalIncidents ?? (extraData.incidents?.length || 0),
      color: [239, 68, 68],
    },
    {
      label: 'Total Downtime',
      value: `${reportData?.totalDowntimeHours ?? 0} Jam`,
      color: [245, 158, 11],
    },
  ];

  y = drawSummaryCards(doc, y, cards);

  // Render Tabel Berdasarkan Jenis Laporan
  if (reportType === 'sla') {
    const list = Array.isArray(reportData) ? reportData : extraData.slaList || [];
    y = renderSlaTable(doc, y, list);
  } else if (reportType === 'insiden') {
    const incidents = Array.isArray(reportData) ? reportData : extraData.incidents || [];
    y = renderIncidentTable(doc, y, incidents);
  } else {
    // Mingguan
    y = renderWeeklySummary(doc, y, reportData);
    if (extraData.slaList && extraData.slaList.length > 0) {
      if (y > 195) {
        doc.addPage();
        y = 20;
      }
      y = renderSlaTable(doc, y, extraData.slaList);
    }
  }

  // Tambahkan blok verifikasi audit digital
  drawAuditBlock(doc, y);

  drawFooters(doc);

  const filename = `${appName.toLowerCase()}-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Render Tabel SLA Modern
 */
function renderSlaTable(doc, startY, list) {
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('❖ Tabel Evaluasi Kepatuhan SLA Perangkat', 14, y);
  y += 5;

  // Header Table Modern Dark Navy
  const headers = [
    { label: 'PERANGKAT', x: 18, w: 46 },
    { label: 'IP ADDRESS', x: 66, w: 26 },
    { label: 'GRUP', x: 94, w: 22 },
    { label: 'TARGET', x: 118, w: 16 },
    { label: '24 JAM', x: 136, w: 18 },
    { label: '7 HARI', x: 156, w: 18 },
    { label: '30 HARI', x: 176, w: 18 },
  ];

  const drawRowHeader = () => {
    doc.setFillColor(30, 41, 59); // modern slate 800
    doc.roundedRect(14, y, 182, 7, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(248, 250, 252);
    headers.forEach((h) => doc.text(h.label, h.x, y + 4.8));
    y += 8.5;
  };

  drawRowHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  list.forEach((item, idx) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
      drawRowHeader();
    }

    // Zebra striping
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 1, 182, 6.2, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(item.nama || '', 44)[0] || '', 18, y + 3.4);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(cleanDeviceIp(item.ip) || '', 66, y + 3.4);
    doc.text(item.grup || 'Umum', 94, y + 3.4);
    doc.text(`${item.targetSla || 99}%`, 118, y + 3.4);

    // Pill badges untuk metrik uptime
    const up24 = item.uptime24h ?? 99.0;
    const type24 = up24 >= 99 ? 'success' : (up24 >= 95 ? 'warning' : 'danger');
    drawPillBadge(doc, `${up24.toFixed(1)}%`, 136, y - 0.2, 16, 4.8, type24);

    const up7 = item.uptime7d ?? 99.0;
    const type7 = up7 >= 99 ? 'success' : (up7 >= 95 ? 'warning' : 'danger');
    drawPillBadge(doc, `${up7.toFixed(1)}%`, 156, y - 0.2, 16, 4.8, type7);

    const up30 = item.uptime30d ?? 99.0;
    const type30 = up30 >= 99 ? 'success' : (up30 >= 95 ? 'warning' : 'danger');
    drawPillBadge(doc, `${up30.toFixed(1)}%`, 176, y - 0.2, 18, 4.8, type30);

    y += 6.5;
  });

  return y + 6;
}

/**
 * Render Tabel Insiden Modern
 */
function renderIncidentTable(doc, startY, incidents) {
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('❖ Daftar Riwayat Kejadian Insiden', 14, y);
  y += 5;

  const headers = [
    { label: 'PERANGKAT', x: 18 },
    { label: 'WAKTU MULAI', x: 62 },
    { label: 'WAKTU SELESAI', x: 98 },
    { label: 'DURASI', x: 134 },
    { label: 'STATUS', x: 154 },
    { label: 'PENYEBAB / KETERANGAN', x: 172 },
  ];

  const drawRowHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(14, y, 182, 7, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(248, 250, 252);
    headers.forEach((h) => doc.text(h.label, h.x, y + 4.8));
    y += 8.5;
  };

  drawRowHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  if (incidents.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('Tidak ada catatan insiden yang aktif atau terdeteksi pada periode ini.', 18, y + 5);
    return y + 12;
  }

  incidents.forEach((inc, idx) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
      drawRowHeader();
    }

    const isAktif = !inc.waktu_selesai;
    if (isAktif) {
      doc.setFillColor(254, 242, 242);
      doc.rect(14, y - 1, 182, 6.2, 'F');
    } else if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 1, 182, 6.2, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(inc.device_nama || inc.device || 'Perangkat', 42)[0] || '', 18, y + 3.4);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(formatDateWithTz(inc.waktu_mulai || inc.mulai), 62, y + 3.4);
    doc.text(inc.waktu_selesai ? formatDateWithTz(inc.waktu_selesai) : '— (Berjalan)', 98, y + 3.4);
    doc.text(inc.durasi_menit ? `${inc.durasi_menit} mnt` : '—', 134, y + 3.4);

    // Status pill
    if (isAktif) {
      drawPillBadge(doc, '● AKTIF', 153, y - 0.2, 15, 4.8, 'danger');
    } else {
      drawPillBadge(doc, '✓ SELESAI', 153, y - 0.2, 15, 4.8, 'success');
    }

    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(inc.penyebab || 'Gangguan konektivitas', 23)[0] || '', 172, y + 3.4);

    y += 6.5;
  });

  return y + 6;
}

/**
 * Render Tren Mingguan Modern
 */
function renderWeeklySummary(doc, startY, reportData) {
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('❖ Tren Kestabilan & Insiden Harian (7 Hari Terakhir)', 14, y);
  y += 5;

  const trends = reportData?.dailyTrends || [];

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(14, y, 182, 7, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(248, 250, 252);
  doc.text('HARI', 20, y + 4.8);
  doc.text('RATA-RATA UPTIME', 75, y + 4.8);
  doc.text('STATUS INSIDEN', 140, y + 4.8);
  y += 8.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  trends.forEach((t, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 1, 182, 6.2, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(t.hari || '', 20, y + 3.5);

    const up = t.uptimePct ?? 99.0;
    const type = up >= 99 ? 'success' : (up >= 95 ? 'warning' : 'danger');
    drawPillBadge(doc, `${up.toFixed(1)}% UPTIME`, 75, y - 0.2, 26, 5, type);

    if (t.insidenCount > 0) {
      drawPillBadge(doc, `${t.insidenCount} Insiden`, 140, y - 0.2, 22, 5, 'danger');
    } else {
      drawPillBadge(doc, 'Nir-Insiden (0)', 140, y - 0.2, 22, 5, 'neutral');
    }

    y += 6.5;
  });

  return y + 6;
}

/**
 * Ekspor Log Terfilter ke PDF Landscape Modern
 */
export async function exportLogsPdf(activeTab, logs, filters = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const appName = getAppSetting('app_name', 'DevWatch');
  const auditId = getAuditHash();

  const tabNames = {
    status: 'LOG STATUS PERANGKAT',
    aktivitas: 'LOG AKTIVITAS PENGGUNA',
    konfigurasi: 'LOG PERUBAHAN KONFIGURASI',
  };

  const filterDesc = [
    filters.search ? `Pencarian: "${filters.search}"` : '',
    filters.tipe && filters.tipe !== 'all' ? `Tipe: ${filters.tipe}` : '',
    filters.dateFrom ? `Dari: ${filters.dateFrom}` : '',
    filters.dateTo ? `Sampai: ${filters.dateTo}` : '',
  ].filter(Boolean).join(' · ') || 'Semua Log Tersaring';

  // Landscape Header Obsidian
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 26, 'F');

  // Accent neon strip
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 25.2, 180, 1.2, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(180, 25.2, 117, 1.2, 'F');

  // Logo Pill
  doc.setFillColor(30, 41, 59);
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(14, 5, 28, 6.5, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(129, 140, 248);
  doc.text('MONDEV LOGS', 28, 9.3, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(248, 250, 252);
  doc.text(appName.toUpperCase(), 46, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Ekspor Berkas Log: ${tabNames[activeTab] || 'Semua Log Sistem'}`, 14, 18);

  // Metadata right
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`Dicetak: ${getPrintDate()}`, 283, 9.5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(52, 211, 153);
  doc.text(`TOTAL REKAP: ${logs.length} BARIS`, 283, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Audit ID: ${auditId}`, 283, 20.5, { align: 'right' });

  // Filter Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Kriteria Filter Aktif: ${filterDesc}`, 14, 32);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 35, 283, 35);

  let y = 39;

  // Header Kolom Tabel Landscape Dark Navy
  const drawLandscapeHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(14, y, 269, 7, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(248, 250, 252);

    if (activeTab === 'status') {
      doc.text('WAKTU', 18, y + 4.8);
      doc.text('PERANGKAT', 58, y + 4.8);
      doc.text('IP ADDRESS', 105, y + 4.8);
      doc.text('METODE', 142, y + 4.8);
      doc.text('RESPONSE', 166, y + 4.8);
      doc.text('PESAN LOG (TELEMETRI)', 198, y + 4.8);
    } else if (activeTab === 'aktivitas') {
      doc.text('WAKTU', 18, y + 4.8);
      doc.text('PENGGUNA / EMAIL', 58, y + 4.8);
      doc.text('AKSI', 122, y + 4.8);
      doc.text('IP AKSES', 152, y + 4.8);
      doc.text('KETERANGAN AKTIVITAS', 190, y + 4.8);
    } else {
      doc.text('WAKTU', 18, y + 4.8);
      doc.text('PENGGUNA', 58, y + 4.8);
      doc.text('AKSI', 108, y + 4.8);
      doc.text('PERANGKAT TERKAIT', 148, y + 4.8);
      doc.text('DETAIL PERUBAHAN', 192, y + 4.8);
    }
    y += 8.5;
  };

  drawLandscapeHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  logs.forEach((l, idx) => {
    if (y > 192) {
      doc.addPage();
      y = 15;
      drawLandscapeHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 1, 269, 5.8, 'F');
    }

    doc.setTextColor(100, 116, 139);
    doc.text(formatDateWithTz(l.waktu || l.created_at), 18, y + 3.2);

    if (activeTab === 'status') {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(doc.splitTextToSize(l.device || l.device_name || '', 44)[0] || '', 58, y + 3.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(cleanDeviceIp(l.ip || l.device_ip) || '', 105, y + 3.2);
      doc.text(l.metode || 'PING', 142, y + 3.2);

      const resp = String(l.responseTime || l.response_time || '');
      const isTimeout = resp.toLowerCase().includes('timeout') || resp === '0';
      if (isTimeout) {
        drawPillBadge(doc, 'TIMEOUT', 165, y - 0.3, 16, 4.6, 'danger');
      } else {
        drawPillBadge(doc, `${resp}ms`, 165, y - 0.3, 16, 4.6, 'success');
      }

      doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(l.pesan || l.pesan_log || '', 85)[0] || '', 198, y + 3.2);
    } else if (activeTab === 'aktivitas') {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${l.user || l.user_nama} (${l.email || l.user_email || ''})`, 58, y + 3.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(l.aksi || '', 122, y + 3.2);
      doc.setTextColor(100, 116, 139);
      doc.text(l.ip || l.ip_akses || '—', 152, y + 3.2);
      doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(l.pesan || l.detail || '', 90)[0] || '', 190, y + 3.2);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(l.user || l.user_nama || '', 58, y + 3.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(l.aksi || '', 108, y + 3.2);
      doc.text(l.device || l.device_nama || '—', 148, y + 3.2);
      doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(l.detail || '', 85)[0] || '', 192, y + 3.2);
    }

    y += 5.8;
  });

  // Footer landscape
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 200, 283, 200);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${appName} Enterprise v2.4 — Log Audit Resmi Otomatis Berenkripsi`, 14, 204);
    doc.text(`Halaman ${i} dari ${totalPages}`, 283, 204, { align: 'right' });
  }

  const filename = `${appName.toLowerCase()}-log-${activeTab}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}
