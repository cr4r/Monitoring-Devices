// ================================================================
// DevWatch — reports.js
// Laporan: mingguan (arsip & snapshot otomatis), uptime/SLA, insiden,
// dan pembuatan berkas PDF riil (Full SQLite Data)
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

let activeTab = 'mingguan';
let liveWeekly = null;
let liveArchives = [];
let liveSla = [];
let liveIncidents = [];
let selectedArchiveId = 'current';

export async function fetchLiveReports(archiveId = null) {
  const session = getSession();
  if (session?.is_preview) {
    const demos = getDemoDevices();
    liveSla = demos.map((d) => ({
      id: d.id,
      nama: d.nama,
      ip: d.ip,
      grup: d.grup,
      status: d.status,
      targetSla: d.uptime24h || 99.0,
      uptime24h: d.uptime24h || 99.0,
      uptime7d: Math.max(90, (d.uptime24h || 99) - 0.5),
      uptime30d: Math.max(90, (d.uptime24h || 99) - 0.8),
    }));
    liveIncidents = [
      {
        id: 1,
        nama: 'PC Marketing 01',
        ip: '192.168.1.30',
        waktu_mulai: new Date(Date.now() - 3600000).toISOString(),
        waktu_selesai: null,
        durasi_menit: 60,
        penyebab: 'RTO (Request Timeout) Ping gagal',
        status: 'terbuka',
      },
      {
        id: 2,
        nama: 'CCTV Gudang Barang',
        ip: '192.168.2.103',
        waktu_mulai: new Date(Date.now() - 5400000).toISOString(),
        waktu_selesai: null,
        durasi_menit: 90,
        penyebab: 'Port 80 HTTP ISAPI tidak merespons',
        status: 'terbuka',
      },
      {
        id: 3,
        nama: 'PC Akuntansi 01',
        ip: '192.168.1.20',
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
      totalIncidents: 3,
      totalDowntimeHours: 3.5,
      topDevices: liveSla.slice(0, 5),
      dailyTrends: [
        { hari: 'Senin', uptime: 99.8 },
        { hari: 'Selasa', uptime: 99.5 },
        { hari: 'Rabu', uptime: 99.1 },
        { hari: 'Kamis', uptime: 98.9 },
        { hari: 'Jumat', uptime: 99.4 },
        { hari: 'Sabtu', uptime: 99.7 },
        { hari: 'Minggu', uptime: 99.6 },
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
    totalIncidents: liveIncidents.length,
    totalDowntimeHours: 0,
    topDevices: [],
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
                <button class="btn btn-secondary btn-sm" id="btn-save-weekly-snapshot" title="Simpan snapshot mingguan sekarang ke database">
                  💾 Buat Snapshot
                </button>
                <span class="badge badge-online">✅ Sinkron SQLite</span>
              </div>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;" id="weekly-cards-container">
              ${[
                { label: 'Total Perangkat', val: summary.totalDevices, icon: '📡', color: 'var(--color-accent)' },
                { label: 'Rata-rata Uptime', val: summary.averageUptime + '%', icon: '📊', color: 'var(--color-online)' },
                { label: 'Total Insiden', val: summary.totalIncidents, icon: '⚡', color: 'var(--color-offline)' },
                { label: 'Total Downtime', val: summary.totalDowntimeHours + ' jam', icon: '⏱️', color: 'var(--color-maintenance)' },
              ].map((s) => `
                <div class="report-summary-card">
                  <div style="font-size:1.5rem;">${s.icon}</div>
                  <div>
                    <div style="font-size:1.3rem; font-weight:800; color:${s.color};">${s.val}</div>
                    <div style="font-size:0.78rem; color:var(--color-muted);">${s.label}</div>
                  </div>
                </div>
              `).join('')}
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
            <div class="two-col" style="margin-top:16px;">
              <div class="card">
                <div class="section-title" style="margin-bottom:8px;">🏆 Perangkat Terbaik</div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-online);">${summary.topDevices[0]?.nama || 'Belum ada data'}</div>
                <div style="font-size:0.8rem; color:var(--color-muted);">Status: ${summary.topDevices[0]?.status || 'normal'} · Target SLA: ${summary.topDevices[0]?.sla || 99}%</div>
              </div>
              <div class="card">
                <div class="section-title" style="margin-bottom:8px;">⚠️ Perhatian & Pemeliharaan</div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-offline);">${summary.topDevices[summary.topDevices.length - 1]?.nama || 'Semua Perangkat Normal'}</div>
                <div style="font-size:0.8rem; color:var(--color-muted);">Tercatat otomatis pada snapshot mingguan SQLite</div>
              </div>
            </div>
          </div>

          <!-- TAB: SLA -->
          <div class="tab-content ${activeTab === 'sla' ? 'active' : ''}" id="tab-content-sla">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
              <div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-heading);">Uptime & SLA Tracker</div>
                <div style="font-size:0.78rem; color:var(--color-muted);">Perhitungan: (Waktu Online / Total Waktu Monitoring) × 100</div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <select class="form-control" id="sla-period-select" style="width:auto;">
                  <option value="24h">24 Jam Terakhir</option>
                  <option value="7d">7 Hari Terakhir</option>
                  <option value="30d">30 Hari Terakhir</option>
                </select>
                <select class="form-control" id="sla-grup-select" style="width:auto;">
                  <option value="all">Semua Grup</option>
                  ${groups.map((g) => `<option value="${g}">${g}</option>`).join('')}
                </select>
              </div>
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
                <div style="height:300px;"><canvas id="sla-uptime-chart"></canvas></div>
              </div>

              <div class="card" style="padding:var(--spacing-md); overflow-y:auto; max-height:380px;">
                <div class="section-title" style="margin-bottom:12px;">Detail Evaluasi SLA per Perangkat</div>
                <div id="sla-device-list">
                  ${renderSLAList('24h', 'all')}
                </div>
              </div>
            </div>
          </div>

          <!-- TAB: INSIDEN -->
          <div class="tab-content ${activeTab === 'insiden' ? 'active' : ''}" id="tab-content-insiden">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
              <div style="font-size:1rem; font-weight:700; color:var(--color-heading);">Laporan Riwayat Insiden</div>
              <div style="display:flex; gap:8px;">
                <select class="form-control" id="insiden-filter" style="width:auto;">
                  <option value="all">Semua Status</option>
                  <option value="aktif">Sedang Berlangsung</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>
            </div>

            <!-- Stats -->
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px; margin-bottom:20px;">
              <div class="report-summary-card">
                <span style="font-size:1.5rem;">⚡</span>
                <div>
                  <div class="stat-value text-offline">${liveIncidents.length}</div>
                  <div style="font-size:0.78rem; color:var(--color-muted);">Total Insiden</div>
                </div>
              </div>
              <div class="report-summary-card">
                <span style="font-size:1.5rem;">🔴</span>
                <div>
                  <div class="stat-value text-offline">${liveIncidents.filter((i) => !i.waktu_selesai).length}</div>
                  <div style="font-size:0.78rem; color:var(--color-muted);">Aktif Sekarang</div>
                </div>
              </div>
              <div class="report-summary-card">
                <span style="font-size:1.5rem;">✅</span>
                <div>
                  <div class="stat-value text-online">${liveIncidents.filter((i) => i.waktu_selesai).length}</div>
                  <div style="font-size:0.78rem; color:var(--color-muted);">Insiden Selesai</div>
                </div>
              </div>
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

function renderSLAList(period, grup) {
  const fieldMap = { '24h': 'uptime24h', '7d': 'uptime7d', '30d': 'uptime30d' };
  const field = fieldMap[period] || 'uptime24h';

  let data = liveSla;
  if (grup !== 'all') data = data.filter((d) => d.grup === grup);
  data = [...data].sort((a, b) => (b[field] || 0) - (a[field] || 0));

  if (data.length === 0) {
    return `<div class="empty-state" style="padding:20px;"><div class="empty-icon">📊</div><div class="empty-title">Tidak ada data SLA</div></div>`;
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
          <div style="font-size:0.72rem; color:var(--color-muted);">${d.ip} · Target: ${target}% · ${d.grup || 'Umum'}</div>
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

function renderInsidenList(filter) {
  let data = liveIncidents;
  if (filter === 'aktif') data = data.filter((i) => !i.waktu_selesai);
  if (filter === 'selesai') data = data.filter((i) => i.waktu_selesai);

  if (data.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Tidak ada insiden tercatat</div><div class="empty-desc">Seluruh perangkat berjalan lancar</div></div>`;
  }

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Perangkat</th>
            <th>Waktu Mulai</th>
            <th>Waktu Selesai</th>
            <th>Durasi</th>
            <th>Status</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((inc) => {
            const isAktif = !inc.waktu_selesai;
            return `
              <tr class="${isAktif ? 'log-offline' : ''}">
                <td>
                  <div style="font-weight:600; color:var(--color-heading);">${inc.device_nama || inc.device || 'Perangkat'}</div>
                  <div class="ip-text">${inc.device_ip || inc.ip || ''}</div>
                </td>
                <td style="font-size:0.8rem; color:var(--color-muted); white-space:nowrap;">
                  ${formatDateWithTz(inc.waktu_mulai || inc.mulai)}
                </td>
                <td style="font-size:0.8rem; color:var(--color-muted); white-space:nowrap;">
                  ${inc.waktu_selesai ? formatDateWithTz(inc.waktu_selesai) : '—'}
                </td>
                <td>
                  ${inc.durasi_menit ? `<span class="chip">⏱️ ${inc.durasi_menit} mnt</span>` : (isAktif ? '<span style="color:var(--color-offline); font-weight:700; font-size:0.8rem;">Aktif</span>' : '—')}
                </td>
                <td>
                  <span class="badge ${isAktif ? 'badge-offline' : 'badge-neutral'}">
                    ${isAktif ? '🔴 Aktif' : '⚫ Selesai'}
                  </span>
                </td>
                <td style="font-size:0.82rem; color:var(--color-text-secondary); max-width:250px;">${inc.penyebab || inc.keterangan || 'Gangguan konektivitas'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function initReportsEvents() {
  fetchLiveReports().then(() => {
    const list = document.getElementById('sla-device-list');
    if (list) list.innerHTML = renderSLAList('24h', 'all');
    const incList = document.getElementById('insiden-list');
    if (incList) incList.innerHTML = renderInsidenList('all');
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

      if (activeTab === 'mingguan') initWeeklyCharts();
      if (activeTab === 'sla') initSLACharts();
    });
  });

  // Archive selector
  document.getElementById('weekly-archive-select')?.addEventListener('change', async (e) => {
    selectedArchiveId = e.target.value;
    const archId = selectedArchiveId === 'current' ? null : selectedArchiveId;
    await fetchLiveReports(archId);

    const sub = document.getElementById('weekly-period-subtitle');
    if (sub && liveWeekly) sub.innerText = `Periode: ${liveWeekly.periode}`;

    initWeeklyCharts();
  });

  // Manual Snapshot button
  document.getElementById('btn-save-weekly-snapshot')?.addEventListener('click', async () => {
    try {
      Swal.showLoading();
      await apiSaveWeeklySnapshot();
      await fetchLiveReports();
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

  // SLA filters
  document.getElementById('sla-period-select')?.addEventListener('change', () => {
    const period = document.getElementById('sla-period-select').value;
    const grup = document.getElementById('sla-grup-select').value;
    const list = document.getElementById('sla-device-list');
    if (list) list.innerHTML = renderSLAList(period, grup);
    const fieldMap = { '24h': 'uptime24h', '7d': 'uptime7d', '30d': 'uptime30d' };
    renderUptimeBar('sla-uptime-chart', liveSla, fieldMap[period]);
  });

  document.getElementById('sla-grup-select')?.addEventListener('change', () => {
    const period = document.getElementById('sla-period-select').value;
    const grup = document.getElementById('sla-grup-select').value;
    const list = document.getElementById('sla-device-list');
    if (list) list.innerHTML = renderSLAList(period, grup);
  });

  // Insiden filter
  document.getElementById('insiden-filter')?.addEventListener('change', (e) => {
    const list = document.getElementById('insiden-list');
    if (list) list.innerHTML = renderInsidenList(e.target.value);
  });

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

function initSLACharts() {
  setTimeout(() => {
    renderUptimeBar('sla-uptime-chart', liveSla, 'uptime24h');
  }, 100);
}
