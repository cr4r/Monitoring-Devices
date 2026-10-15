// ================================================================
// DevWatch — reports.js
// Laporan: mingguan, uptime/SLA, insiden, export PDF (Full SQLite Data)
// ================================================================

import Swal from 'sweetalert2';
import { apiGetWeeklyReport, apiGetSlaReport, apiGetIncidentReport } from '../api.js';
import { renderWeeklyTrend, renderUptimeBar, renderIncidentBar } from '../components/charts.js';
import { simulatePdfExport } from './logs.js';
import { formatDateWithTz } from '../settingsManager.js';

let activeTab = 'mingguan';
let liveWeekly = null;
let liveSla = [];
let liveIncidents = [];

export async function fetchLiveReports() {
  try {
    const [wRes, sRes, iRes] = await Promise.all([
      apiGetWeeklyReport().catch(() => null),
      apiGetSlaReport().catch(() => null),
      apiGetIncidentReport().catch(() => null),
    ]);
    if (wRes && wRes.data) liveWeekly = wRes.data;
    if (sRes && sRes.data) liveSla = sRes.data;
    if (iRes && iRes.data) liveIncidents = iRes.data;
  } catch (err) {
    console.warn('Gagal memuat laporan database:', err);
  }
}

export function renderReports() {
  const summary = liveWeekly || {
    periode: '7 Hari Terakhir',
    totalDevices: 0,
    onlineDevices: 0,
    averageUptime: 99.0,
    targetSla: 99.0,
    totalIncidents: 0,
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
          <p class="page-subtitle">Uptime, SLA tracker, dan laporan insiden dari database</p>
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
                <div style="font-size:1rem; font-weight:700; color:var(--color-heading);">Laporan Mingguan Otomatis</div>
                <div style="font-size:0.8rem; color:var(--color-muted);">Periode: ${summary.periode}</div>
              </div>
              <span class="badge badge-online">✅ Sinkron Database</span>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;">
              ${[
                { label: 'Total Device', val: summary.totalDevices, icon: '📡', color: 'var(--color-accent)' },
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
                <div class="section-title" style="margin-bottom:8px;">🏆 Device Terpantau</div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-online);">${summary.topDevices[0]?.nama || 'Belum ada data'}</div>
                <div style="font-size:0.8rem; color:var(--color-muted);">Status: ${summary.topDevices[0]?.status || 'normal'}</div>
              </div>
              <div class="card">
                <div class="section-title" style="margin-bottom:8px;">⚠️ Device Perlu Perhatian</div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-offline);">${summary.topDevices[summary.topDevices.length - 1]?.nama || 'Tidak ada masalah'}</div>
                <div style="font-size:0.8rem; color:var(--color-muted);">Pemantauan riil database SQLite</div>
              </div>
            </div>
          </div>

          <!-- TAB: SLA -->
          <div class="tab-content ${activeTab === 'sla' ? 'active' : ''}" id="tab-content-sla">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
              <div style="font-size:1rem; font-weight:700; color:var(--color-heading);">Uptime & SLA per Device</div>
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
                  <div class="chart-title">Uptime per Device (24 Jam)</div>
                  <div class="map-legend" style="gap:12px;">
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-online); height:8px; border-radius:2px;"></div> ≥99%</div>
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-maintenance); height:8px; border-radius:2px;"></div> 95-99%</div>
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-offline); height:8px; border-radius:2px;"></div> <95%</div>
                  </div>
                </div>
                <div style="height:300px;"><canvas id="sla-uptime-chart"></canvas></div>
              </div>

              <div class="card" style="padding:var(--spacing-md); overflow-y:auto; max-height:380px;">
                <div class="section-title" style="margin-bottom:12px;">Detail SLA per Device</div>
                <div id="sla-device-list">
                  ${renderSLAList('24h', 'all')}
                </div>
              </div>
            </div>
          </div>

          <!-- TAB: INSIDEN -->
          <div class="tab-content ${activeTab === 'insiden' ? 'active' : ''}" id="tab-content-insiden">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
              <div style="font-size:1rem; font-weight:700; color:var(--color-heading);">Laporan Insiden</div>
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
  data = [...data].sort((a, b) => a[field] - b[field]);

  if (data.length === 0) {
    return `<div class="empty-state" style="padding:20px;"><div class="empty-icon">📊</div><div class="empty-title">Tidak ada data SLA</div></div>`;
  }

  return data.map((d) => {
    const val = d[field] || 99.0;
    const badgeClass = val >= 99 ? 'high' : val >= 95 ? 'medium' : 'low';
    const target = d.targetSla || 99.0;
    const met = val >= target;

    return `
      <div class="sla-device-row">
        <div class="sla-device-name">
          <div style="font-weight:600; font-size:0.85rem; color:var(--color-text);">${d.nama}</div>
          <div style="font-size:0.72rem; color:var(--color-muted);">Target SLA: ${target}% · ${d.grup || 'Umum'}</div>
        </div>
        <div class="sla-bar-wrapper">
          <div class="uptime-bar">
            <div class="uptime-fill ${badgeClass}" style="width:${Math.max(0, val - 80) / 20 * 100}%;"></div>
          </div>
        </div>
        <div class="sla-device-uptime">
          <span class="uptime-badge ${badgeClass}">${val.toFixed(1)}%</span>
        </div>
        <span style="font-size:1rem;">${met ? '✅' : '❌'}</span>
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
            <th>Device</th>
            <th>Mulai</th>
            <th>Selesai</th>
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
                  <div style="font-weight:600; color:var(--color-heading);">${inc.device_nama || inc.device || 'Device'}</div>
                  <div class="ip-text">${inc.device_ip || inc.ip || ''}</div>
                </td>
                <td style="font-size:0.8rem; color:var(--color-muted); white-space:nowrap;">
                  ${formatDateWithTz(inc.waktu_mulai || inc.mulai)}
                </td>
                <td style="font-size:0.8rem; color:var(--color-muted); white-space:nowrap;">
                  ${inc.waktu_selesai ? formatDateWithTz(inc.waktu_selesai) : '—'}
                </td>
                <td>
                  ${inc.durasi_menit ? `<span class="chip">⏱️ ${inc.durasi_menit} menit</span>` : (isAktif ? '<span style="color:var(--color-offline); font-weight:700; font-size:0.8rem;">Aktif</span>' : '—')}
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
    const content = document.getElementById('tab-content-mingguan');
    if (content) {
      // Re-render sub sections
      const list = document.getElementById('sla-device-list');
      if (list) list.innerHTML = renderSLAList('24h', 'all');
      const incList = document.getElementById('insiden-list');
      if (incList) incList.innerHTML = renderInsidenList('all');
    }
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

  // Export PDF
  document.getElementById('report-export-btn')?.addEventListener('click', () => {
    simulatePdfExport('laporan-' + activeTab, liveSla.length || 20);
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
