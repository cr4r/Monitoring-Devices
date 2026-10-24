// ================================================================
// DevWatch - reports.js
// Laporan: mingguan (arsip & snapshot otomatis), uptime/SLA, insiden,
// dan pembuatan berkas PDF & CSV riil (Full SQLite Data)
// ================================================================

import Swal from 'sweetalert2';
import {
  apiGetWeeklyReport,
  apiGetWeeklyArchives,
  apiSaveWeeklySnapshot,
  apiGetSlaReport,
  apiGetIncidentReport,
} from '../api.js';
import { renderWeeklyTrend, renderUptimeBar, renderIncidentBar } from '../components/charts.js';
import { exportReportPdf } from '../services/pdfService.js';
import { formatDateWithTz } from '../settingsManager.js';
import { getSession } from '../main.js';
import { getDemoDevices } from '../data/demoDevices.js';
import { cleanDeviceIp } from '../data/mock-devices.js';

let activeTab = 'mingguan';
let liveWeekly = null;
let liveArchives = [];
let liveSla = [];
let liveIncidents = [];
let selectedArchiveId = 'current';

let slaSearchTerm = '';
let slaSortOrder = 'desc'; // 'desc' (tertinggi) atau 'asc' (terendah)
let incidentSearchTerm = '';
let incidentPeriodFilter = 'all'; // 'all', '24h', '7d', '30d'

export async function fetchLiveReports(archiveId = null) {
  const session = getSession();
  if (session?.is_preview) {
    const demos = getDemoDevices();
    liveSla = demos.map((d) => ({
      id: d.id,
      nama: d.nama,
      ip: d.ip,
      grup: d.grup,
      lokasi: d.lokasi,
      jenis: d.jenis,
      status: d.status,
      targetSla: d.target_sla || d.uptime24h || 99.0,
      uptime24h: d.uptime24h || 99.0,
      uptime7d: Math.max(90, (d.uptime24h || 99) - 0.5),
      uptime30d: Math.max(90, (d.uptime24h || 99) - 0.8),
      isCompliant: (d.uptime24h || 99) >= (d.target_sla || 99),
    }));
    liveIncidents = [
      {
        id: 1,
        device_id: 4,
        device_nama: 'PC Marketing 01',
        device_ip: '192.168.1.30',
        grup: 'Lantai 2',
        lokasi: 'Ruang Marketing',
        waktu_mulai: new Date(Date.now() - 3600000).toISOString(),
        waktu_selesai: null,
        durasi_menit: 60,
        penyebab: 'RTO (Request Timeout) Ping gagal',
        status: 'terbuka',
      },
      {
        id: 2,
        device_id: 13,
        device_nama: 'CCTV Gudang Barang',
        device_ip: '192.168.2.103',
        grup: 'Gudang',
        lokasi: 'Pintu Gudang B',
        waktu_mulai: new Date(Date.now() - 5400000).toISOString(),
        waktu_selesai: null,
        durasi_menit: 90,
        penyebab: 'Port 80 HTTP ISAPI tidak merespons',
        status: 'terbuka',
      },
      {
        id: 3,
        device_id: 1,
        device_nama: 'PC Akuntansi 01',
        device_ip: '192.168.1.20',
        grup: 'Lantai 1',
        lokasi: 'Ruang Akuntansi',
        waktu_mulai: new Date(Date.now() - 28800000).toISOString(),
        waktu_selesai: new Date(Date.now() - 25200000).toISOString(),
        durasi_menit: 60,
        penyebab: 'Kabel LAN terlepas',
        status: 'selesai',
      },
    ];
    liveWeekly = {
      periode: 'Pekan Berjalan (Simulasi Preview)',
      totalDevices: 20,
      onlineDevices: 16,
      averageUptime: 99.1,
      targetSla: 99.0,
      slaCompliancePct: 95.0,
      totalIncidents: 3,
      totalDowntimeHours: 3.5,
      topDevices: liveSla.slice(0, 5),
      worstDevices: liveSla.slice(15, 20),
      groupBreakdown: [
        { grup: 'Lantai 1', total: 6, averageUptime: 99.8 },
        { grup: 'Lantai 2', total: 5, averageUptime: 98.6 },
        { grup: 'Server Room', total: 4, averageUptime: 99.9 },
        { grup: 'Gudang', total: 3, averageUptime: 97.4 },
      ],
      dailyTrends: [
        { hari: 'Senin', uptimePct: 99.8, insidenCount: 0 },
        { hari: 'Selasa', uptimePct: 99.5, insidenCount: 0 },
        { hari: 'Rabu', uptimePct: 99.1, insidenCount: 1 },
        { hari: 'Kamis', uptimePct: 98.9, insidenCount: 1 },
        { hari: 'Jumat', uptimePct: 99.4, insidenCount: 0 },
        { hari: 'Sabtu', uptimePct: 99.7, insidenCount: 0 },
        { hari: 'Minggu', uptimePct: 99.6, insidenCount: 1 },
      ],
    };
    liveArchives = [];
    return;
  }

  try {
    const [wRes, archRes, sRes, iRes] = await Promise.all([
      apiGetWeeklyReport(archiveId).catch(() => null),
      apiGetWeeklyArchives().catch(() => null),
      apiGetSlaReport().catch(() => null),
      apiGetIncidentReport().catch(() => null),
    ]);
    if (wRes && wRes.data) liveWeekly = wRes.data;
    if (archRes && archRes.data) liveArchives = archRes.data;
    if (sRes && sRes.data) liveSla = sRes.data;
    if (iRes && iRes.data) liveIncidents = iRes.data;
  } catch (err) {
    console.warn('Gagal memuat laporan database:', err);
  }
}

export function renderReports() {
  const summary = liveWeekly || {
    periode: 'Pekan Berjalan',
    totalDevices: liveSla.length,
    onlineDevices: liveSla.filter((d) => d.status === 'online').length,
    averageUptime: 99.2,
    targetSla: 99.0,
    slaCompliancePct: 100.0,
    totalIncidents: liveIncidents.length,
    totalDowntimeHours: 0,
    topDevices: [],
    worstDevices: [],
    groupBreakdown: [],
    dailyTrends: [],
  };

  const groups = [...new Set(liveSla.map((u) => u.grup).filter(Boolean))].sort();

  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">📈 Laporan Sistem</h1>
          <p class="page-subtitle">Uptime, SLA tracker, laporan mingguan otomatis, dan riwayat insiden</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="report-export-btn">📄 Export PDF</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <div class="tabs-nav">
          <button class="tab-btn ${activeTab === 'mingguan' ? 'active' : ''}" data-tab="mingguan">📅 Laporan Mingguan</button>
          <button class="tab-btn ${activeTab === 'sla' ? 'active' : ''}" data-tab="sla">📊 Uptime / SLA</button>
          <button class="tab-btn ${activeTab === 'insiden' ? 'active' : ''}" data-tab="insiden">⚡ Laporan Insiden</button>
        </div>

        <div style="
          background:var(--bg-card); border:1px solid var(--border-color);
          border-radius:0 var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg);
          padding:var(--spacing-lg);
        ">
          <!-- TAB: MINGGUAN -->
          <div class="tab-content ${activeTab === 'mingguan' ? 'active' : ''}" id="tab-content-mingguan">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
              <div>
                <div style="font-size:1.05rem; font-weight:700; color:var(--color-heading);">Laporan Mingguan Otomatis</div>
                <div style="font-size:0.8rem; color:var(--color-muted);" id="weekly-period-subtitle">Periode: ${summary.periode}</div>
              </div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <select class="form-control" id="weekly-archive-select" style="width:auto; font-size:0.8rem; padding:6px 12px;">
                  <option value="current" ${selectedArchiveId === 'current' ? 'selected' : ''}>Pekan Berjalan (Live)</option>
                  ${liveArchives.map((a) => `
                    <option value="${a.id}" ${selectedArchiveId == a.id ? 'selected' : ''}>
                      ${a.periode_label} (${a.average_uptime}%)
                    </option>
                  `).join('')}
                </select>
                <button class="btn btn-secondary btn-sm" id="btn-refresh-weekly" title="Segarkan dan sinkronkan data terkini dari basis data">
                  🔄 Sinkronkan Data
                </button>
                <button class="btn btn-primary btn-sm" id="btn-save-weekly-snapshot" title="Simpan snapshot mingguan sekarang ke database">
                  💾 Buat Snapshot
                </button>
                <span class="badge badge-online">✅ Sinkron SQLite</span>
              </div>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;" id="weekly-cards-container">
              ${renderWeeklySummaryCards(summary)}
            </div>

            <!-- Group Breakdown Chips -->
            <div id="weekly-group-breakdown-container" style="margin-bottom:16px;">
              ${renderGroupBreakdown(summary.groupBreakdown)}
            </div>

            <!-- Charts -->
            <div class="two-col">
              <div class="chart-container">
                <div class="chart-header">
                  <div class="chart-title">Rata-rata Uptime per Hari</div>
                </div>
                <div style="height:250px;"><canvas id="weekly-trend-chart"></canvas></div>
              </div>
              <div class="chart-container">
                <div class="chart-header">
                  <div class="chart-title">Jumlah Insiden per Hari</div>
                </div>
                <div style="height:250px;"><canvas id="weekly-incident-chart"></canvas></div>
              </div>
            </div>

            <!-- Highlights -->
            <div class="two-col" style="margin-top:16px;" id="weekly-highlights-container">
              ${renderWeeklyHighlights(summary)}
            </div>
          </div>

          <!-- TAB: SLA -->
          <div class="tab-content ${activeTab === 'sla' ? 'active' : ''}" id="tab-content-sla">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
              <div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-heading);">Uptime & SLA Tracker</div>
                <div style="font-size:0.78rem; color:var(--color-muted);">Formula PRD: (Waktu Online / Total Waktu Monitoring) × 100</div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <div class="search-input-wrapper" style="min-width:180px;">
                  <span class="search-icon">🔍</span>
                  <input type="text" class="form-control" id="sla-search-input" placeholder="Cari nama atau IP..." value="${slaSearchTerm}" style="padding:6px 12px 6px 32px; font-size:0.8rem;" />
                </div>
                <select class="form-control" id="sla-period-select" style="width:auto; font-size:0.8rem; padding:6px 10px;">
                  <option value="24h">24 Jam Terakhir</option>
                  <option value="7d">7 Hari Terakhir</option>
                  <option value="30d">30 Hari Terakhir</option>
                </select>
                <select class="form-control" id="sla-grup-select" style="width:auto; font-size:0.8rem; padding:6px 10px;">
                  <option value="all">Semua Grup</option>
                  ${groups.map((g) => `<option value="${g}">${g}</option>`).join('')}
                </select>
                <select class="form-control" id="sla-sort-select" style="width:auto; font-size:0.8rem; padding:6px 10px;" title="Urutan evaluasi">
                  <option value="desc" ${slaSortOrder === 'desc' ? 'selected' : ''}>Uptime Tertinggi</option>
                  <option value="asc" ${slaSortOrder === 'asc' ? 'selected' : ''}>⚠️ Uptime Terendah (Prioritas Masalah)</option>
                </select>
                <button class="btn btn-secondary btn-sm" id="sla-export-csv-btn" title="Unduh data SLA dalam format CSV">
                  📥 Export CSV
                </button>
              </div>
            </div>

            <!-- SLA Metrics Overview Bar -->
            <div id="sla-metrics-summary" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; margin-bottom:16px;">
              ${renderSlaMetricsOverview('24h', 'all')}
            </div>

            <div class="two-col">
              <div class="chart-container">
                <div class="chart-header">
                  <div class="chart-title">Tingkat Kepatuhan SLA (Uptime %)</div>
                  <div class="map-legend" style="gap:12px;">
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-online); height:8px; border-radius:2px;"></div> ≥99%</div>
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-maintenance); height:8px; border-radius:2px;"></div> 95-99%</div>
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-offline); height:8px; border-radius:2px;"></div> <95%</div>
                  </div>
                </div>
                <div style="height:320px;"><canvas id="sla-uptime-chart"></canvas></div>
              </div>

              <div class="card" style="padding:var(--spacing-md); overflow-y:auto; max-height:400px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <div class="section-title" style="margin-bottom:0;">Detail Evaluasi SLA per Perangkat</div>
                  <span id="sla-device-count-badge" class="badge badge-neutral" style="font-size:0.7rem;">${liveSla.length} node</span>
                </div>
                <div id="sla-device-list">
                  ${renderSLAList('24h', 'all')}
                </div>
              </div>
            </div>
          </div>

          <!-- TAB: INSIDEN -->
          <div class="tab-content ${activeTab === 'insiden' ? 'active' : ''}" id="tab-content-insiden">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
              <div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-heading);">Laporan Riwayat Insiden Jaringan</div>
                <div style="font-size:0.78rem; color:var(--color-muted);">Catatan otomatis downtime, durasi gangguan, dan penyebab konektivitas</div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <div class="search-input-wrapper" style="min-width:180px;">
                  <span class="search-icon">🔍</span>
                  <input type="text" class="form-control" id="insiden-search-input" placeholder="Cari perangkat, IP, lokasi..." value="${incidentSearchTerm}" style="padding:6px 12px 6px 32px; font-size:0.8rem;" />
                </div>
                <select class="form-control" id="insiden-period-select" style="width:auto; font-size:0.8rem; padding:6px 10px;">
                  <option value="all">Semua Waktu</option>
                  <option value="24h">24 Jam Terakhir</option>
                  <option value="7d">7 Hari Terakhir</option>
                  <option value="30d">30 Hari Terakhir</option>
                </select>
                <select class="form-control" id="insiden-filter" style="width:auto; font-size:0.8rem; padding:6px 10px;">
                  <option value="all">Semua Status</option>
                  <option value="aktif">Sedang Berlangsung</option>
                  <option value="selesai">Selesai</option>
                </select>
                <button class="btn btn-secondary btn-sm" id="insiden-export-csv-btn" title="Unduh riwayat insiden dalam format CSV">
                  📥 Export CSV
                </button>
              </div>
            </div>

            <!-- Stats Insiden & MTTR -->
            <div id="insiden-metrics-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px; margin-bottom:20px;">
              ${renderIncidentStats()}
            </div>

            <div id="insiden-list">
              ${renderInsidenList('all')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderWeeklySummaryCards(summary) {
  const cards = [
    { label: 'Total Perangkat', val: summary.totalDevices || 0, icon: '📡', color: 'var(--color-accent)' },
    { label: 'Rata-rata Uptime', val: (summary.averageUptime ?? 100) + '%', icon: '📊', color: 'var(--color-online)' },
    { label: 'Kepatuhan Target SLA', val: (summary.slaCompliancePct ?? 100) + '%', icon: '🎯', color: (summary.slaCompliancePct ?? 100) >= 95 ? 'var(--color-online)' : 'var(--color-maintenance)' },
    { label: 'Total Insiden', val: summary.totalIncidents || 0, icon: '⚡', color: 'var(--color-offline)' },
    { label: 'Total Downtime', val: (summary.totalDowntimeHours || 0) + ' jam', icon: '⏱️', color: 'var(--color-maintenance)' },
  ];

  return cards.map((s) => `
    <div class="report-summary-card">
      <div style="font-size:1.5rem;">${s.icon}</div>
      <div>
        <div style="font-size:1.25rem; font-weight:800; color:${s.color};">${s.val}</div>
        <div style="font-size:0.78rem; color:var(--color-muted);">${s.label}</div>
      </div>
    </div>
  `).join('');
}

function renderGroupBreakdown(breakdown = []) {
  if (!breakdown || breakdown.length === 0) return '';
  return `
    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:var(--border-radius-md); padding:10px 14px;">
      <div style="font-size:0.75rem; font-weight:700; color:var(--color-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
        🏢 Distribusi Performa Uptime per Grup Kantor:
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${breakdown.map((g) => {
          const color = g.averageUptime >= 99 ? 'var(--color-online)' : g.averageUptime >= 95 ? 'var(--color-maintenance)' : 'var(--color-offline)';
          return `
            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:6px; padding:4px 10px; font-size:0.78rem; display:flex; align-items:center; gap:6px;">
              <span style="font-weight:600; color:var(--color-heading);">${g.grup}</span>
              <span style="color:var(--color-muted);">(${g.total} device)</span>
              <span style="font-weight:700; color:${color}; font-family:var(--font-mono);">${g.averageUptime}%</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderWeeklyHighlights(summary) {
  const topList = summary.topDevices || [];
  const worstList = summary.worstDevices || [];

  return `
    <div class="card" style="padding:var(--spacing-md);">
      <div class="section-title" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <span>🏆 Perangkat Paling Andal (Top 5)</span>
        <span class="badge badge-online" style="font-size:0.7rem;">Online Tertinggi</span>
      </div>
      ${topList.length === 0 ? '<div style="font-size:0.8rem; color:var(--color-muted);">Belum ada data evaluasi</div>' : `
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${topList.slice(0, 5).map((d) => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
              <div>
                <strong style="color:var(--color-text);">${d.nama}</strong>
                <span style="font-size:0.72rem; color:var(--color-muted); margin-left:6px;" title="${d.ip}">${cleanDeviceIp(d.ip)} (${d.grup || 'Umum'})</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge badge-online">${d.uptime}%</span>
                <span style="font-size:0.75rem; color:var(--color-muted);">Target: ${d.sla}%</span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <div class="card" style="padding:var(--spacing-md);">
      <div class="section-title" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <span>⚠️ Perhatian & Diagnostik (Prioritas)</span>
        <span class="badge badge-offline" style="font-size:0.7rem;">Uptime Rendah / Ada Insiden</span>
      </div>
      ${worstList.length === 0 ? '<div style="font-size:0.8rem; color:var(--color-muted);">Semua perangkat beroperasi normal</div>' : `
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${worstList.slice(0, 5).map((d) => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
              <div>
                <strong style="color:var(--color-text);">${d.nama}</strong>
                <span style="font-size:0.72rem; color:var(--color-muted); margin-left:6px;" title="${d.ip}">${cleanDeviceIp(d.ip)} (${d.grup || 'Umum'})</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge ${d.uptime >= 99 ? 'badge-online' : d.uptime >= 95 ? 'badge-maintenance' : 'badge-offline'}">${d.uptime}%</span>
                <span style="font-size:0.75rem; color:var(--color-muted);">${d.incidentsCount || 0} insiden</span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function getFilteredSlaData(period = '24h', grup = 'all') {
  const fieldMap = { '24h': 'uptime24h', '7d': 'uptime7d', '30d': 'uptime30d' };
  const field = fieldMap[period] || 'uptime24h';

  let data = [...liveSla];
  if (grup !== 'all') {
    data = data.filter((d) => d.grup === grup);
  }

  if (slaSearchTerm && slaSearchTerm.trim()) {
    const q = slaSearchTerm.trim().toLowerCase();
    data = data.filter((d) => (d.nama || '').toLowerCase().includes(q) || (d.ip || '').includes(q));
  }

  data.sort((a, b) => {
    const valA = a[field] ?? 99.0;
    const valB = b[field] ?? 99.0;
    return slaSortOrder === 'asc' ? valA - valB : valB - valA;
  });

  return data;
}

function renderSlaMetricsOverview(period, grup) {
  const data = getFilteredSlaData(period, grup);
  const fieldMap = { '24h': 'uptime24h', '7d': 'uptime7d', '30d': 'uptime30d' };
  const field = fieldMap[period] || 'uptime24h';

  const total = data.length;
  const compliantCount = data.filter((d) => (d[field] ?? 99.0) >= (d.targetSla || 99.0)).length;
  const compliancePct = total > 0 ? Math.round((compliantCount / total) * 100) : 100;
  const avgUptime = total > 0 ? (data.reduce((acc, d) => acc + (d[field] ?? 99.0), 0) / total).toFixed(1) : '100.0';

  return `
    <div class="report-summary-card" style="padding:10px 14px;">
      <span style="font-size:1.3rem;">🎯</span>
      <div>
        <div style="font-size:1.15rem; font-weight:800; color:${compliancePct >= 95 ? 'var(--color-online)' : 'var(--color-maintenance)'};">${compliancePct}%</div>
        <div style="font-size:0.75rem; color:var(--color-muted);">Kepatuhan Target SLA</div>
      </div>
    </div>
    <div class="report-summary-card" style="padding:10px 14px;">
      <span style="font-size:1.3rem;">📊</span>
      <div>
        <div style="font-size:1.15rem; font-weight:800; color:var(--color-online);">${avgUptime}%</div>
        <div style="font-size:0.75rem; color:var(--color-muted);">Rata-rata Uptime (${period})</div>
      </div>
    </div>
    <div class="report-summary-card" style="padding:10px 14px;">
      <span style="font-size:1.3rem;">✅</span>
      <div>
        <div style="font-size:1.15rem; font-weight:800; color:var(--color-online);">${compliantCount} <span style="font-size:0.75rem; color:var(--color-muted); font-weight:500;">/ ${total} node</span></div>
        <div style="font-size:0.75rem; color:var(--color-muted);">Memenuhi Standar SLA</div>
      </div>
    </div>
    <div class="report-summary-card" style="padding:10px 14px;">
      <span style="font-size:1.3rem;">⚠️</span>
      <div>
        <div style="font-size:1.15rem; font-weight:800; color:${total - compliantCount > 0 ? 'var(--color-offline)' : 'var(--color-muted)'};">${total - compliantCount}</div>
        <div style="font-size:0.75rem; color:var(--color-muted);">Di Bawah Target SLA</div>
      </div>
    </div>
  `;
}

function renderSLAList(period, grup) {
  const fieldMap = { '24h': 'uptime24h', '7d': 'uptime7d', '30d': 'uptime30d' };
  const field = fieldMap[period] || 'uptime24h';

  const data = getFilteredSlaData(period, grup);

  if (data.length === 0) {
    return `<div class="empty-state" style="padding:24px;"><div class="empty-icon">📊</div><div class="empty-title">Tidak ada data SLA cocok</div><div class="empty-desc">Coba sesuaikan kata kunci pencarian atau filter grup</div></div>`;
  }

  return data.map((d) => {
    const val = d[field] ?? 99.0;
    const badgeClass = val >= 99 ? 'high' : val >= 95 ? 'medium' : 'low';
    const target = d.targetSla || 99.0;
    const met = val >= target;

    return `
      <div class="sla-device-row">
        <div class="sla-device-name">
          <div style="font-weight:600; font-size:0.85rem; color:var(--color-text);">${d.nama}</div>
          <div style="font-size:0.72rem; color:var(--color-muted);" title="${d.ip}">${cleanDeviceIp(d.ip)} · Target: ${target}% · ${d.grup || 'Umum'}</div>
        </div>
        <div class="sla-bar-wrapper">
          <div class="uptime-bar">
            <div class="uptime-fill ${badgeClass}" style="width:${Math.max(0, val)}%;"></div>
          </div>
        </div>
        <div class="sla-device-uptime">
          <span class="uptime-badge ${badgeClass}">${val.toFixed(1)}%</span>
        </div>
        <span style="font-size:1rem;" title="${met ? 'Memenuhi Target SLA' : 'Di Bawah Target SLA'}">${met ? '✅' : '❌'}</span>
      </div>
    `;
  }).join('');
}

function getFilteredIncidentData(statusFilter = 'all') {
  let data = [...liveIncidents];

  if (statusFilter === 'aktif') data = data.filter((i) => !i.waktu_selesai);
  if (statusFilter === 'selesai') data = data.filter((i) => i.waktu_selesai);

  // Filter waktu
  if (incidentPeriodFilter !== 'all') {
    const cutoffMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[incidentPeriodFilter] || Infinity;

    const now = Date.now();
    data = data.filter((i) => {
      const t = new Date(i.waktu_mulai || i.mulai).getTime();
      return now - t <= cutoffMs;
    });
  }

  // Filter pencarian
  if (incidentSearchTerm && incidentSearchTerm.trim()) {
    const q = incidentSearchTerm.trim().toLowerCase();
    data = data.filter((i) => {
      const devName = (i.device_nama || i.nama || i.device || '').toLowerCase();
      const devIp = (i.device_ip || i.ip || '').toLowerCase();
      const devGrup = (i.grup || '').toLowerCase();
      const devLokasi = (i.lokasi || '').toLowerCase();
      const desc = (i.penyebab || i.keterangan || '').toLowerCase();
      return devName.includes(q) || devIp.includes(q) || devGrup.includes(q) || devLokasi.includes(q) || desc.includes(q);
    });
  }

  return data;
}

function renderIncidentStats() {
  const all = liveIncidents;
  const active = all.filter((i) => !i.waktu_selesai);
  const finished = all.filter((i) => i.waktu_selesai);

  // Hitung MTTR (Mean Time to Resolution)
  const totalMins = finished.reduce((acc, i) => acc + (i.durasi_menit || 0), 0);
  const mttrMins = finished.length > 0 ? Math.round(totalMins / finished.length) : 0;
  const mttrFormatted = mttrMins >= 60 ? `${(mttrMins / 60).toFixed(1)} jam` : `${mttrMins} mnt`;

  return `
    <div class="report-summary-card">
      <span style="font-size:1.5rem;">⚡</span>
      <div>
        <div class="stat-value text-offline">${all.length}</div>
        <div style="font-size:0.78rem; color:var(--color-muted);">Total Insiden</div>
      </div>
    </div>
    <div class="report-summary-card">
      <span style="font-size:1.5rem;">🔴</span>
      <div>
        <div class="stat-value text-offline">${active.length}</div>
        <div style="font-size:0.78rem; color:var(--color-muted);">Aktif Sekarang</div>
      </div>
    </div>
    <div class="report-summary-card">
      <span style="font-size:1.5rem;">✅</span>
      <div>
        <div class="stat-value text-online">${finished.length}</div>
        <div style="font-size:0.78rem; color:var(--color-muted);">Insiden Selesai</div>
      </div>
    </div>
    <div class="report-summary-card">
      <span style="font-size:1.5rem;">⏱️</span>
      <div>
        <div class="stat-value" style="color:var(--color-maintenance);">${mttrFormatted}</div>
        <div style="font-size:0.78rem; color:var(--color-muted);">Rata-rata MTTR (Penanganan)</div>
      </div>
    </div>
  `;
}

function renderInsidenList(filter) {
  const data = getFilteredIncidentData(filter);

  if (data.length === 0) {
    return `<div class="empty-state" style="padding:32px;"><div class="empty-icon">✅</div><div class="empty-title">Tidak ada insiden tercatat</div><div class="empty-desc">Seluruh perangkat berjalan lancar atau tidak cocok dengan filter aktif</div></div>`;
  }

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Perangkat</th>
            <th>Grup & Lokasi</th>
            <th>Waktu Mulai</th>
            <th>Waktu Selesai</th>
            <th>Durasi</th>
            <th>Status</th>
            <th>Penyebab / Keterangan</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((inc) => {
            const isAktif = !inc.waktu_selesai;
            return `
              <tr class="${isAktif ? 'log-offline' : ''}">
                <td>
                  <div style="font-weight:600; color:var(--color-heading);">${inc.device_nama || inc.nama || inc.device || 'Perangkat'}</div>
                  <div class="ip-text" title="${inc.device_ip || inc.ip || ''}">${cleanDeviceIp(inc.device_ip || inc.ip || '')}</div>
                </td>
                <td style="font-size:0.78rem; color:var(--color-text-secondary);">
                  <div>🏢 <strong>${inc.grup || 'Umum'}</strong></div>
                  <div style="color:var(--color-muted); font-size:0.72rem;">📍 ${inc.lokasi || '-'}</div>
                </td>
                <td style="font-size:0.78rem; color:var(--color-muted); white-space:nowrap;">
                  ${formatDateWithTz(inc.waktu_mulai || inc.mulai)}
                </td>
                <td style="font-size:0.78rem; color:var(--color-muted); white-space:nowrap;">
                  ${inc.waktu_selesai ? formatDateWithTz(inc.waktu_selesai) : '<span style="color:#ef4444; font-weight:700;">Masih Berlangsung</span>'}
                </td>
                <td>
                  ${inc.durasi_menit ? `<span class="chip">⏱️ ${inc.durasi_menit} mnt</span>` : (isAktif ? '<span style="color:var(--color-offline); font-weight:700; font-size:0.8rem;">Aktif</span>' : '-')}
                </td>
                <td>
                  <span class="badge ${isAktif ? 'badge-offline' : 'badge-neutral'}">
                    ${isAktif ? '🔴 Aktif' : '⚫ Selesai'}
                  </span>
                </td>
                <td style="font-size:0.82rem; color:var(--color-text-secondary); max-width:260px;">
                  ${inc.penyebab || inc.keterangan || 'Gangguan konektivitas'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function exportSlaCsv() {
  const period = document.getElementById('sla-period-select')?.value || '24h';
  const grup = document.getElementById('sla-grup-select')?.value || 'all';
  const data = getFilteredSlaData(period, grup);

  const headers = ['ID', 'Nama Perangkat', 'IP Address', 'Grup', 'Status', 'Target SLA (%)', 'Uptime 24h (%)', 'Uptime 7d (%)', 'Uptime 30d (%)', 'Kepatuhan'];
  const rows = data.map((d) => [
    d.id,
    `"${(d.nama || '').replace(/"/g, '""')}"`,
    cleanDeviceIp(d.ip),
    `"${(d.grup || 'Umum').replace(/"/g, '""')}"`,
    d.status,
    d.targetSla || 99.0,
    d.uptime24h || 100,
    d.uptime7d || 100,
    d.uptime30d || 100,
    (d.uptime24h || 100) >= (d.targetSla || 99) ? 'MEMENUHI' : 'DI BAWAH TARGET',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan-sla-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  Swal.fire({
    toast: true,
    icon: 'success',
    title: 'Data SLA Berhasil Diekspor',
    text: `${rows.length} perangkat telah diekspor ke CSV.`,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    background: '#1a1d2e',
    color: '#e2e8f0',
  });
}

function exportIncidentCsv() {
  const statusFilter = document.getElementById('insiden-filter')?.value || 'all';
  const data = getFilteredIncidentData(statusFilter);

  const headers = ['ID', 'Perangkat', 'IP Address', 'Grup', 'Lokasi', 'Waktu Mulai', 'Waktu Selesai', 'Durasi (Menit)', 'Status', 'Penyebab / Keterangan'];
  const rows = data.map((i) => [
    i.id,
    `"${(i.device_nama || i.nama || i.device || '').replace(/"/g, '""')}"`,
    cleanDeviceIp(i.device_ip || i.ip || ''),
    `"${(i.grup || 'Umum').replace(/"/g, '""')}"`,
    `"${(i.lokasi || '-').replace(/"/g, '""')}"`,
    i.waktu_mulai || '',
    i.waktu_selesai || 'Sedang Berlangsung',
    i.durasi_menit || 0,
    i.waktu_selesai ? 'Selesai' : 'Aktif',
    `"${(i.penyebab || i.keterangan || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan-insiden-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  Swal.fire({
    toast: true,
    icon: 'success',
    title: 'Data Insiden Berhasil Diekspor',
    text: `${rows.length} baris insiden telah diekspor ke CSV.`,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    background: '#1a1d2e',
    color: '#e2e8f0',
  });
}

function updateWeeklyReactiveUI() {
  if (!liveWeekly) return;

  const sub = document.getElementById('weekly-period-subtitle');
  if (sub) sub.innerText = `Periode: ${liveWeekly.periode}`;

  const cardsContainer = document.getElementById('weekly-cards-container');
  if (cardsContainer) cardsContainer.innerHTML = renderWeeklySummaryCards(liveWeekly);

  const breakdownContainer = document.getElementById('weekly-group-breakdown-container');
  if (breakdownContainer) breakdownContainer.innerHTML = renderGroupBreakdown(liveWeekly.groupBreakdown);

  const highlightsContainer = document.getElementById('weekly-highlights-container');
  if (highlightsContainer) highlightsContainer.innerHTML = renderWeeklyHighlights(liveWeekly);
}

function updateSlaReactiveUI() {
  const period = document.getElementById('sla-period-select')?.value || '24h';
  const grup = document.getElementById('sla-grup-select')?.value || 'all';

  const list = document.getElementById('sla-device-list');
  if (list) list.innerHTML = renderSLAList(period, grup);

  const overview = document.getElementById('sla-metrics-summary');
  if (overview) overview.innerHTML = renderSlaMetricsOverview(period, grup);

  const countBadge = document.getElementById('sla-device-count-badge');
  const filtered = getFilteredSlaData(period, grup);
  if (countBadge) countBadge.textContent = `${filtered.length} node`;

  const fieldMap = { '24h': 'uptime24h', '7d': 'uptime7d', '30d': 'uptime30d' };
  renderUptimeBar('sla-uptime-chart', filtered, fieldMap[period]);
}

function updateIncidentReactiveUI() {
  const statusFilter = document.getElementById('insiden-filter')?.value || 'all';
  const list = document.getElementById('insiden-list');
  if (list) list.innerHTML = renderInsidenList(statusFilter);

  const stats = document.getElementById('insiden-metrics-container');
  if (stats) stats.innerHTML = renderIncidentStats();
}

export function initReportsEvents() {
  fetchLiveReports().then(() => {
    updateWeeklyReactiveUI();
    updateSlaReactiveUI();
    updateIncidentReactiveUI();
    initWeeklyCharts();
  });

  // Tab switching
  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-content-${activeTab}`)?.classList.add('active');

      if (activeTab === 'mingguan') {
        updateWeeklyReactiveUI();
        initWeeklyCharts();
      }
      if (activeTab === 'sla') {
        updateSlaReactiveUI();
      }
      if (activeTab === 'insiden') {
        updateIncidentReactiveUI();
      }
    });
  });

  // Archive selector
  document.getElementById('weekly-archive-select')?.addEventListener('change', async (e) => {
    selectedArchiveId = e.target.value;
    const archId = selectedArchiveId === 'current' ? null : selectedArchiveId;
    await fetchLiveReports(archId);
    updateWeeklyReactiveUI();
    initWeeklyCharts();
  });

  // Refresh weekly button
  document.getElementById('btn-refresh-weekly')?.addEventListener('click', async () => {
    Swal.showLoading();
    await fetchLiveReports(selectedArchiveId === 'current' ? null : selectedArchiveId);
    updateWeeklyReactiveUI();
    initWeeklyCharts();
    Swal.close();
  });

  // Manual Snapshot button
  document.getElementById('btn-save-weekly-snapshot')?.addEventListener('click', async () => {
    try {
      Swal.showLoading();
      await apiSaveWeeklySnapshot();
      await fetchLiveReports();
      updateWeeklyReactiveUI();
      Swal.fire({
        icon: 'success',
        title: 'Snapshot Tersimpan',
        text: 'Snapshot laporan mingguan berhasil diarsipkan ke database SQLite.',
        timer: 2000,
        showConfirmButton: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan Snapshot', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    }
  });

  // SLA Event Handlers
  document.getElementById('sla-period-select')?.addEventListener('change', updateSlaReactiveUI);
  document.getElementById('sla-grup-select')?.addEventListener('change', updateSlaReactiveUI);
  document.getElementById('sla-sort-select')?.addEventListener('change', (e) => {
    slaSortOrder = e.target.value;
    updateSlaReactiveUI();
  });
  document.getElementById('sla-search-input')?.addEventListener('input', (e) => {
    slaSearchTerm = e.target.value;
    updateSlaReactiveUI();
  });
  document.getElementById('sla-export-csv-btn')?.addEventListener('click', exportSlaCsv);

  // Insiden Event Handlers
  document.getElementById('insiden-filter')?.addEventListener('change', updateIncidentReactiveUI);
  document.getElementById('insiden-period-select')?.addEventListener('change', (e) => {
    incidentPeriodFilter = e.target.value;
    updateIncidentReactiveUI();
  });
  document.getElementById('insiden-search-input')?.addEventListener('input', (e) => {
    incidentSearchTerm = e.target.value;
    updateIncidentReactiveUI();
  });
  document.getElementById('insiden-export-csv-btn')?.addEventListener('click', exportIncidentCsv);

  // REAL Export PDF
  document.getElementById('report-export-btn')?.addEventListener('click', async () => {
    try {
      Swal.fire({
        title: 'Menyusun Berkas PDF...',
        html: '<div style="text-align:center;"><div class="spinner spinner-lg" style="margin:0 auto;"></div><div style="margin-top:12px; font-size:0.85rem; color:#94a3b8;">Menyusun data laporan dan metrik sistem...</div></div>',
        showConfirmButton: false,
        allowOutsideClick: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
        timer: 600,
      });

      let data = liveWeekly;
      if (activeTab === 'sla') data = liveSla;
      if (activeTab === 'insiden') data = liveIncidents;

      const filename = await exportReportPdf(activeTab, data, {
        slaList: liveSla,
        incidents: liveIncidents,
      });

      Swal.fire({
        icon: 'success',
        title: 'PDF Berhasil Dibuat',
        html: `<span style="font-size:0.85rem; color:#94a3b8;">Berkas <b>${filename}</b> telah berhasil digenerate dan otomatis diunduh.</span>`,
        confirmButtonColor: '#6366f1',
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Membuat PDF', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    }
  });

  initWeeklyCharts();
}

function initWeeklyCharts() {
  setTimeout(() => {
    const trends = liveWeekly?.dailyTrends || [
      { hari: 'Senin', uptimePct: 99.2, insidenCount: 0 },
      { hari: 'Selasa', uptimePct: 98.5, insidenCount: 1 },
      { hari: 'Rabu', uptimePct: 99.0, insidenCount: 0 },
      { hari: 'Kamis', uptimePct: 97.8, insidenCount: 2 },
      { hari: 'Jumat', uptimePct: 98.9, insidenCount: 0 },
      { hari: 'Sabtu', uptimePct: 99.5, insidenCount: 0 },
      { hari: 'Minggu', uptimePct: 99.1, insidenCount: 0 },
    ];
    renderWeeklyTrend('weekly-trend-chart', trends.map((t) => ({ hari: t.hari, avgUptime: t.uptimePct, insiden: t.insidenCount })));
    renderIncidentBar('weekly-incident-chart', trends.map((t) => ({ hari: t.hari, avgUptime: t.uptimePct, insiden: t.insidenCount })));
  }, 100);
}
