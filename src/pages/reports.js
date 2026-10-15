// ================================================================
// DevWatch — reports.js
// Laporan: mingguan, uptime/SLA, insiden, export PDF
// ================================================================

import Swal from 'sweetalert2';
import { uptimePerDevice, insiden, weeklyReport } from '../data/mock-reports.js';
import { renderWeeklyTrend, renderUptimeBar, renderIncidentBar } from '../components/charts.js';
import { simulatePdfExport } from './logs.js';

let activeTab = 'mingguan';

export function renderReports() {
  const { ringkasan, periode } = weeklyReport;

  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">📈 Laporan</h1>
          <p class="page-subtitle">Uptime, SLA tracker, dan laporan insiden</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="report-export-btn">📄 Export PDF</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <div class="tabs-nav">
          <button class="tab-btn active" data-tab="mingguan">📅 Laporan Mingguan</button>
          <button class="tab-btn" data-tab="sla">📊 Uptime / SLA</button>
          <button class="tab-btn" data-tab="insiden">⚡ Laporan Insiden</button>
        </div>

        <div style="
          background:var(--bg-card); border:1px solid var(--border-color);
          border-radius:0 var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg);
          padding:var(--spacing-lg);
        ">
          <!-- TAB: MINGGUAN -->
          <div class="tab-content active" id="tab-content-mingguan">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
              <div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-heading);">Laporan Mingguan Otomatis</div>
                <div style="font-size:0.8rem; color:var(--color-muted);">Periode: ${periode}</div>
              </div>
              <span class="badge badge-online">✅ Tersedia</span>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;">
              ${[
                { label: 'Total Device', val: ringkasan.totalDevice, icon: '📡', color: 'var(--color-accent)' },
                { label: 'Rata-rata Uptime', val: ringkasan.rataUptimeOnline + '%', icon: '📊', color: 'var(--color-online)' },
                { label: 'Total Insiden', val: ringkasan.totalInsiden, icon: '⚡', color: 'var(--color-offline)' },
                { label: 'Total Downtime', val: ringkasan.totalDowntimeJam + ' jam', icon: '⏱️', color: 'var(--color-maintenance)' },
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
                <div class="section-title" style="margin-bottom:8px;">🏆 Device Terbaik</div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-online);">${ringkasan.deviceTerbaikUptime}</div>
                <div style="font-size:0.8rem; color:var(--color-muted);">Uptime terbaik minggu ini</div>
              </div>
              <div class="card">
                <div class="section-title" style="margin-bottom:8px;">⚠️ Perlu Perhatian</div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-offline);">${ringkasan.deviceTerburuUptime}</div>
                <div style="font-size:0.8rem; color:var(--color-muted);">Uptime terendah minggu ini</div>
              </div>
            </div>
          </div>

          <!-- TAB: SLA -->
          <div class="tab-content" id="tab-content-sla">
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
                  ${[...new Set(uptimePerDevice.map((u) => u.grup))].map((g) => `<option value="${g}">${g}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="two-col">
              <!-- Chart -->
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

              <!-- SLA List -->
              <div class="card" style="padding:var(--spacing-md); overflow-y:auto; max-height:380px;">
                <div class="section-title" style="margin-bottom:12px;">Detail SLA per Device</div>
                <div id="sla-device-list">
                  ${renderSLAList('24h', 'all')}
                </div>
              </div>
            </div>
          </div>

          <!-- TAB: INSIDEN -->
          <div class="tab-content" id="tab-content-insiden">
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
                  <div style="font-size:1.5rem; font-weight:800; color:var(--color-offline);">${insiden.length}</div>
                  <div style="font-size:0.78rem; color:var(--color-muted);">Total Insiden</div>
                </div>
              </div>
              <div class="report-summary-card">
                <span style="font-size:1.5rem;">🔴</span>
                <div>
                  <div style="font-size:1.5rem; font-weight:800; color:var(--color-offline);">${insiden.filter((i) => i.status === 'Sedang berlangsung').length}</div>
                  <div style="font-size:0.78rem; color:var(--color-muted);">Aktif Sekarang</div>
                </div>
              </div>
              <div class="report-summary-card">
                <span style="font-size:1.5rem;">✅</span>
                <div>
                  <div style="font-size:1.5rem; font-weight:800; color:var(--color-online);">${insiden.filter((i) => i.status === 'Selesai').length}</div>
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

  let data = uptimePerDevice;
  if (grup !== 'all') data = data.filter((d) => d.grup === grup);
  data = [...data].sort((a, b) => a[field] - b[field]);

  return data.map((d) => {
    const val = d[field];
    const badgeClass = val >= 99 ? 'high' : val >= 95 ? 'medium' : 'low';
    const met = val >= d.slaTarget;

    return `
      <div class="sla-device-row">
        <div class="sla-device-name">
          <div style="font-weight:600; font-size:0.85rem; color:var(--color-text);">${d.nama}</div>
          <div style="font-size:0.72rem; color:var(--color-muted);">Target SLA: ${d.slaTarget}% · ${d.grup}</div>
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
  let data = insiden;
  if (filter === 'aktif') data = data.filter((i) => i.status === 'Sedang berlangsung');
  if (filter === 'selesai') data = data.filter((i) => i.status === 'Selesai');

  if (data.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Tidak ada insiden ditemukan</div></div>`;
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
          ${data.map((inc) => `
            <tr class="${inc.status === 'Sedang berlangsung' ? 'log-offline' : ''}">
              <td>
                <div style="font-weight:600; color:var(--color-heading);">${inc.device}</div>
                <div class="ip-text">${inc.ip}</div>
              </td>
              <td style="font-size:0.8rem; color:var(--color-muted); white-space:nowrap;">
                ${new Date(inc.mulai).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
              </td>
              <td style="font-size:0.8rem; color:var(--color-muted); white-space:nowrap;">
                ${inc.selesai ? new Date(inc.selesai).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}
              </td>
              <td>
                ${inc.durasi ? `<span class="chip">⏱️ ${inc.durasi}</span>` : '<span style="color:var(--color-offline); font-weight:700; font-size:0.8rem;">Aktif</span>'}
              </td>
              <td>
                <span class="badge ${inc.status === 'Sedang berlangsung' ? 'badge-offline' : 'badge-neutral'}">
                  ${inc.status === 'Sedang berlangsung' ? '🔴 Aktif' : '⚫ Selesai'}
                </span>
              </td>
              <td style="font-size:0.82rem; color:var(--color-text-secondary); max-width:250px;">${inc.penyebab}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function initReportsEvents() {
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
    renderUptimeBar('sla-uptime-chart', uptimePerDevice, fieldMap[period]);
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
    simulatePdfExport('laporan-' + activeTab, 20);
  });

  // Init active tab charts
  initWeeklyCharts();
}

function initWeeklyCharts() {
  setTimeout(() => {
    renderWeeklyTrend('weekly-trend-chart', weeklyReport.harian);
    renderIncidentBar('weekly-incident-chart', weeklyReport.harian);
  }, 100);
}

function initSLACharts() {
  setTimeout(() => {
    renderUptimeBar('sla-uptime-chart', uptimePerDevice, 'uptime24h');
  }, 100);
}
