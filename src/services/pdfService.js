// ================================================================
// DevWatch — pdfService.js
// Pembuatan berkas PDF resmi untuk Laporan Sistem & Log Terfilter
// Memanfaatkan pustaka jsPDF
// ================================================================

import { jsPDF } from 'jspdf';
import { formatDateWithTz, getAppSetting } from '../settingsManager.js';

/**
 * Format tanggal cetak dokumen
 */
function getPrintDate() {
  return formatDateWithTz(new Date().toISOString());
}

/**
 * Buat header dokumen standar DevWatch
 */
function drawHeader(doc, title, subtitle, periodLabel = '') {
  const appName = getAppSetting('app_name', 'DevWatch');

  // Background header bar
  doc.setFillColor(15, 23, 42); // Dark slate
  doc.rect(0, 0, 210, 26, 'F');

  // App Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(99, 102, 241); // Accent indigo
  doc.text(appName.toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Sistem Monitoring Device Jaringan & CCTV Hikvision', 14, 18);

  // Print Date
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dicetak: ${getPrintDate()}`, 196, 12, { align: 'right' });
  doc.text('Status: Dokumen Resmi', 196, 18, { align: 'right' });

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle + (periodLabel ? ` · Periode: ${periodLabel}` : ''), 14, 40);

  // Line separator
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 43, 196, 43);

  return 48; // Y-start position for content
}

/**
 * Tambahkan nomor halaman dan footer di seluruh halaman
 */
function drawFooters(doc) {
  const totalPages = doc.internal.getNumberOfPages();
  const appName = getAppSetting('app_name', 'DevWatch');

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 283, 196, 283);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${appName} v1.0 — Dokumen Otomatis Sistem Monitoring`, 14, 288);
    doc.text(`Halaman ${i} dari ${totalPages}`, 196, 288, { align: 'right' });
  }
}

/**
 * Menggambar 4 kotak ringkasan eksekutif
 */
function drawSummaryCards(doc, startY, cards) {
  const cardW = 42;
  const cardH = 18;
  const gap = 3.3;

  cards.forEach((c, idx) => {
    const x = 14 + idx * (cardW + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(String(c.value), x + 4, startY + 7.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, x + 4, startY + 13.5);
  });

  return startY + cardH + 7;
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
      color: [34, 197, 94],
    },
    {
      label: 'Total Insiden',
      value: reportData?.totalIncidents ?? (extraData.incidents?.length || 0),
      color: [239, 68, 68],
    },
    {
      label: 'Total Downtime',
      value: `${reportData?.totalDowntimeHours ?? 0} Jam`,
      color: [234, 179, 8],
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
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      y = renderSlaTable(doc, y, extraData.slaList);
    }
  }

  drawFooters(doc);

  const filename = `${appName.toLowerCase()}-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Render Tabel SLA
 */
function renderSlaTable(doc, startY, list) {
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Tabel Kepatuhan SLA Perangkat', 14, y);
  y += 4.5;

  // Header Table
  const headers = [
    { label: 'Perangkat', x: 14, w: 50 },
    { label: 'IP Address', x: 65, w: 28 },
    { label: 'Grup', x: 94, w: 26 },
    { label: 'Target', x: 121, w: 16 },
    { label: '24 Jam', x: 138, w: 18 },
    { label: '7 Hari', x: 157, w: 18 },
    { label: '30 Hari', x: 176, w: 20 },
  ];

  const drawRowHeader = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    headers.forEach((h) => doc.text(h.label, h.x, y + 4.5));
    y += 7.5;
  };

  drawRowHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  list.forEach((item, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
      drawRowHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 1, 182, 6, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(item.nama || '', 48)[0] || '', 14, y + 3);
    doc.setTextColor(100, 116, 139);
    doc.text(item.ip || '', 65, y + 3);
    doc.text(item.grup || 'Umum', 94, y + 3);
    doc.text(`${item.targetSla || 99}%`, 121, y + 3);

    // Color code uptime 24h & 30h
    const up24 = item.uptime24h ?? 99.0;
    const up30 = item.uptime30d ?? 99.0;

    doc.setTextColor(up24 >= 99 ? 34 : up24 >= 95 ? 202 : 239, up24 >= 99 ? 197 : up24 >= 95 ? 138 : 68, up24 >= 99 ? 94 : 4);
    doc.text(`${up24.toFixed(1)}%`, 138, y + 3);

    doc.setTextColor(71, 85, 105);
    doc.text(`${(item.uptime7d ?? 99).toFixed(1)}%`, 157, y + 3);

    doc.setTextColor(up30 >= 99 ? 34 : up30 >= 95 ? 202 : 239, up30 >= 99 ? 197 : up30 >= 95 ? 138 : 68, up30 >= 99 ? 94 : 4);
    doc.text(`${up30.toFixed(1)}%`, 176, y + 3);

    y += 6;
  });

  return y + 6;
}

/**
 * Render Tabel Insiden
 */
function renderIncidentTable(doc, startY, incidents) {
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Daftar Riwayat Kejadian Insiden', 14, y);
  y += 4.5;

  const headers = [
    { label: 'Perangkat', x: 14 },
    { label: 'Waktu Mulai', x: 62 },
    { label: 'Waktu Selesai', x: 98 },
    { label: 'Durasi', x: 134 },
    { label: 'Status', x: 154 },
    { label: 'Penyebab / Keterangan', x: 172 },
  ];

  const drawRowHeader = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    headers.forEach((h) => doc.text(h.label, h.x, y + 4.5));
    y += 7.5;
  };

  drawRowHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  if (incidents.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('Tidak ada insiden yang tercatat pada sistem.', 14, y + 5);
    return y + 12;
  }

  incidents.forEach((inc, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
      drawRowHeader();
    }

    const isAktif = !inc.waktu_selesai;
    if (isAktif) {
      doc.setFillColor(254, 242, 242);
      doc.rect(14, y - 1, 182, 6, 'F');
    } else if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 1, 182, 6, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(inc.device_nama || inc.device || 'Perangkat', 45)[0] || '', 14, y + 3);

    doc.setTextColor(100, 116, 139);
    doc.text(formatDateWithTz(inc.waktu_mulai || inc.mulai), 62, y + 3);
    doc.text(inc.waktu_selesai ? formatDateWithTz(inc.waktu_selesai) : '— (Aktif)', 98, y + 3);
    doc.text(inc.durasi_menit ? `${inc.durasi_menit} mnt` : '—', 134, y + 3);

    doc.setTextColor(isAktif ? 239 : 71, isAktif ? 68 : 85, isAktif ? 68 : 105);
    doc.text(isAktif ? 'Aktif' : 'Selesai', 154, y + 3);

    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(inc.penyebab || 'Gangguan konektivitas', 22)[0] || '', 172, y + 3);

    y += 6;
  });

  return y + 6;
}

/**
 * Render Tren Mingguan
 */
function renderWeeklySummary(doc, startY, reportData) {
  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Tren Uptime & Insiden Harian (7 Hari)', 14, y);
  y += 4.5;

  const trends = reportData?.dailyTrends || [];

  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Hari', 20, y + 4.5);
  doc.text('Rata-rata Uptime', 75, y + 4.5);
  doc.text('Jumlah Insiden', 135, y + 4.5);
  y += 7.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  trends.forEach((t, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 1, 182, 6, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(t.hari || '', 20, y + 3.5);

    const up = t.uptimePct ?? 99.0;
    doc.setTextColor(up >= 99 ? 34 : 239, up >= 99 ? 197 : 68, up >= 99 ? 94 : 68);
    doc.text(`${up.toFixed(1)}%`, 75, y + 3.5);

    doc.setTextColor(t.insidenCount > 0 ? 239 : 71, t.insidenCount > 0 ? 68 : 85, t.insidenCount > 0 ? 68 : 105);
    doc.text(`${t.insidenCount} insiden`, 135, y + 3.5);

    y += 6;
  });

  return y + 6;
}

/**
 * Ekspor Log Terfilter ke PDF
 */
export async function exportLogsPdf(activeTab, logs, filters = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const appName = getAppSetting('app_name', 'DevWatch');

  const tabNames = {
    status: 'LOG STATUS PERANGKAT',
    aktivitas: 'LOG AKTIVITAS PENGGUNA',
    konfigurasi: 'LOG PERUBAHAN KONFIGURASI',
  };

  const title = `DEVWATCH — ${tabNames[activeTab] || 'LOG SISTEM'}`;
  const filterDesc = [
    filters.search ? `Pencarian: "${filters.search}"` : '',
    filters.tipe && filters.tipe !== 'all' ? `Tipe: ${filters.tipe}` : '',
    filters.dateFrom ? `Dari: ${filters.dateFrom}` : '',
    filters.dateTo ? `Sampai: ${filters.dateTo}` : '',
  ].filter(Boolean).join(' · ') || 'Semua Log Tersaring';

  // Landscape Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(99, 102, 241);
  doc.text(appName.toUpperCase(), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Ekspor Berkas Log: ${tabNames[activeTab] || 'Semua Log'}`, 14, 17);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dicetak: ${getPrintDate()}`, 283, 11, { align: 'right' });
  doc.text(`Total Entri: ${logs.length} Baris`, 283, 17, { align: 'right' });

  // Subtitle filter
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Kriteria Filter Aktif: ${filterDesc}`, 14, 30);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 33, 283, 33);

  let y = 37;

  // Header Kolom Tabel Sesuai Tab
  const drawLandscapeHeader = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 269, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    if (activeTab === 'status') {
      doc.text('Waktu', 16, y + 4.5);
      doc.text('Nama Perangkat', 56, y + 4.5);
      doc.text('IP Address', 105, y + 4.5);
      doc.text('Metode', 140, y + 4.5);
      doc.text('Response', 160, y + 4.5);
      doc.text('Pesan Log (Status)', 185, y + 4.5);
    } else if (activeTab === 'aktivitas') {
      doc.text('Waktu', 16, y + 4.5);
      doc.text('Pengguna / Email', 56, y + 4.5);
      doc.text('Aksi', 120, y + 4.5);
      doc.text('IP Akses', 150, y + 4.5);
      doc.text('Keterangan Aktivitas', 185, y + 4.5);
    } else {
      doc.text('Waktu', 16, y + 4.5);
      doc.text('Pengguna', 56, y + 4.5);
      doc.text('Aksi', 105, y + 4.5);
      doc.text('Perangkat Terkait', 145, y + 4.5);
      doc.text('Detail Perubahan', 190, y + 4.5);
    }
    y += 7.5;
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
      doc.rect(14, y - 1, 269, 5.5, 'F');
    }

    doc.setTextColor(100, 116, 139);
    doc.text(formatDateWithTz(l.waktu || l.created_at), 16, y + 3);

    if (activeTab === 'status') {
      doc.setTextColor(15, 23, 42);
      doc.text(doc.splitTextToSize(l.device || l.device_name || '', 45)[0] || '', 56, y + 3);
      doc.setTextColor(100, 116, 139);
      doc.text(l.ip || l.device_ip || '', 105, y + 3);
      doc.text(l.metode || 'PING', 140, y + 3);

      const resp = l.responseTime || l.response_time || '';
      doc.setTextColor(resp === 'Timeout' ? 239 : 34, resp === 'Timeout' ? 68 : 197, resp === 'Timeout' ? 68 : 94);
      doc.text(resp || '—', 160, y + 3);

      doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(l.pesan || l.pesan_log || '', 95)[0] || '', 185, y + 3);
    } else if (activeTab === 'aktivitas') {
      doc.setTextColor(15, 23, 42);
      doc.text(`${l.user || l.user_nama} (${l.email || l.user_email || ''})`, 56, y + 3);
      doc.setTextColor(71, 85, 105);
      doc.text(l.aksi || '', 120, y + 3);
      doc.setTextColor(100, 116, 139);
      doc.text(l.ip || l.ip_akses || '—', 150, y + 3);
      doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(l.pesan || l.detail || '', 95)[0] || '', 185, y + 3);
    } else {
      doc.setTextColor(15, 23, 42);
      doc.text(l.user || l.user_nama || '', 56, y + 3);
      doc.setTextColor(71, 85, 105);
      doc.text(l.aksi || '', 105, y + 3);
      doc.text(l.device || l.device_nama || '—', 145, y + 3);
      doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(l.detail || '', 90)[0] || '', 190, y + 3);
    }

    y += 5.5;
  });

  // Footer landscape
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 200, 283, 200);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${appName} v1.0 — Dokumen Otomatis Log Terfilter`, 14, 204);
    doc.text(`Halaman ${i} dari ${totalPages}`, 283, 204, { align: 'right' });
  }

  const filename = `${appName.toLowerCase()}-log-${activeTab}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}
