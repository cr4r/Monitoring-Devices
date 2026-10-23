// ================================================================
// DevWatch — dashboard.js
// Dashboard utama: stats, card view, network map, grafik timeline
// ================================================================

import Swal from 'sweetalert2';
import { navigate } from '../router.js';
import { mockDevices, getStatusCounts, getGroups, updateDeviceStatus, syncDevicesFromApi, cleanDeviceIp, parseSqliteUtc, formatTimeAgo } from '../data/mock-devices.js';
import { apiPingDevice, apiSetMaintenance, apiFinishMaintenance, apiGetDevice, apiPingAllDevices } from '../api.js';
import { renderTimeline24h, renderAggregateTimeline, destroyAllCharts } from '../components/charts.js';
import { getTimeline24h } from '../data/mock-reports.js';
import { getSession } from '../main.js';
import { exportReportPdf } from '../services/pdfService.js';
import { getAppSetting } from '../settingsManager.js';
import { showDeviceForm } from './devices.js';

let currentNavigate = null;
let currentFilter = { kategori: 'all', status: 'all', grup: 'all', search: '' };
let currentTab = 'kartu';
let cardGroupMode = 'grup'; // 'grup' | 'jenis' | 'none'
let collapsedGroups = new Set();

function parseIpOctets(ipStr = '') {
  const clean = cleanDeviceIp(ipStr);
  const match = clean.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10), parseInt(match[4], 10)];
}

function compareDeviceIps(ipA = '', ipB = '') {
  const octA = parseIpOctets(ipA);
  const octB = parseIpOctets(ipB);
  if (octA && octB) {
    for (let i = 0; i < 4; i++) {
      if (octA[i] !== octB[i]) return octA[i] - octB[i];
    }
    return 0;
  }
  if (octA && !octB) return -1;
  if (!octA && octB) return 1;
  return cleanDeviceIp(ipA).localeCompare(cleanDeviceIp(ipB));
}
let canvasCtx = null;
let mapTransform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let lastMouse = { x: 0, y: 0 };
let mapAnimId = null;
let draggedNode = null;
let dragStartMouse = { x: 0, y: 0 };
let isNodeMoved = false;
let customNodePositions = {};
let virtualNodes = [];
let mapSearchQuery = '';
let wanNode = null;
let interRouterLinks = [];
let mapFilterGroup = 'all';
let mapFilterJenis = 'all';
let groupBoundaries = [];

export function renderDashboard() {
  const counts = getStatusCounts();
  const groups = getGroups();

  const uptimePct = Math.round((counts.online / counts.total) * 100);

  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">📊 Dashboard</h1>
          <p class="page-subtitle">Status real-time semua device jaringan kantor</p>
        </div>
        <div class="page-actions">
          <div class="live-indicator" id="monitoring-engine-indicator" title="${getAppSetting('engine_active', 'true') === 'true' ? 'Engine monitoring aktif memantau perangkat' : 'Engine monitoring dihentikan sementara di pengaturan'}">
            <span class="live-dot" id="monitoring-engine-dot" style="${getAppSetting('engine_active', 'true') === 'true' ? '' : 'background:#eab308; box-shadow:none;'}"></span>
            <span id="monitoring-engine-text" style="font-size:0.8rem; font-weight:600; color:${getAppSetting('engine_active', 'true') === 'true' ? 'var(--color-online)' : '#eab308'};">
              ${getAppSetting('engine_active', 'true') === 'true' ? 'LIVE' : 'PAUSED'}
            </span>
          </div>
          <button class="btn btn-secondary btn-sm" id="ping-all-btn" title="Ping serentak seluruh perangkat">📡 Ping All</button>
          <button class="btn btn-secondary btn-sm" id="refresh-btn" title="Muat ulang & verifikasi koneksi seluruh perangkat">🔄 Refresh</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card total" data-stat-type="total" role="button" tabindex="0" title="Klik untuk rincian inventaris total perangkat">
          <div class="stat-icon total">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
          </div>
          <div class="stat-info">
            <div class="stat-value" id="stat-total-val">${counts.total}</div>
            <div class="stat-label">Total Device</div>
            <div class="stat-sub">Inventaris terpantau</div>
            <div class="stat-card-hint"><span>Rincian inventaris</span> ➔</div>
          </div>
        </div>
        <div class="stat-card online-stat" data-stat-type="online" role="button" tabindex="0" title="Klik untuk rincian performa node online & latensi">
          <div class="stat-icon online-stat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
          </div>
          <div class="stat-info">
            <div class="stat-value text-online" id="stat-online-val">${counts.online}</div>
            <div class="stat-label">Online</div>
            <div class="stat-sub" id="stat-uptime-sub">${uptimePct}% dari total</div>
            <div class="stat-card-hint"><span>Telemetri & SLA</span> ➔</div>
          </div>
        </div>
        <div class="stat-card offline-stat" data-stat-type="offline" role="button" tabindex="0" title="Klik untuk rincian diagnostik perangkat offline">
          <div class="stat-icon offline-stat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          </div>
          <div class="stat-info">
            <div class="stat-value text-offline" id="stat-offline-val">${counts.offline}</div>
            <div class="stat-label">Offline</div>
            <div class="stat-sub">Perlu perhatian</div>
            <div class="stat-card-hint" style="color:var(--color-offline);"><span>Diagnostik</span> ➔</div>
          </div>
        </div>
        <div class="stat-card maintenance-stat" data-stat-type="maintenance" role="button" tabindex="0" title="Klik untuk rincian jadwal pemeliharaan">
          <div class="stat-icon maintenance-stat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          </div>
          <div class="stat-info">
            <div class="stat-value text-maintenance" id="stat-maint-val">${counts.maintenance}</div>
            <div class="stat-label">Maintenance</div>
            <div class="stat-sub">Mode terjadwal</div>
            <div class="stat-card-hint" style="color:var(--color-maintenance);"><span>Jadwal servis</span> ➔</div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <div class="tabs-nav">
          <button class="tab-btn ${currentTab === 'kartu' ? 'active' : ''}" data-tab="kartu" id="tab-kartu">
            🃏 Tampilan Kartu
          </button>
          <button class="tab-btn ${currentTab === 'peta' ? 'active' : ''}" data-tab="peta" id="tab-peta">
            🗺️ Peta Visual
          </button>
          <button class="tab-btn ${currentTab === 'timeline' ? 'active' : ''}" data-tab="timeline" id="tab-timeline">
            📉 Grafik Timeline
          </button>
        </div>

        <div class="dashboard-tabs-panel">
          <!-- TAB: KARTU -->
          <div class="tab-content ${currentTab === 'kartu' ? 'active' : ''}" id="tab-content-kartu">
            <!-- Filter -->
            <div class="dashboard-filter-row">
              <div class="search-input-wrapper" style="flex:1; min-width:200px; max-width:360px;">
                <span class="search-icon">🔍</span>
                <input
                  type="text"
                  class="form-control"
                  id="dashboard-search"
                  placeholder="Cari nama device atau IP address..."
                  value="${currentFilter.search}"
                />
              </div>

              <select class="form-control" id="filter-kategori" style="width:auto;">
                <option value="all" ${currentFilter.kategori === 'all' ? 'selected' : ''}>Semua Jenis</option>
                <option value="komputer" ${currentFilter.kategori === 'komputer' ? 'selected' : ''}>💻 Komputer</option>
                <option value="router" ${currentFilter.kategori === 'router' ? 'selected' : ''}>🌐 Router / Gateway</option>
                <option value="switch" ${currentFilter.kategori === 'switch' ? 'selected' : ''}>🔀 Switch / Hub</option>
                <option value="server" ${currentFilter.kategori === 'server' ? 'selected' : ''}>🖥️ Server</option>
                <option value="access point" ${['access point', 'ap'].includes(currentFilter.kategori) ? 'selected' : ''}>📶 Access Point</option>
                <option value="cctv" ${currentFilter.kategori === 'cctv' ? 'selected' : ''}>📷 CCTV Hikvision</option>
              </select>

              <select class="form-control" id="filter-status" style="width:auto;">
                <option value="all" ${currentFilter.status === 'all' ? 'selected' : ''}>Semua Status</option>
                <option value="online" ${currentFilter.status === 'online' ? 'selected' : ''}>🟢 Online</option>
                <option value="offline" ${currentFilter.status === 'offline' ? 'selected' : ''}>🔴 Offline</option>
                <option value="maintenance" ${currentFilter.status === 'maintenance' ? 'selected' : ''}>🟡 Maintenance</option>
              </select>

              <select class="form-control" id="filter-grup" style="width:auto;">
                <option value="all">Semua Grup</option>
                ${groups.map((g) => `<option value="${g}" ${currentFilter.grup === g ? 'selected' : ''}>${g}</option>`).join('')}
              </select>

              <select class="form-control" id="filter-group-mode" style="width:auto; font-weight:600;" title="Pengelompokan Kartu">
                <option value="grup" ${cardGroupMode === 'grup' ? 'selected' : ''}>📁 Kelompokkan: Per Kantor</option>
                <option value="jenis" ${cardGroupMode === 'jenis' ? 'selected' : ''}>🏷️ Kelompokkan: Per Tipe Device</option>
                <option value="none" ${cardGroupMode === 'none' ? 'selected' : ''}>📋 Semua (Tanpa Kelompok)</option>
              </select>

              <div class="group-collapse-controls" id="group-collapse-controls" style="display:${cardGroupMode !== 'none' ? 'inline-flex' : 'none'}; align-items:center; gap:6px;">
                <button type="button" class="btn btn-secondary btn-sm" id="btn-expand-all-groups" title="Buka Seluruh Grup" style="padding:6px 10px; font-size:0.78rem; white-space:nowrap;">
                  📂 Buka Semua
                </button>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-collapse-all-groups" title="Tutup Seluruh Grup" style="padding:6px 10px; font-size:0.78rem; white-space:nowrap;">
                  📁 Tutup Semua
                </button>
              </div>
            </div>

            <div class="device-count-chip" id="device-count-display">
              Menampilkan <strong>${mockDevices.length}</strong> device
            </div>

            <div class="devices-grid" id="devices-grid" style="margin-top:12px;">
              ${renderDeviceCards()}
            </div>
          </div>

          <!-- TAB: PETA -->
          <div class="tab-content ${currentTab === 'peta' ? 'active' : ''}" id="tab-content-peta">
            <div class="network-map-wrapper">
              <div class="network-map-toolbar">
                <div class="map-toolbar-group">
                  <button class="btn btn-secondary btn-sm" id="map-zoom-in" title="Perbesar Tampilan">🔍+</button>
                  <button class="btn btn-secondary btn-sm" id="map-zoom-out" title="Perkecil Tampilan">🔍−</button>
                  <button class="btn btn-secondary btn-sm" id="map-fit-screen" title="Paskan Seluruh Perangkat ke Layar">🎯 Fit</button>
                  <button class="btn btn-secondary btn-sm" id="map-reset" title="Reset Posisi & Zoom 100%">↺ Reset</button>
                  <button class="btn btn-secondary btn-sm" id="map-auto-layout" title="Tata Ulang Hierarki Otomatis">📐 Tata Ulang</button>
                  <button class="btn btn-secondary btn-sm" id="map-fullscreen" title="Layar Penuh">⛶ Layar Penuh</button>
                </div>

                <div class="map-toolbar-group">
                  <div class="map-search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="map-search-input" placeholder="Cari nama / IP..." />
                  </div>
                  <select class="form-control" id="map-filter-group" style="width:auto; font-size:0.78rem; padding:4px 8px; border-radius:6px; height:32px; font-weight:600; cursor:pointer;" title="Filter Berdasarkan Lokasi / Kantor">
                    <option value="all">📍 Semua Lokasi (${mockDevices.length})</option>
                    ${groups.map((g) => {
                      const count = mockDevices.filter((d) => (d.grup || 'Umum') === g).length;
                      return `<option value="${g}" ${mapFilterGroup === g ? 'selected' : ''}>📍 ${g} (${count})</option>`;
                    }).join('')}
                  </select>
                  <select class="form-control" id="map-filter-jenis" style="width:auto; font-size:0.78rem; padding:4px 8px; border-radius:6px; height:32px; font-weight:600; cursor:pointer;" title="Filter Berdasarkan Tipe Perangkat">
                    <option value="all" ${mapFilterJenis === 'all' ? 'selected' : ''}>🏷️ Semua Tipe</option>
                    <option value="cctv" ${mapFilterJenis === 'cctv' ? 'selected' : ''}>📷 CCTV (${mockDevices.filter((d) => String(d.jenis || '').toLowerCase().includes('cctv')).length})</option>
                    <option value="infra" ${mapFilterJenis === 'infra' ? 'selected' : ''}>🌐 Jaringan (${mockDevices.filter((d) => ['router', 'switch', 'gateway', 'access point', 'ap'].some((k) => String(d.jenis || '').toLowerCase().includes(k))).length})</option>
                    <option value="komputer" ${mapFilterJenis === 'komputer' ? 'selected' : ''}>💻 Komputer (${mockDevices.filter((d) => String(d.jenis || '').toLowerCase().includes('komputer')).length})</option>
                  </select>
                </div>

                <div class="map-toolbar-group">
                  <div class="map-legend">
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:#0284c7; border-radius:3px;"></div> ☁️ WAN</div>
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:#a855f7; border-radius:3px;"></div> ⚡ Trunk</div>
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-online);"></div> Online</div>
                    <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-offline);"></div> Offline</div>
                  </div>
                  <span class="badge" id="map-node-count-badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc; border:1px solid rgba(99,102,241,0.4); font-size:0.75rem; padding:3px 8px; border-radius:6px;">
                    ${mockDevices.length} Devices
                  </span>
                </div>
              </div>
              <div class="canvas-container" style="position:relative; width:100%; height:580px; overflow:hidden; border-radius:8px;">
                <canvas id="networkCanvas" width="960" height="580" style="width:100%; height:100%;"></canvas>
                <div id="map-tooltip" style="position:absolute; display:none; pointer-events:none; z-index:20; background:rgba(15,23,42,0.94); backdrop-filter:blur(8px); border:1px solid rgba(99,102,241,0.5); border-radius:8px; padding:8px 12px; font-size:0.78rem; color:#f1f5f9; box-shadow:0 10px 25px -5px rgba(0,0,0,0.6);"></div>
              </div>
            </div>
          </div>

          <!-- TAB: TIMELINE -->
          <div class="tab-content ${currentTab === 'timeline' ? 'active' : ''}" id="tab-content-timeline">
            <!-- Global Aggregate Timeline -->
            <div class="chart-container" style="margin-bottom:20px;">
              <div class="chart-header">
                <div>
                  <div class="chart-title">🌐 Tren Global Status Perangkat (24 Jam Terakhir)</div>
                  <div class="chart-subtitle" style="font-size:0.78rem; color:var(--color-muted);">Distribusi seluruh perangkat online vs offline per jam</div>
                </div>
              </div>
              <div style="height:250px;">
                <canvas id="aggregate-timeline-chart"></canvas>
              </div>
            </div>

            <!-- Per-Device Timeline -->
            <div class="chart-container">
              <div class="chart-header" style="flex-wrap:wrap; gap:10px;">
                <div>
                  <div class="chart-title">📉 Respons & Status per Perangkat (24 Jam)</div>
                  <div class="chart-subtitle" style="font-size:0.78rem; color:var(--color-muted);">Visualisasi latency koneksi (ms) dan deteksi offline</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <label class="form-label" style="margin:0; font-size:0.8rem;">Pilih Perangkat:</label>
                  <select class="form-control timeline-device-select" id="timeline-device-select" style="width:auto; min-width:240px; font-size:0.82rem; padding:4px 10px;">
                    ${mockDevices.length > 0 ? mockDevices.map((d) => {
    const icon = d.status === 'online' ? '🟢' : d.status === 'maintenance' ? '🟡' : '🔴';
    const statusText = d.status === 'online' ? 'Online' : d.status === 'maintenance' ? 'Maintenance' : 'Offline';
    const displayIp = cleanDeviceIp(d.ip);
    return `<option value="${d.id}">${icon} ${d.nama} (${displayIp}) — ${statusText}</option>`;
  }).join('') : '<option value="">(Belum ada perangkat terdaftar)</option>'}
                  </select>
                </div>
              </div>
              <div style="height:260px;">
                <canvas id="timeline-chart"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSingleDeviceCard(d, canEdit) {
  const statusColor = {
    online: 'var(--color-online)',
    offline: 'var(--color-offline)',
    maintenance: 'var(--color-maintenance)',
  }[d.status];

  const statusLabel = { online: '🟢 Online', offline: '🔴 Offline', maintenance: '🟡 Maintenance' }[d.status];
  const icon = getNodeIcon(d.jenis);

  const checkDate = d.lastChecked ? parseSqliteUtc(d.lastChecked) : null;
  const lastChecked = d.lastChecked ? formatTimeAgo(d.lastChecked) : 'Belum dicek';
  const exactCheck = checkDate ? checkDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Belum pernah dicek';

  const onlineDate = d.lastOnline ? parseSqliteUtc(d.lastOnline) : null;
  const lastOnline = d.lastOnline ? formatTimeAgo(d.lastOnline) : 'Tidak diketahui';
  const exactOnline = onlineDate ? onlineDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Tidak diketahui';

  const countdownHtml = d.status === 'maintenance' && d.maintenanceInfo
    ? `<div class="maintenance-countdown">⏱️ <span class="countdown-timer" data-end="${d.maintenanceInfo.estimasiSelesai}">Menghitung...</span></div>`
    : '';

  return `
    <div class="device-card ${d.status} fade-in-up" data-device-id="${d.id}">
      <div class="device-card-header">
        <div class="device-card-icon ${d.jenis}">${icon}</div>
        <div style="flex:1; min-width:0;">
          <div class="device-card-name truncate">${d.nama}</div>
          <div class="device-card-ip" title="${d.ip}">${cleanDeviceIp(d.ip)}</div>
        </div>
        <div class="badge badge-${d.status || 'offline'}" style="flex-shrink:0;">
          <span class="status-dot ${d.status || 'offline'}"></span>
          ${(d.status || 'offline').charAt(0).toUpperCase() + (d.status || 'offline').slice(1)}
        </div>
      </div>

      <div class="device-card-meta">
        <div class="device-card-meta-row">
          <span class="device-card-meta-label">📍 Lokasi:</span>
          <span class="truncate">${d.lokasi}</span>
        </div>
        <div class="device-card-meta-row">
          <span class="device-card-meta-label">📁 Grup:</span>
          <span>${d.grup}</span>
        </div>
        <div class="device-card-meta-row">
          <span class="device-card-meta-label">⏱️ Last Check:</span>
          <span title="${exactCheck}" style="cursor:help; font-weight:600; color:var(--color-heading);">${lastChecked}</span>
        </div>
        <div class="device-card-meta-row">
          <span class="device-card-meta-label">🟢 Last Online:</span>
          <span title="${exactOnline}" style="cursor:help;">${d.status === 'online' ? 'Sekarang' : lastOnline}</span>
        </div>
        ${d.status === 'online' ? `
        <div class="device-card-meta-row">
          <span class="device-card-meta-label">📶 Response:</span>
          <span class="text-online">${d.responseTime} ms</span>
        </div>` : ''}
      </div>

      ${countdownHtml}

      ${d.status === 'maintenance' && d.maintenanceInfo ? `
      <div style="font-size:0.75rem; color:var(--color-maintenance); padding:6px 8px; background:var(--color-maintenance-dim); border-radius:6px; border:1px solid rgba(234,179,8,0.2);">
        🔧 ${d.maintenanceInfo.alasan}
      </div>` : ''}

      <div class="device-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="window.dashboardDetailDevice(${d.id})" style="flex:1;">
          🔍 Detail
        </button>
        ${canEdit ? `
        <button class="btn btn-secondary btn-sm" onclick="window.dashboardEditDevice(${d.id})" title="Edit Device" style="display:inline-flex; align-items:center; gap:4px; padding:6px 10px;">
          ✏️ Edit
        </button>
        <button class="btn btn-secondary btn-sm" onclick="window.dashboardPingDevice(${d.id})" title="Ping Manual">
          📡
        </button>
        ${d.status !== 'maintenance' ? `
        <button class="btn btn-warning btn-sm" onclick="window.dashboardSetMaintenance(${d.id})" title="Set Maintenance">
          🔧
        </button>` : `
        <button class="btn btn-success btn-sm" onclick="window.dashboardEndMaintenance(${d.id})" title="Selesai Maintenance">
          ✅
        </button>`}` : ''}
      </div>
    </div>
  `;
}

function renderDeviceCards(filtered = null) {
  if (mockDevices.length === 0) {
    return `
      <div class="empty-state" style="grid-column:1/-1; padding:48px 20px; text-align:center; background:var(--color-surface); border:1px dashed var(--border-color); border-radius:12px;">
        <div style="font-size:3rem; margin-bottom:12px;">📡</div>
        <div style="font-size:1.15rem; font-weight:700; color:var(--color-heading); margin-bottom:6px;">Belum Ada Perangkat yang Dipantau</div>
        <p style="font-size:0.85rem; color:var(--color-muted); max-width:480px; margin:0 auto 20px auto; line-height:1.5;">
          Basis data perangkat saat ini bersih tanpa data dummy. Silakan tambahkan komputer kantor atau CCTV Hikvision untuk memulai pemantauan real-time.
        </p>
        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <a href="#/devices" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px;">
            <span>➕ Tambah Perangkat</span>
          </a>
          <a href="#/devices" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:8px;">
            <span>📥 Impor CSV</span>
          </a>
        </div>
      </div>
    `;
  }

  const devices = (filtered || getFilteredDevices()).slice();
  if (devices.length === 0) {
    return `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Tidak ada device ditemukan</div>
        <div class="empty-desc">Coba ubah filter atau kata kunci pencarian</div>
      </div>
    `;
  }

  // Selalu urutkan IP dari kecil ke besar secara numerik
  devices.sort((a, b) => compareDeviceIps(a.ip, b.ip));

  const session = getSession();
  const canEdit = session?.role === 'admin' || session?.role === 'teknisi';

  // Mode 1: Tanpa pengelompokan (Flat list terurut IP)
  if (cardGroupMode === 'none') {
    return devices.map((d) => renderSingleDeviceCard(d, canEdit)).join('');
  }

  // Mode 2: Per Grup Kantor atau Per Jenis Device
  const groupsMap = new Map();

  devices.forEach((d) => {
    const key = cardGroupMode === 'jenis' ? (d.jenis || 'Lainnya') : (d.grup || 'Umum');
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key).push(d);
  });

  let html = '';
  for (const [groupName, groupDevs] of groupsMap.entries()) {
    const isCollapsed = collapsedGroups.has(groupName);
    const onlineCount = groupDevs.filter((d) => d.status === 'online').length;
    const offlineCount = groupDevs.filter((d) => d.status === 'offline').length;
    const maintCount = groupDevs.filter((d) => d.status === 'maintenance').length;

    let groupIcon = '🏢';
    if (cardGroupMode === 'jenis') {
      groupIcon = getNodeIcon(groupName);
    }

    const safeGroupName = encodeURIComponent(groupName);

    html += `
      <div class="dashboard-device-group-section ${isCollapsed ? 'collapsed' : ''}" data-group-name="${groupName}" style="grid-column: 1 / -1; width: 100%; margin-bottom: 24px;">
        <div class="dashboard-device-group-header" onclick="window.toggleCardGroup('${safeGroupName}')" style="
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
          padding: 10px 16px; margin-bottom: 12px; cursor: pointer; user-select: none;
          background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color);
          border-left: 4px solid var(--color-accent); border-radius: var(--border-radius-md);
          transition: background 0.2s ease;
        " title="Klik untuk ${isCollapsed ? 'membuka' : 'menutup'} grup ini">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 0.75rem; border-radius: 4px; pointer-events: none;">
              ${isCollapsed ? '▶' : '▼'}
            </button>
            <span style="font-size: 1.3rem;">${groupIcon}</span>
            <div>
              <div style="font-size: 0.98rem; font-weight: 700; color: var(--color-heading); display:flex; align-items:center; gap:8px;">
                <span>${groupName}</span>
                <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: var(--color-accent); font-size: 0.72rem; padding: 2px 8px; border-radius: 10px;">
                  ${groupDevs.length} Device
                </span>
                ${isCollapsed ? `<span style="font-size:0.75rem; color:var(--color-muted); font-weight:normal;">(Grup Ditutup)</span>` : ''}
              </div>
              <div style="font-size: 0.75rem; color: var(--color-muted); margin-top: 1px;">
                Urutan IP numerik dari atas ke bawah • ${cardGroupMode === 'jenis' ? 'Kategori Perangkat' : 'Area / Lokasi Kantor'}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            ${onlineCount > 0 ? `<span class="badge" style="background: rgba(34, 197, 94, 0.15); color: var(--color-online); font-size: 0.72rem; padding: 3px 8px;">🟢 ${onlineCount} Online</span>` : ''}
            ${offlineCount > 0 ? `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--color-offline); font-size: 0.72rem; padding: 3px 8px;">🔴 ${offlineCount} Offline</span>` : ''}
            ${maintCount > 0 ? `<span class="badge" style="background: rgba(234, 179, 8, 0.15); color: var(--color-maintenance); font-size: 0.72rem; padding: 3px 8px;">🟡 ${maintCount} Maint</span>` : ''}
            <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.toggleCardGroup('${safeGroupName}');" style="font-size:0.72rem; padding:3px 10px; border-radius:6px;">
              ${isCollapsed ? 'Buka Grup 📂' : 'Tutup Grup 📁'}
            </button>
          </div>
        </div>

        <div class="devices-grid" style="margin-top: 0; display: ${isCollapsed ? 'none' : 'grid'};">
          ${groupDevs.map((d) => renderSingleDeviceCard(d, canEdit)).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

function getFilteredDevices() {
  return mockDevices.filter((d) => {
    if (currentFilter.kategori !== 'all') {
      const devJ = String(d.jenis || '').toLowerCase();
      const kat = currentFilter.kategori.toLowerCase();
      if (!devJ.includes(kat)) return false;
    }
    if (currentFilter.status !== 'all' && d.status !== currentFilter.status) return false;
    if (currentFilter.grup !== 'all' && d.grup !== currentFilter.grup) return false;
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      if (!d.nama.toLowerCase().includes(q) && !d.ip.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderStatModalDeviceItems(devices, isLight) {
  if (!devices || devices.length === 0) {
    return `<div style="text-align:center; padding:16px; color:var(--color-muted); font-size:0.8rem;">Tidak ada perangkat yang cocok</div>`;
  }
  return devices.map((d) => {
    const isOnline = d.status === 'online';
    const isMaint = d.status === 'maintenance';
    const statusColor = isOnline ? '#22c55e' : (isMaint ? '#eab308' : '#ef4444');
    const statusText = isOnline ? 'Online' : (isMaint ? 'Maint' : 'Offline');
    const resp = isOnline && d.responseTime !== null && d.responseTime !== undefined ? `${d.responseTime}ms` : (isOnline ? '1ms' : 'RTO');

    return `
      <div class="stat-modal-device-item">
        <div style="display:flex; align-items:center; gap:9px; min-width:0; flex:1;">
          <span style="font-size:1.15rem; flex-shrink:0;">${getNodeIcon(d.jenis)}</span>
          <div style="min-width:0; flex:1;">
            <div style="font-weight:600; color:var(--color-heading); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.82rem;">${d.nama}</div>
            <div style="font-family:monospace; font-size:0.72rem; color:var(--color-muted);">${cleanDeviceIp(d.ip)} · ${d.grup || 'Umum'} / ${d.lokasi || 'Lokasi'}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
          <span style="background:${statusColor}22; color:${statusColor}; border:1px solid ${statusColor}55; padding:2px 8px; border-radius:999px; font-size:0.68rem; font-weight:700;">
            ● ${statusText} ${isOnline ? `· ${resp}` : ''}
          </span>
          <button class="btn btn-secondary btn-sm stat-modal-detail-btn" data-device-id="${d.id}" onclick="Swal.close(); window.dashboardDetailDevice && window.dashboardDetailDevice(${d.id});" style="padding:3px 8px; font-size:0.72rem;" title="Buka Detail Perangkat">
            🔍 Detail
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function showStatsDetailModal(type) {
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  const counts = getStatusCounts();
  const uptimePct = counts.total > 0 ? Math.round((counts.online / counts.total) * 100) : 0;

  let modalTitle = '';
  let modalSubtitle = '';
  let badgeColor = '';
  let badgeIcon = '';
  let contentHtml = '';
  let customDidOpen = null;

  let filteredDevices = [];
  if (type === 'total') filteredDevices = [...mockDevices];
  else if (type === 'online') filteredDevices = mockDevices.filter((d) => d.status === 'online');
  else if (type === 'offline') filteredDevices = mockDevices.filter((d) => d.status === 'offline');
  else if (type === 'maintenance') filteredDevices = mockDevices.filter((d) => d.status === 'maintenance');

  if (type === 'total') {
    badgeIcon = '📡';
    badgeColor = '#6366f1';
    modalTitle = `Inventaris Seluruh Perangkat (${mockDevices.length})`;
    modalSubtitle = 'Distribusi aset terpasang, pemetaan subnet, dan status operasional real-time.';

    const typeCounts = {};
    mockDevices.forEach((d) => {
      const j = (d.jenis || 'Lainnya').toLowerCase();
      let key = 'Lainnya';
      if (j.includes('router') || j.includes('gateway')) key = 'Router / Gateway';
      else if (j.includes('switch') || j.includes('hub')) key = 'Switch / Hub';
      else if (j.includes('komputer') || j.includes('pc') || j.includes('laptop')) key = 'Komputer / PC';
      else if (j.includes('cctv') || j.includes('camera') || j.includes('kamera')) key = 'CCTV / IP Cam';
      else if (j.includes('printer')) key = 'Printer';
      else if (j.includes('ap') || j.includes('access point') || j.includes('wifi')) key = 'Access Point';
      else if (j.includes('server')) key = 'Server';
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    });

    const subnets = {};
    mockDevices.forEach((d) => {
      const sub = getSubnetPrefix(d.ip);
      if (sub) subnets[sub] = (subnets[sub] || 0) + 1;
    });

    const categoryChips = Object.entries(typeCounts).map(([cat, c]) => `
      <div style="background:${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}; padding:4px 8px; border-radius:6px; font-size:0.75rem; border:1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}; display:flex; align-items:center; gap:5px;">
        <span>${getNodeIcon(cat)}</span>
        <span style="color:var(--color-heading); font-weight:600;">${cat}</span>
        <span style="background:${badgeColor}22; color:${badgeColor}; padding:1px 6px; border-radius:10px; font-weight:700; font-size:0.7rem;">${c}</span>
      </div>
    `).join('');

    const subnetChips = Object.entries(subnets).map(([sub, count]) => `
      <span style="font-family:monospace; font-size:0.75rem; background:${isLight ? '#f8fafc' : 'rgba(56,189,248,0.1)'}; color:${isLight ? '#0284c7' : '#38bdf8'}; border:1px solid ${isLight ? '#cbd5e1' : 'rgba(56,189,248,0.25)'}; padding:2px 8px; border-radius:4px;">
        ${sub}.x (${count})
      </span>
    `).join('');

    contentHtml = `
      <div class="stat-modal-body">
        <div class="stat-modal-kpi-grid">
          <div class="stat-modal-kpi-card" style="border-left:3px solid #6366f1;">
            <span class="stat-modal-kpi-val" style="color:#6366f1;">${counts.total}</span>
            <span class="stat-modal-kpi-label">Total Node</span>
          </div>
          <div class="stat-modal-kpi-card" style="border-left:3px solid #22c55e;">
            <span class="stat-modal-kpi-val text-online">${counts.online}</span>
            <span class="stat-modal-kpi-label">Online (${uptimePct}%)</span>
          </div>
          <div class="stat-modal-kpi-card" style="border-left:3px solid #ef4444;">
            <span class="stat-modal-kpi-val text-offline">${counts.offline}</span>
            <span class="stat-modal-kpi-label">Offline</span>
          </div>
          <div class="stat-modal-kpi-card" style="border-left:3px solid #eab308;">
            <span class="stat-modal-kpi-val text-maintenance">${counts.maintenance}</span>
            <span class="stat-modal-kpi-label">Maintenance</span>
          </div>
        </div>

        <div>
          <div style="font-size:0.75rem; font-weight:700; color:var(--color-muted); text-transform:uppercase; margin-bottom:6px;">Distribusi Kategori Perangkat:</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${categoryChips || '<span style="color:#94a3b8;">Belum ada kategori</span>'}
          </div>
        </div>

        <div>
          <div style="font-size:0.75rem; font-weight:700; color:var(--color-muted); text-transform:uppercase; margin-bottom:6px;">Sebaran Subnet Jaringan:</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${subnetChips || '<span style="color:#94a3b8;">Tidak ada subnet valid</span>'}
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:0.75rem; font-weight:700; color:var(--color-muted); text-transform:uppercase;">Daftar Perangkat (${filteredDevices.length}):</span>
            <input type="text" id="stat-modal-search" placeholder="🔍 Cari nama/IP..." style="padding:4px 8px; font-size:0.75rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--color-heading); width:160px;" />
          </div>
          <div class="stat-modal-device-list" id="stat-modal-dev-list">
            ${renderStatModalDeviceItems(filteredDevices, isLight)}
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-top:8px; border-top:1px solid var(--border-color); padding-top:12px;">
          <button id="modal-filter-btn" class="btn btn-secondary btn-sm" style="flex:1;">🃏 Tampilkan di Dashboard</button>
          <button id="modal-nav-dev-btn" class="btn btn-primary btn-sm" style="flex:1;">📂 Buka Menu Perangkat ➔</button>
        </div>
      </div>
    `;

    customDidOpen = () => {
      document.getElementById('modal-filter-btn')?.addEventListener('click', () => {
        currentFilter = { kategori: 'all', status: 'all', grup: 'all', search: '' };
        const elStatus = document.getElementById('filter-status');
        const elKat = document.getElementById('filter-kategori');
        const elGrup = document.getElementById('filter-grup');
        const elSearch = document.getElementById('dashboard-search');
        if (elStatus) elStatus.value = 'all';
        if (elKat) elKat.value = 'all';
        if (elGrup) elGrup.value = 'all';
        if (elSearch) elSearch.value = '';
        const grid = document.getElementById('devices-grid');
        const countDisplay = document.getElementById('device-count-display');
        if (grid) grid.innerHTML = renderDeviceCards(mockDevices);
        if (countDisplay) countDisplay.innerHTML = `Menampilkan <strong>${mockDevices.length}</strong> device`;
        document.getElementById('tab-kartu')?.click();
        Swal.close();
      });
      document.getElementById('modal-nav-dev-btn')?.addEventListener('click', () => {
        Swal.close();
        navigate('devices');
      });
    };
  } else if (type === 'online') {
    badgeIcon = '🟢';
    badgeColor = '#22c55e';
    modalTitle = `Node Online Aktif (${counts.online})`;
    modalSubtitle = 'Konektivitas stabil merespons probe telemetri ICMP / TCP / RTSP secara real-time.';

    const onlineDevs = mockDevices.filter((d) => d.status === 'online');
    const latencies = onlineDevs.map((d) => d.responseTime).filter((r) => r !== null && r !== undefined);
    const avgLatency = latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : 0;
    const fastestDev = latencies.length > 0 ? [...onlineDevs].sort((a, b) => (a.responseTime ?? 999) - (b.responseTime ?? 999))[0] : null;

    const fastCount = onlineDevs.filter((d) => (d.responseTime ?? 0) <= 10).length;
    const normalCount = onlineDevs.filter((d) => (d.responseTime ?? 0) > 10 && (d.responseTime ?? 0) <= 50).length;
    const highCount = onlineDevs.filter((d) => (d.responseTime ?? 0) > 50).length;

    contentHtml = `
      <div class="stat-modal-body">
        <div class="stat-modal-kpi-grid">
          <div class="stat-modal-kpi-card" style="border-left:3px solid #22c55e;">
            <span class="stat-modal-kpi-val text-online">${counts.online}</span>
            <span class="stat-modal-kpi-label">Perangkat Aktif</span>
          </div>
          <div class="stat-modal-kpi-card" style="border-left:3px solid #38bdf8;">
            <span class="stat-modal-kpi-val" style="color:#38bdf8;">${uptimePct}%</span>
            <span class="stat-modal-kpi-label">SLA Uptime</span>
          </div>
          <div class="stat-modal-kpi-card" style="border-left:3px solid #a855f7;">
            <span class="stat-modal-kpi-val" style="color:#a855f7;">${avgLatency} <small style="font-size:0.7rem;">ms</small></span>
            <span class="stat-modal-kpi-label">Rata-rata Latensi</span>
          </div>
          <div class="stat-modal-kpi-card" style="border-left:3px solid #eab308;">
            <span class="stat-modal-kpi-val" style="color:#eab308; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${fastestDev ? fastestDev.nama : '—'}</span>
            <span class="stat-modal-kpi-label">Tercepat (${fastestDev ? fastestDev.responseTime : 0}ms)</span>
          </div>
        </div>

        <div style="background:${isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)'}; border:1px solid var(--border-color); border-radius:8px; padding:10px;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--color-muted); text-transform:uppercase; margin-bottom:8px;">Kualitas Respons Jitter:</div>
          <div style="display:flex; gap:8px;">
            <div style="flex:1; background:${isLight ? '#ecfdf5' : 'rgba(34,197,94,0.1)'}; border:1px solid rgba(34,197,94,0.3); border-radius:6px; padding:6px 8px; text-align:center;">
              <div style="color:#22c55e; font-weight:700; font-size:1.1rem;">${fastCount}</div>
              <div style="font-size:0.68rem; color:#22c55e;">⚡ Sangat Cepat (&le;10ms)</div>
            </div>
            <div style="flex:1; background:${isLight ? '#eff6ff' : 'rgba(56,189,248,0.1)'}; border:1px solid rgba(56,189,248,0.3); border-radius:6px; padding:6px 8px; text-align:center;">
              <div style="color:#38bdf8; font-weight:700; font-size:1.1rem;">${normalCount}</div>
              <div style="font-size:0.68rem; color:#38bdf8;">📶 Normal (11-50ms)</div>
            </div>
            <div style="flex:1; background:${isLight ? '#fef3c7' : 'rgba(234,179,8,0.1)'}; border:1px solid rgba(234,179,8,0.3); border-radius:6px; padding:6px 8px; text-align:center;">
              <div style="color:#eab308; font-weight:700; font-size:1.1rem;">${highCount}</div>
              <div style="font-size:0.68rem; color:#eab308;">⚠️ Perlu Cek (>50ms)</div>
            </div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:0.75rem; font-weight:700; color:var(--color-muted); text-transform:uppercase;">Daftar Node Online (${filteredDevices.length}):</span>
            <input type="text" id="stat-modal-search" placeholder="🔍 Cari nama/IP..." style="padding:4px 8px; font-size:0.75rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--color-heading); width:160px;" />
          </div>
          <div class="stat-modal-device-list" id="stat-modal-dev-list">
            ${renderStatModalDeviceItems(filteredDevices, isLight)}
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-top:8px; border-top:1px solid var(--border-color); padding-top:12px;">
          <button id="modal-filter-online-btn" class="btn btn-secondary btn-sm" style="flex:1;">🃏 Filter Kartu: Hanya Online</button>
          <button id="modal-ping-all-online-btn" class="btn btn-success btn-sm" style="flex:1;">📡 Probe Seluruh Node Online</button>
        </div>
      </div>
    `;

    customDidOpen = () => {
      document.getElementById('modal-filter-online-btn')?.addEventListener('click', () => {
        currentFilter.status = 'online';
        const elStatus = document.getElementById('filter-status');
        if (elStatus) elStatus.value = 'online';
        const grid = document.getElementById('devices-grid');
        const countDisplay = document.getElementById('device-count-display');
        const f = getFilteredDevices();
        if (grid) grid.innerHTML = renderDeviceCards(f);
        if (countDisplay) countDisplay.innerHTML = `Menampilkan <strong>${f.length}</strong> device`;
        document.getElementById('tab-kartu')?.click();
        Swal.close();
      });
      document.getElementById('modal-ping-all-online-btn')?.addEventListener('click', () => {
        Swal.close();
        document.getElementById('ping-all-btn')?.click();
      });
    };
  } else if (type === 'offline') {
    badgeIcon = '🔴';
    badgeColor = '#ef4444';
    modalTitle = `Diagnostik Perangkat Offline (${counts.offline})`;
    modalSubtitle = 'Peringatan kegagalan respons koneksi, potensi gangguan jalur uplink, dan packet loss.';

    const offlineDevs = mockDevices.filter((d) => d.status === 'offline');
    const isZeroOffline = offlineDevs.length === 0;

    contentHtml = `
      <div class="stat-modal-body">
        ${isZeroOffline ? `
          <div style="text-align:center; padding:24px 16px; background:${isLight ? '#ecfdf5' : 'rgba(34,197,94,0.1)'}; border:1px solid rgba(34,197,94,0.3); border-radius:10px;">
            <div style="font-size:2.5rem; margin-bottom:8px;">🎉</div>
            <div style="font-weight:700; color:#22c55e; font-size:1.1rem;">Kondisi Jaringan Prima!</div>
            <div style="color:var(--color-muted); font-size:0.8rem; margin-top:4px;">Tidak ada node perangkat yang offline atau mengalami pemutusan koneksi saat ini.</div>
          </div>
        ` : `
          <div class="stat-modal-kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
            <div class="stat-modal-kpi-card" style="border-left:3px solid #ef4444;">
              <span class="stat-modal-kpi-val text-offline">${counts.offline} Node</span>
              <span class="stat-modal-kpi-label">Terputus Total</span>
            </div>
            <div class="stat-modal-kpi-card" style="border-left:3px solid #f97316;">
              <span class="stat-modal-kpi-val" style="color:#f97316;">${Math.round((counts.offline / (counts.total || 1)) * 100)}%</span>
              <span class="stat-modal-kpi-label">Rasio Gangguan</span>
            </div>
            <div class="stat-modal-kpi-card" style="border-left:3px solid #eab308;">
              <span class="stat-modal-kpi-val text-maintenance">${counts.maintenance} Node</span>
              <span class="stat-modal-kpi-label">Sedang Servis</span>
            </div>
          </div>

          <div style="background:${isLight ? '#fef2f2' : 'rgba(239,68,68,0.12)'}; border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:10px 12px; color:${isLight ? '#991b1b' : '#fca5a5'}; font-size:0.8rem;">
            ⚠️ <strong>Tindakan Rekomendasi:</strong> Periksa kabel LAN, adaptor PoE/daya, atau port switch uplink untuk memulihkan koneksi perangkat di bawah ini.
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:0.75rem; font-weight:700; color:var(--color-muted); text-transform:uppercase;">Daftar Node Offline (${filteredDevices.length}):</span>
              <input type="text" id="stat-modal-search" placeholder="🔍 Cari nama/IP..." style="padding:4px 8px; font-size:0.75rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--color-heading); width:160px;" />
            </div>
            <div class="stat-modal-device-list" id="stat-modal-dev-list">
              ${renderStatModalDeviceItems(filteredDevices, isLight)}
            </div>
          </div>
        `}

        <div style="display:flex; gap:8px; margin-top:8px; border-top:1px solid var(--border-color); padding-top:12px;">
          ${!isZeroOffline ? `
            <button id="modal-filter-offline-btn" class="btn btn-secondary btn-sm" style="flex:1;">🃏 Filter Kartu: Offline</button>
            <button id="modal-ping-all-offline-btn" class="btn btn-danger btn-sm" style="flex:1;">📡 Probe Node Offline</button>
            <button id="modal-export-incident-btn" class="btn btn-primary btn-sm" style="flex:1;">📄 Ekspor PDF</button>
          ` : `
            <button onclick="Swal.close()" class="btn btn-primary btn-sm" style="flex:1;">Tutup</button>
          `}
        </div>
      </div>
    `;

    customDidOpen = () => {
      document.getElementById('modal-filter-offline-btn')?.addEventListener('click', () => {
        currentFilter.status = 'offline';
        const elStatus = document.getElementById('filter-status');
        if (elStatus) elStatus.value = 'offline';
        const grid = document.getElementById('devices-grid');
        const countDisplay = document.getElementById('device-count-display');
        const f = getFilteredDevices();
        if (grid) grid.innerHTML = renderDeviceCards(f);
        if (countDisplay) countDisplay.innerHTML = `Menampilkan <strong>${f.length}</strong> device`;
        document.getElementById('tab-kartu')?.click();
        Swal.close();
      });

      document.getElementById('modal-ping-all-offline-btn')?.addEventListener('click', async () => {
        Swal.close();
        Swal.fire({
          title: 'Memeriksa Ulang Perangkat Offline...',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
          background: isLight ? '#ffffff' : '#1a1d2e',
          color: isLight ? '#0f172a' : '#e2e8f0',
        });
        for (const d of offlineDevs) {
          await apiPingDevice(d.id).catch(() => {});
        }
        await syncDevicesFromApi().catch(() => {});
        const grid = document.getElementById('devices-grid');
        const countDisplay = document.getElementById('device-count-display');
        const f = getFilteredDevices();
        if (grid) grid.innerHTML = renderDeviceCards(f);
        if (countDisplay) countDisplay.innerHTML = `Menampilkan <strong>${f.length}</strong> device`;
        Swal.fire({
          icon: 'success',
          title: 'Pengecekan Selesai',
          text: 'Status perangkat offline telah diverifikasi ulang.',
          timer: 1800,
          showConfirmButton: false,
          background: isLight ? '#ffffff' : '#1a1d2e',
          color: isLight ? '#0f172a' : '#e2e8f0',
        });
      });

      document.getElementById('modal-export-incident-btn')?.addEventListener('click', async () => {
        try {
          const incidents = offlineDevs.map((d) => ({
            device_nama: d.nama,
            mulai: d.lastOnline || new Date().toISOString(),
            waktu_selesai: null,
            durasi_menit: null,
            penyebab: 'Packet Loss / Timeout probe',
          }));
          await exportReportPdf('insiden', incidents, { incidents });
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Laporan insiden offline berhasil diunduh.',
            timer: 2000,
            showConfirmButton: false,
            background: isLight ? '#ffffff' : '#1a1d2e',
            color: isLight ? '#0f172a' : '#e2e8f0',
          });
        } catch (err) {
          Swal.fire({ icon: 'error', title: 'Gagal Ekspor PDF', text: err.message, background: isLight ? '#ffffff' : '#1a1d2e', color: isLight ? '#0f172a' : '#e2e8f0' });
        }
      });
    };
  } else if (type === 'maintenance') {
    badgeIcon = '🟡';
    badgeColor = '#eab308';
    modalTitle = `Status Pemeliharaan Sistem (${counts.maintenance})`;
    modalSubtitle = 'Perangkat yang berada dalam mode isolasi maintenance terjadwal.';

    const maintDevs = mockDevices.filter((d) => d.status === 'maintenance');
    const isZeroMaint = maintDevs.length === 0;

    contentHtml = `
      <div class="stat-modal-body">
        ${isZeroMaint ? `
          <div style="text-align:center; padding:24px 16px; background:${isLight ? '#fefce8' : 'rgba(234,179,8,0.1)'}; border:1px solid rgba(234,179,8,0.3); border-radius:10px;">
            <div style="font-size:2.5rem; margin-bottom:8px;">✨</div>
            <div style="font-weight:700; color:#eab308; font-size:1.1rem;">Tidak Ada Pemeliharaan Aktif</div>
            <div style="color:var(--color-muted); font-size:0.8rem; margin-top:4px;">Seluruh perangkat berada dalam status pemantauan operasional reguler.</div>
          </div>
        ` : `
          <div class="stat-modal-kpi-grid" style="grid-template-columns: repeat(2, 1fr);">
            <div class="stat-modal-kpi-card" style="border-left:3px solid #eab308;">
              <span class="stat-modal-kpi-val text-maintenance">${counts.maintenance} Node</span>
              <span class="stat-modal-kpi-label">Mode Pemeliharaan</span>
            </div>
            <div class="stat-modal-kpi-card" style="border-left:3px solid #38bdf8;">
              <span class="stat-modal-kpi-val" style="color:#38bdf8;">Terjadwal</span>
              <span class="stat-modal-kpi-label">Status Isolasi Alarm</span>
            </div>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:0.75rem; font-weight:700; color:var(--color-muted); text-transform:uppercase;">Daftar Node Maintenance (${filteredDevices.length}):</span>
              <input type="text" id="stat-modal-search" placeholder="🔍 Cari nama/IP..." style="padding:4px 8px; font-size:0.75rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-primary); color:var(--color-heading); width:160px;" />
            </div>
            <div class="stat-modal-device-list" id="stat-modal-dev-list">
              ${renderStatModalDeviceItems(filteredDevices, isLight)}
            </div>
          </div>
        `}

        <div style="display:flex; gap:8px; margin-top:8px; border-top:1px solid var(--border-color); padding-top:12px;">
          ${!isZeroMaint ? `
            <button id="modal-filter-maint-btn" class="btn btn-secondary btn-sm" style="flex:1;">🃏 Filter Kartu: Hanya Maintenance</button>
            <button id="modal-nav-dev-maint-btn" class="btn btn-warning btn-sm" style="flex:1;">🔧 Kelola di Menu Perangkat ➔</button>
          ` : `
            <button onclick="Swal.close()" class="btn btn-primary btn-sm" style="flex:1;">Tutup</button>
          `}
        </div>
      </div>
    `;

    customDidOpen = () => {
      document.getElementById('modal-filter-maint-btn')?.addEventListener('click', () => {
        currentFilter.status = 'maintenance';
        const elStatus = document.getElementById('filter-status');
        if (elStatus) elStatus.value = 'maintenance';
        const grid = document.getElementById('devices-grid');
        const countDisplay = document.getElementById('device-count-display');
        const f = getFilteredDevices();
        if (grid) grid.innerHTML = renderDeviceCards(f);
        if (countDisplay) countDisplay.innerHTML = `Menampilkan <strong>${f.length}</strong> device`;
        document.getElementById('tab-kartu')?.click();
        Swal.close();
      });
      document.getElementById('modal-nav-dev-maint-btn')?.addEventListener('click', () => {
        Swal.close();
        navigate('devices');
      });
    };
  }

  Swal.fire({
    title: `
      <div style="display:flex; align-items:center; gap:10px; font-size:1.15rem; text-align:left;">
        <span style="background:${badgeColor}22; color:${badgeColor}; width:38px; height:38px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; font-size:1.3rem; border:1px solid ${badgeColor}55;">
          ${badgeIcon}
        </span>
        <div>
          <div style="color:var(--color-heading); font-weight:700;">${modalTitle}</div>
          <div style="font-size:0.75rem; font-weight:normal; color:var(--color-muted); margin-top:2px;">${modalSubtitle}</div>
        </div>
      </div>
    `,
    html: contentHtml,
    showConfirmButton: false,
    showCloseButton: true,
    width: 620,
    background: isLight ? '#ffffff' : '#1a1d2e',
    color: isLight ? '#0f172a' : '#e2e8f0',
    didOpen: () => {
      const searchInput = document.getElementById('stat-modal-search');
      const listContainer = document.getElementById('stat-modal-dev-list');
      if (searchInput && listContainer) {
        searchInput.addEventListener('input', (e) => {
          const q = (e.target.value || '').trim().toLowerCase();
          const matched = filteredDevices.filter((d) =>
            (d.nama || '').toLowerCase().includes(q) || (d.ip || '').toLowerCase().includes(q)
          );
          listContainer.innerHTML = renderStatModalDeviceItems(matched, isLight);
        });
      }

      // Event delegation untuk tombol detail pada setiap item perangkat di modal
      const modalPopup = Swal.getPopup();
      if (modalPopup) {
        modalPopup.addEventListener('click', (e) => {
          const detailBtn = e.target.closest('.stat-modal-detail-btn');
          if (detailBtn) {
            const devId = detailBtn.getAttribute('data-device-id');
            Swal.close();
            if (devId) {
              navigate('device-detail', { id: devId });
            }
          }
        });
      }

      if (typeof customDidOpen === 'function') {
        customDidOpen();
      }
    },
  });
}

export function initDashboardEvents(navigate) {
  currentNavigate = navigate;
  // Tab switching
  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-content-${currentTab}`)?.classList.add('active');

      if (mapAnimId) {
        cancelAnimationFrame(mapAnimId);
        mapAnimId = null;
      }

      if (currentTab === 'peta') {
        requestAnimationFrame(() => {
          initNetworkMap();
        });
      }
      if (currentTab === 'timeline') initTimeline();
    });
  });

  // Filters
  const applyFilter = () => {
    const filtered = getFilteredDevices();
    const grid = document.getElementById('devices-grid');
    const countDisplay = document.getElementById('device-count-display');
    if (grid) grid.innerHTML = renderDeviceCards(filtered);
    if (countDisplay) countDisplay.innerHTML = `Menampilkan <strong>${filtered.length}</strong> device`;
    startCountdownTimers();
  };

  document.getElementById('dashboard-search')?.addEventListener('input', (e) => {
    currentFilter.search = e.target.value;
    applyFilter();
  });
  document.getElementById('filter-kategori')?.addEventListener('change', (e) => {
    currentFilter.kategori = e.target.value;
    applyFilter();
  });
  document.getElementById('filter-status')?.addEventListener('change', (e) => {
    currentFilter.status = e.target.value;
    applyFilter();
  });
  document.getElementById('filter-grup')?.addEventListener('change', (e) => {
    currentFilter.grup = e.target.value;
    applyFilter();
  });
  document.getElementById('filter-group-mode')?.addEventListener('change', (e) => {
    cardGroupMode = e.target.value;
    const collapseControls = document.getElementById('group-collapse-controls');
    if (collapseControls) {
      collapseControls.style.display = cardGroupMode !== 'none' ? 'inline-flex' : 'none';
    }
    applyFilter();
  });

  document.getElementById('btn-expand-all-groups')?.addEventListener('click', () => {
    window.expandAllCardGroups && window.expandAllCardGroups();
  });

  document.getElementById('btn-collapse-all-groups')?.addEventListener('click', () => {
    window.collapseAllCardGroups && window.collapseAllCardGroups();
  });

  function updateDashboardStats() {
    const counts = getStatusCounts();
    const uptimePct = counts.total > 0 ? Math.round((counts.online / counts.total) * 100) : 0;
    const elTotal = document.getElementById('stat-total-val');
    const elOnline = document.getElementById('stat-online-val');
    const elOffline = document.getElementById('stat-offline-val');
    const elMaint = document.getElementById('stat-maint-val');
    const elUptime = document.getElementById('stat-uptime-sub');
    if (elTotal) elTotal.textContent = counts.total;
    if (elOnline) elOnline.textContent = counts.online;
    if (elOffline) elOffline.textContent = counts.offline;
    if (elMaint) elMaint.textContent = counts.maintenance;
    if (elUptime) elUptime.textContent = `${uptimePct}% dari total`;
  }

  function updateGroupFilterOptions() {
    const sel = document.getElementById('filter-grup');
    if (sel) {
      const groups = getGroups();
      sel.innerHTML = `<option value="all">Semua Grup</option>` + groups.map((g) => `<option value="${g}" ${currentFilter.grup === g ? 'selected' : ''}>${g}</option>`).join('');
    }
  }

  function updateTimelineSelectOptions(preferredDeviceId = null) {
    const select = document.getElementById('timeline-device-select');
    if (!select) return;

    const currentVal = preferredDeviceId !== null && preferredDeviceId !== undefined
      ? String(preferredDeviceId)
      : select.value;

    if (mockDevices.length === 0) {
      select.innerHTML = '<option value="">(Belum ada perangkat terdaftar)</option>';
      select.disabled = true;
      return;
    }

    select.disabled = false;
    select.innerHTML = mockDevices.map((d) => {
      const isOnline = d.status === 'online';
      const isMaint = d.status === 'maintenance';
      const icon = isOnline ? '🟢' : isMaint ? '🟡' : '🔴';
      const statusText = isOnline ? 'Online' : isMaint ? 'Maintenance' : 'Offline';
      const isSelected = String(d.id) === currentVal;
      const displayIp = cleanDeviceIp(d.ip);
      return `<option value="${d.id}" ${isSelected ? 'selected' : ''}>${icon} ${d.nama} (${displayIp}) — ${statusText}</option>`;
    }).join('');

    if (!select.value && mockDevices.length > 0) {
      select.value = String(mockDevices[0].id);
    }
  }

  // Sinkronkan data riil dari database SQLite seketika saat halaman dibuka
  syncDevicesFromApi()
    .then(() => {
      updateDashboardStats();
      applyFilter();
      updateGroupFilterOptions();
      updateTimelineSelectOptions();
      if (currentTab === 'peta') {
        requestAnimationFrame(() => {
          initNetworkMap();
        });
      }
      if (currentTab === 'timeline') initTimeline();
    })
    .catch((err) => {
      console.warn('Gagal memuat otomatis perangkat:', err);
    });

  // Handler pemindaian seluruh perangkat
  const handleFullNetworkScan = async (isExplicitPingAll = true) => {
    const pingAllBtn = document.getElementById('ping-all-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    if (pingAllBtn) { pingAllBtn.disabled = true; pingAllBtn.textContent = '⏳ Memindai...'; }
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '⏳ Memuat...'; }

    Swal.fire({
      title: isExplicitPingAll ? '📡 Memindai Seluruh Jaringan' : '🔄 Menyinkronkan & Menguji Jaringan',
      html: `<div style="text-align:center; padding:10px;">
        <div style="color:var(--color-muted); font-size:0.85rem; margin-bottom:8px;">Mengirim paket probe serentak ke seluruh perangkat aktif...</div>
        <div style="font-size:0.8rem; color:#94a3b8;">Status akan langsung disesuaikan dengan kondisi jaringan saat ini.</div>
      </div>`,
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
      background: '#1a1d2e',
      color: '#e2e8f0',
    });

    try {
      const res = await apiPingAllDevices();
      await syncDevicesFromApi();
      updateDashboardStats();
      applyFilter();
      updateGroupFilterOptions();
      updateTimelineSelectOptions();
      if (currentTab === 'peta') {
        requestAnimationFrame(() => {
          initNetworkMap();
        });
      }
      if (currentTab === 'timeline') initTimeline();

      const onlineCount = res.online !== undefined ? res.online : mockDevices.filter((d) => d.status === 'online').length;
      const offlineCount = res.offline !== undefined ? res.offline : mockDevices.filter((d) => d.status === 'offline').length;
      const maintCount = res.maintenance !== undefined ? res.maintenance : mockDevices.filter((d) => d.status === 'maintenance').length;

      await Swal.fire({
        icon: 'success',
        title: isExplicitPingAll ? 'Pemindaian Selesai' : 'Status Jaringan Diperbarui',
        html: `
          <div style="text-align:center; padding:6px;">
            <div style="display:flex; justify-content:center; gap:16px; margin:12px 0;">
              <div style="padding:8px 14px; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.4); border-radius:8px;">
                <div style="font-size:1.5rem; font-weight:800; color:#4ade80;">${onlineCount}</div>
                <div style="font-size:0.75rem; color:#86efac;">Online</div>
              </div>
              <div style="padding:8px 14px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); border-radius:8px;">
                <div style="font-size:1.5rem; font-weight:800; color:#f87171;">${offlineCount}</div>
                <div style="font-size:0.75rem; color:#fca5a5;">Offline</div>
              </div>
              ${maintCount > 0 ? `
              <div style="padding:8px 14px; background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.4); border-radius:8px;">
                <div style="font-size:1.5rem; font-weight:800; color:#fde047;">${maintCount}</div>
                <div style="font-size:0.75rem; color:#fef08a;">Maintenance</div>
              </div>` : ''}
            </div>
            <div style="font-size:0.8rem; color:#94a3b8;">
              ${offlineCount > 0 && onlineCount === 0 ? '⚠️ Seluruh perangkat tidak merespons (Periksa koneksi jaringan komputer).' : 'Seluruh status perangkat telah disinkronkan.'}
            </div>
          </div>
        `,
        timer: isExplicitPingAll ? 3000 : 2000,
        showConfirmButton: isExplicitPingAll,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#6366f1',
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memindai Jaringan',
        text: err.message,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    } finally {
      if (pingAllBtn) { pingAllBtn.disabled = false; pingAllBtn.textContent = '📡 Ping All'; }
      if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = '🔄 Refresh'; }
    }
  };

  // Ping All button
  document.getElementById('ping-all-btn')?.addEventListener('click', () => handleFullNetworkScan(true));

  // Refresh button: jalankan sinkronisasi dengan probe aktif
  document.getElementById('refresh-btn')?.addEventListener('click', () => handleFullNetworkScan(false));

  // Stat cards click to open modern detail modal
  document.querySelectorAll('.stat-card[data-stat-type]').forEach((card) => {
    card.addEventListener('click', () => {
      const type = card.getAttribute('data-stat-type');
      if (type) showStatsDetailModal(type);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const type = card.getAttribute('data-stat-type');
        if (type) showStatsDetailModal(type);
      }
    });
  });

  // Sinkronkan stat awal saat event dipasang
  updateDashboardStats();

  // Countdown timers
  startCountdownTimers();

  // Init tab peta if active
  if (currentTab === 'peta') {
    requestAnimationFrame(() => {
      initNetworkMap();
    });
  }
  if (currentTab === 'timeline') initTimeline();

  // Global device action handlers
  window.dashboardDetailDevice = (id) => navigate('device-detail', { id });

  window.dashboardEditDevice = (id) => {
    showDeviceForm(id, async () => {
      await syncDevicesFromApi();
      applyFilter();
      updateDashboardStats();
    });
  };

  window.toggleCardGroup = (encodedGroupName) => {
    const groupName = decodeURIComponent(encodedGroupName);
    if (collapsedGroups.has(groupName)) {
      collapsedGroups.delete(groupName);
    } else {
      collapsedGroups.add(groupName);
    }
    applyFilter();
  };

  window.expandAllCardGroups = () => {
    collapsedGroups.clear();
    applyFilter();
  };

  window.collapseAllCardGroups = () => {
    const filtered = getFilteredDevices();
    filtered.forEach((d) => {
      const key = cardGroupMode === 'jenis' ? (d.jenis || 'Lainnya') : (d.grup || 'Umum');
      collapsedGroups.add(key);
    });
    applyFilter();
  };

  window.dashboardPingDevice = async (id) => {
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;

    Swal.fire({
      title: `Probe Jaringan ke ${device.nama}`,
      html: `<div style="text-align:center; padding:8px;">
        <div style="color:var(--color-muted); font-size:0.85rem;">Mengirim probe jaringan langsung ke <code style="color:var(--color-accent);">${device.ip}</code>...</div>
      </div>`,
      didOpen: () => Swal.showLoading(),
      background: '#1a1d2e',
      color: '#e2e8f0',
      allowOutsideClick: false,
      showConfirmButton: false,
    });

    try {
      const res = await apiPingDevice(id);
      const pingData = res.data || res;
      const isOnline = Boolean(pingData.alive || pingData.status === 'online');
      const ms = pingData.responseTime ?? pingData.time;
      const finalStatus = isOnline ? 'online' : 'offline';
      updateDeviceStatus(id, finalStatus);
      device.responseTime = ms;
      device.status = finalStatus;

      await Swal.fire({
        title: 'Hasil Probe Jaringan',
        html: isOnline
          ? `<div style="text-align:center;">
              <div style="font-size:2.5rem; font-weight:800; color:var(--color-online); margin:8px 0;">${ms !== null && ms !== undefined ? ms + ' ms' : 'OK'}</div>
              <div style="color:#94a3b8; font-size:0.85rem;">📡 <b>${device.ip}</b> merespons probe (${pingData.method || device.metode})</div>
              <div class="badge badge-online" style="margin-top:8px;">✅ Online</div>
            </div>`
          : `<div style="text-align:center;">
              <div style="font-size:2rem; font-weight:800; color:var(--color-offline); margin:8px 0;">Offline / Timeout</div>
              <div style="color:#94a3b8; font-size:0.85rem;">📡 <b>${device.ip}</b> tidak merespons (${pingData.statusText || pingData.error || 'Request Timeout'})</div>
              <div class="badge badge-offline" style="margin-top:8px;">❌ Offline</div>
            </div>`,
        background: '#1a1d2e',
        color: '#e2e8f0',
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#6366f1',
      });
      applyFilter();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Melakukan Probe',
        text: err.message,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    }
  };

  window.dashboardSetMaintenance = async (id) => {
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;

    const now = new Date();
    const defaultEstimasi = new Date(now.getTime() + 2 * 3600000).toISOString().slice(0, 16);

    const { value: formData, isConfirmed } = await Swal.fire({
      title: `🔧 Set Maintenance`,
      html: `
        <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
          <div style="padding:10px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.5rem;">${getNodeIcon(device.jenis)}</span>
            <div>
              <div style="font-weight:700; color:#f1f5f9;">${device.nama}</div>
              <div style="font-size:0.8rem; color:#64748b; font-family:monospace;">${device.ip}</div>
            </div>
          </div>
          <div>
            <label style="font-size:0.82rem; color:#94a3b8; display:block; margin-bottom:4px;">Alasan Maintenance *</label>
            <textarea id="swal-alasan" class="swal2-textarea" placeholder="Jelaskan alasan maintenance..." style="font-family:var(--font); font-size:0.85rem; width:100%; min-height:80px;"></textarea>
          </div>
          <div>
            <label style="font-size:0.82rem; color:#94a3b8; display:block; margin-bottom:4px;">Estimasi Selesai *</label>
            <input type="datetime-local" id="swal-estimasi" class="swal2-input" value="${defaultEstimasi}" style="width:100%; font-family:var(--font);" />
          </div>
        </div>
      `,
      background: '#1a1d2e',
      color: '#e2e8f0',
      showCancelButton: true,
      confirmButtonText: '🔧 Aktifkan Maintenance',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#eab308',
      cancelButtonColor: '#374151',
      preConfirm: () => {
        const alasan = document.getElementById('swal-alasan').value.trim();
        const estimasi = document.getElementById('swal-estimasi').value;
        if (!alasan) { Swal.showValidationMessage('Alasan maintenance wajib diisi!'); return false; }
        if (!estimasi) { Swal.showValidationMessage('Estimasi selesai wajib diisi!'); return false; }
        return { alasan, estimasi };
      },
    });

    if (isConfirmed && formData) {
      try {
        const durationMinutes = Math.max(1, Math.round((new Date(formData.estimasi).getTime() - Date.now()) / 60000));
        await apiSetMaintenance(id, formData.alasan, durationMinutes);
        await syncDevicesFromApi();
        applyFilter();

        Swal.fire({
          icon: 'success',
          title: 'Mode Maintenance Aktif',
          text: `${device.nama} kini dalam mode maintenance di database dan tidak akan memicu alert.`,
          timer: 2000,
          showConfirmButton: false,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Set Maintenance', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  };

  window.dashboardEndMaintenance = async (id) => {
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;

    const result = await Swal.fire({
      title: '✅ Selesai Maintenance?',
      html: `Konfirmasi bahwa maintenance pada <b>${device.nama}</b> telah selesai. Device akan kembali ke monitoring normal.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✅ Ya, Selesai',
      cancelButtonText: 'Batal',
      background: '#1a1d2e',
      color: '#e2e8f0',
      confirmButtonColor: '#22c55e',
      cancelButtonColor: '#374151',
    });

    if (result.isConfirmed) {
      try {
        await apiFinishMaintenance(id);
        await syncDevicesFromApi();
        applyFilter();

        Swal.fire({
          icon: 'success',
          title: 'Maintenance Selesai',
          text: `${device.nama} kembali ke monitoring normal.`,
          timer: 2000,
          showConfirmButton: false,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Menyelesaikan Maintenance', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  };
}

function startCountdownTimers() {
  const timers = document.querySelectorAll('.countdown-timer[data-end]');
  timers.forEach((el) => {
    const end = new Date(el.getAttribute('data-end'));
    const update = () => {
      const diff = end - new Date();
      if (diff <= 0) {
        el.textContent = 'Estimasi selesai!';
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = h > 0 ? `Selesai dalam ${h}j ${m}m` : `Selesai dalam ${m}m ${s}d`;
    };
    update();
    const interval = setInterval(() => {
      if (!document.contains(el)) { clearInterval(interval); return; }
      update();
    }, 1000);
  });
}

// ---- NETWORK MAP HELPERS & TOPOLOGY LAYOUT ----
function getSubnetPrefix(ip) {
  if (!ip) return '';
  const clean = cleanDeviceIp(ip);
  const parts = String(clean).trim().split('.');
  if (parts.length >= 3) {
    return parts.slice(0, 3).join('.');
  }
  return String(clean).trim();
}

function getNodeIcon(jenis) {
  const low = String(jenis || '').toLowerCase();
  if (low.includes('cctv')) return '📷';
  if (low.includes('router') || low.includes('gateway')) return '🌐';
  if (low.includes('switch') || low.includes('hub')) return '🔀';
  if (low.includes('server')) return '🖥️';
  if (low.includes('access point') || low.includes('ap') || low.includes('wifi')) return '📶';
  return '💻';
}

function wouldCauseCycle(childId, parentCandidateId) {
  if (!childId || !parentCandidateId) return false;
  if (childId === parentCandidateId) return true;
  let curr = parentCandidateId;
  const seen = new Set([childId]);
  while (curr) {
    if (seen.has(curr)) return true;
    seen.add(curr);
    const currDev = mockDevices.find((p) => p.id === curr);
    if (!currDev) break;
    curr = currDev.parent_id;
  }
  return false;
}

function getDeviceParent(d) {
  const isRouterOrGateway = ['router', 'gateway'].some((k) => String(d.jenis || '').toLowerCase().includes(k));

  if (d.parent_id) {
    const explicit = mockDevices.find((p) => p.id === d.parent_id);
    if (explicit && explicit.id !== d.id && !wouldCauseCycle(d.id, explicit.id)) {
      return explicit;
    }
  }

  // Router atau Gateway tanpa parent eksplisit selalu berdiri sebagai Root Gateway independen
  if (isRouterOrGateway) {
    return null;
  }

  // Auto fallback 1: Cek apakah ada switch/router di subnet yang sama (kecuali jika menimbulkan siklus)
  const devSubnet = getSubnetPrefix(d.ip);
  const sameSubnetParent = mockDevices.find((p) =>
    p.id !== d.id &&
    ['switch', 'router', 'gateway', 'hub'].some((k) => String(p.jenis || '').toLowerCase().includes(k)) &&
    getSubnetPrefix(p.ip) === devSubnet &&
    !wouldCauseCycle(d.id, p.id)
  );
  if (sameSubnetParent) return sameSubnetParent;

  // Auto fallback 2: jika bukan switch/router, sambungkan ke switch dalam grup yang sama
  const isInfra = ['switch', 'router', 'gateway'].some((k) => String(d.jenis || '').toLowerCase().includes(k));
  if (!isInfra) {
    const sameGroupSw = mockDevices.find((p) =>
      p.id !== d.id &&
      ['switch', 'router'].some((k) => String(p.jenis || '').toLowerCase().includes(k)) &&
      (p.grup || 'Umum') === (d.grup || 'Umum') &&
      !wouldCauseCycle(d.id, p.id)
    );
    if (sameGroupSw) return sameGroupSw;
  }

  // Auto fallback 3: Khusus CCTV tanpa parent eksplisit, sambungkan ke Router/Switch CCTV atau infrastruktur dalam jaringan
  if (String(d.jenis || '').toLowerCase().includes('cctv')) {
    const cctvRouter = mockDevices.find((p) =>
      p.id !== d.id &&
      ['router', 'switch', 'gateway'].some((k) => String(p.jenis || '').toLowerCase().includes(k)) &&
      (String(p.nama || '').toLowerCase().includes('cctv') || String(p.deskripsi || '').toLowerCase().includes('cctv')) &&
      !wouldCauseCycle(d.id, p.id)
    );
    if (cctvRouter) return cctvRouter;
  }

  // Auto fallback 4: Jika masih belum punya parent dan bukan router/gateway, sambungkan ke router/switch manapun agar tidak berdiri sebagai orphan root
  const anyInfra = mockDevices.find((p) =>
    p.id !== d.id &&
    ['router', 'gateway', 'switch'].some((k) => String(p.jenis || '').toLowerCase().includes(k)) &&
    !wouldCauseCycle(d.id, p.id)
  );
  if (anyInfra) return anyInfra;

  return null;
}

function computeMapLayout(w, h, force = false) {
  virtualNodes = [];
  wanNode = null;
  interRouterLinks = [];
  if (mockDevices.length === 0) return;

  // Bangun relasi pohon hierarkis riil
  const childrenMap = new Map();
  mockDevices.forEach((d) => childrenMap.set(d.id, []));
  const roots = [];

  mockDevices.forEach((d) => {
    const p = getDeviceParent(d);
    if (p && childrenMap.has(p.id)) {
      childrenMap.get(p.id).push(d);
      d._effectiveParent = p;
    } else {
      roots.push(d);
      d._effectiveParent = null;
    }
  });

  // Urutkan roots: Router & Gateway lebih dulu di posisi utama, disusul Switch, lalu lainnya
  roots.sort((a, b) => {
    const score = (d) => {
      const low = String(d.jenis || '').toLowerCase();
      if (low.includes('router') || low.includes('gateway')) return 3;
      if (low.includes('switch') || low.includes('hub')) return 2;
      if (low.includes('server')) return 1;
      return 0;
    };
    return score(b) - score(a);
  });

  // Identifikasi seluruh Root Router Gateway
  const rootRouters = roots.filter((r) =>
    ['router', 'gateway'].some((k) => String(r.jenis || '').toLowerCase().includes(k))
  );

  const hasWanCloud = rootRouters.length > 0;
  const CARD_W = 144;
  const CARD_H = 44;
  const HORIZONTAL_GAP = 20;
  const VERTICAL_GAP = 16;
  const LEVEL_GAP = 95;
  const TOP_MARGIN = hasWanCloud ? 120 : 70;

  // Hitung lebar setiap subtree secara rekursif (dukungan Shelf Grid Kompak untuk pure leaf clusters & Natural Tree untuk cabang campuran)
  function measureSubtree(node) {
    const allChildren = childrenMap.get(node.id) || [];
    if (allChildren.length === 0) {
      node._subtreeWidth = CARD_W;
      node._isLeafShelf = false;
      return CARD_W;
    }

    const allLeaves = allChildren.every((c) => (childrenMap.get(c.id) || []).length === 0);

    // Pure leaf cluster dengan banyak node (seperti Router CCTV >= 4 kamera): simpan dalam Shelf Grid kompak 4 kolom
    if (allLeaves && allChildren.length >= 4) {
      const cols = Math.min(4, Math.ceil(Math.sqrt(allChildren.length * 1.5)));
      node._subtreeWidth = cols * CARD_W + (cols - 1) * HORIZONTAL_GAP;
      node._isLeafShelf = true;
      node._cols = cols;
      return node._subtreeWidth;
    }

    // Cabang hierarkis berimbang (seperti Router Kantor Induk dan Switch):
    node._isLeafShelf = false;
    // Urutkan anak: Infrastructure/switch/router diutamakan/dikelompokkan rapi, disusul lainnya
    allChildren.sort((a, b) => {
      const isInfraA = ['switch', 'router', 'gateway', 'hub'].some((k) => String(a.jenis || '').toLowerCase().includes(k)) ? 1 : 0;
      const isInfraB = ['switch', 'router', 'gateway', 'hub'].some((k) => String(b.jenis || '').toLowerCase().includes(k)) ? 1 : 0;
      if (isInfraA !== isInfraB) return isInfraB - isInfraA;
      return (a.nama || '').localeCompare(b.nama || '');
    });

    let totalW = 0;
    allChildren.forEach((c, idx) => {
      totalW += measureSubtree(c);
      if (idx < allChildren.length - 1) totalW += HORIZONTAL_GAP;
    });

    node._subtreeWidth = Math.max(CARD_W, totalW);
    return node._subtreeWidth;
  }

  roots.forEach(measureSubtree);

  let totalForestWidth = 0;
  roots.forEach((r, idx) => {
    totalForestWidth += r._subtreeWidth;
    if (idx < roots.length - 1) totalForestWidth += HORIZONTAL_GAP * 2.5;
  });

  let currentRootX = Math.max(80, (w - totalForestWidth) / 2);

  // Posisikan secara rekursif mengakar ke bawah
  function positionSubtree(node, startX, depth) {
    const allChildren = childrenMap.get(node.id) || [];
    const width = node._subtreeWidth;
    const x = startX + width / 2;
    const y = TOP_MARGIN + depth * LEVEL_GAP;

    if (force || !customNodePositions[node.id]) {
      node.mapPos = { x, y };
    } else {
      node.mapPos = { ...customNodePositions[node.id] };
    }

    if (allChildren.length === 0) return;

    if (node._isLeafShelf) {
      const cols = node._cols || 4;
      const shelfW = cols * CARD_W + (cols - 1) * HORIZONTAL_GAP;
      const shelfStartX = startX + (width - shelfW) / 2;
      const shelfStartY = TOP_MARGIN + (depth + 1) * LEVEL_GAP;

      allChildren.sort((a, b) => (a.grup || 'Umum').localeCompare(b.grup || 'Umum'));
      allChildren.forEach((leaf, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const lx = shelfStartX + col * (CARD_W + HORIZONTAL_GAP) + CARD_W / 2;
        const ly = shelfStartY + row * (CARD_H + VERTICAL_GAP);

        if (force || !customNodePositions[leaf.id]) {
          leaf.mapPos = { x: lx, y: ly };
        } else {
          leaf.mapPos = { ...customNodePositions[leaf.id] };
        }
      });
      return;
    }

    // Posisikan anak secara berdampingan simetris di bawah parent
    let childX = startX;
    allChildren.forEach((c) => {
      positionSubtree(c, childX, depth + 1);
      childX += c._subtreeWidth + HORIZONTAL_GAP;
    });
  }

  roots.forEach((r) => {
    positionSubtree(r, currentRootX, 0);
    currentRootX += r._subtreeWidth + HORIZONTAL_GAP * 2.5;
  });

  // Hitung Boundary Box untuk setiap kluster lokasi/grup (minimal 2 perangkat per grup)
  groupBoundaries = [];
  const groupMap = new Map();
  mockDevices.forEach((d) => {
    if (!d.mapPos) return;
    const g = d.grup || 'Umum';
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g).push(d);
  });

  groupMap.forEach((devs, groupName) => {
    if (devs.length < 2) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    devs.forEach((d) => {
      const isInfra = ['switch', 'router', 'gateway', 'server'].some((k) => String(d.jenis || '').toLowerCase().includes(k));
      const hw = (d._cardWidth || (isInfra ? 156 : 144)) / 2;
      const hh = (d._cardHeight || (isInfra ? 48 : 44)) / 2;
      minX = Math.min(minX, d.mapPos.x - hw);
      maxX = Math.max(maxX, d.mapPos.x + hw);
      minY = Math.min(minY, d.mapPos.y - hh);
      maxY = Math.max(maxY, d.mapPos.y + hh);
    });

    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw < 1600 && bh < 1200) {
      groupBoundaries.push({
        grup: groupName,
        minX: minX - 16,
        maxX: maxX + 16,
        minY: minY - 26,
        maxY: maxY + 16,
        count: devs.length,
        onlineCount: devs.filter((d) => d.status === 'online').length,
      });
    }
  });

  // Konfigurasi simpul WAN Cloud & Inter-Router Trunk jika ada router gateway
  if (hasWanCloud) {
    const routerXCoords = rootRouters.map((r) => r.mapPos.x);
    const minRx = Math.min(...routerXCoords);
    const maxRx = Math.max(...routerXCoords);
    const wanX = (minRx + maxRx) / 2;
    const wanY = 48;

    const anyRouterOnline = rootRouters.some((r) => r.status === 'online');
    wanNode = {
      x: wanX,
      y: wanY,
      w: 172,
      h: 38,
      nama: 'Internet / WAN Cloud',
      sublabel: rootRouters.length > 1 ? `Dual Gateway (${rootRouters.length} Router)` : 'Main WAN Uplink',
      icon: '☁️',
      status: anyRouterOnline ? 'online' : 'offline',
      routers: rootRouters,
    };

    // Hubungkan antar-router gateway dengan trunk redundansi jika >= 2
    if (rootRouters.length >= 2) {
      for (let i = 0; i < rootRouters.length - 1; i++) {
        interRouterLinks.push({
          from: rootRouters[i],
          to: rootRouters[i + 1],
          label: '⚡ HA / Trunk Sync',
        });
      }
    }
  }
}

function fitToScreen(w, h) {
  if (mockDevices.length === 0) {
    mapTransform = { x: 0, y: 0, scale: 1 };
    return;
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  mockDevices.forEach((d) => {
    if (!d.mapPos) return;
    minX = Math.min(minX, d.mapPos.x - 75);
    maxX = Math.max(maxX, d.mapPos.x + 75);
    minY = Math.min(minY, d.mapPos.y - 45);
    maxY = Math.max(maxY, d.mapPos.y + 45);
  });
  if (wanNode) {
    minX = Math.min(minX, wanNode.x - wanNode.w / 2 - 20);
    maxX = Math.max(maxX, wanNode.x + wanNode.w / 2 + 20);
    minY = Math.min(minY, wanNode.y - 25);
  }
  groupBoundaries.forEach((gb) => {
    minX = Math.min(minX, gb.minX - 10);
    maxX = Math.max(maxX, gb.maxX + 10);
    minY = Math.min(minY, gb.minY - 10);
    maxY = Math.max(maxY, gb.maxY + 10);
  });
  if (minX === Infinity) {
    mapTransform = { x: 0, y: 0, scale: 1 };
    return;
  }
  const treeW = maxX - minX;
  const treeH = maxY - minY;
  const padding = 50;
  const scaleX = (w - padding * 2) / Math.max(100, treeW);
  const scaleY = (h - padding * 2) / Math.max(100, treeH);
  // Auto scale sesuai kebutuhan compact layout, min 0.35, max 1.25
  const targetScale = Math.max(0.35, Math.min(1.25, Math.min(scaleX, scaleY)));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  mapTransform.scale = targetScale;
  mapTransform.x = w / 2 - centerX * targetScale;
  mapTransform.y = h / 2 - centerY * targetScale;
}

function fitToFilteredNodes(filterGroup, filterJenis) {
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;
  const w = canvas.width;
  const h = canvas.height;

  if (filterGroup === 'all' && filterJenis === 'all') {
    fitToScreen(w, h);
    return;
  }

  const matching = mockDevices.filter((d) => {
    if (!d.mapPos) return false;
    const matchGrp = filterGroup === 'all' || (d.grup || 'Umum') === filterGroup;
    let matchType = true;
    if (filterJenis === 'cctv') matchType = String(d.jenis || '').toLowerCase().includes('cctv');
    else if (filterJenis === 'infra') matchType = ['router', 'switch', 'gateway', 'access point', 'ap'].some(k => String(d.jenis || '').toLowerCase().includes(k));
    else if (filterJenis === 'komputer') matchType = String(d.jenis || '').toLowerCase().includes('komputer');
    return matchGrp && matchType;
  });

  if (matching.length === 0) {
    fitToScreen(w, h);
    return;
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  matching.forEach((d) => {
    minX = Math.min(minX, d.mapPos.x - 75);
    maxX = Math.max(maxX, d.mapPos.x + 75);
    minY = Math.min(minY, d.mapPos.y - 35);
    maxY = Math.max(maxY, d.mapPos.y + 35);
  });

  const boxW = Math.max(160, maxX - minX);
  const boxH = Math.max(120, maxY - minY);
  const padding = 65;
  const scaleX = (w - padding * 2) / boxW;
  const scaleY = (h - padding * 2) / boxH;
  const targetScale = Math.max(0.5, Math.min(1.3, Math.min(scaleX, scaleY)));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  mapTransform.scale = targetScale;
  mapTransform.x = w / 2 - centerX * targetScale;
  mapTransform.y = h / 2 - centerY * targetScale;
}

function focusDeviceOnMap(dev) {
  if (!dev || !dev.mapPos) return;
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  mapTransform.scale = Math.max(1.0, mapTransform.scale);
  mapTransform.x = w / 2 - dev.mapPos.x * mapTransform.scale;
  mapTransform.y = h / 2 - dev.mapPos.y * mapTransform.scale;
}

function findNodeAt(vx, vy) {
  if (wanNode && Math.abs(wanNode.x - vx) <= wanNode.w / 2 && Math.abs(wanNode.y - vy) <= wanNode.h / 2) {
    return { type: 'wan', data: wanNode };
  }
  for (let i = mockDevices.length - 1; i >= 0; i--) {
    const d = mockDevices[i];
    if (!d.mapPos) continue;
    const isInfra = ['switch', 'router', 'gateway', 'server'].some((k) => String(d.jenis || '').toLowerCase().includes(k));
    const halfW = (d._cardWidth || (isInfra ? 156 : 144)) / 2 + 3;
    const halfH = (d._cardHeight || (isInfra ? 48 : 44)) / 2 + 3;
    if (Math.abs(d.mapPos.x - vx) <= halfW && Math.abs(d.mapPos.y - vy) <= halfH) {
      return { type: 'device', data: d };
    }
  }
  return null;
}

function showDeviceMapModal(d) {
  const statusColor = d.status === 'online' ? '#22c55e' : (d.status === 'offline' ? '#ef4444' : '#eab308');
  const statusBadge = `<span style="background:${statusColor}22; color:${statusColor}; border:1px solid ${statusColor}66; padding:3px 10px; border-radius:999px; font-weight:700; font-size:0.8rem;">● ${d.status.toUpperCase()}</span>`;

  // Evaluasi subnet dan parent uplink
  const parentDev = d.parent_id ? mockDevices.find((p) => p.id === d.parent_id) : null;
  const devSub = getSubnetPrefix(d.ip);
  const parentSub = parentDev ? getSubnetPrefix(parentDev.ip) : null;
  const isDiffSubnet = parentDev && parentSub && devSub !== parentSub;

  Swal.fire({
    title: `${getNodeIcon(d.jenis)} ${d.nama}`,
    html: `
      <div style="text-align:left; font-size:0.86rem; display:flex; flex-direction:column; gap:10px; padding:6px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
          <span style="color:#94a3b8;">Status Jaringan</span>
          <div>${statusBadge}</div>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#94a3b8;">Alamat IP & Subnet</span>
          <div style="text-align:right;">
            <code style="color:var(--color-accent); font-weight:700;">${d.ip}</code>
            <div style="font-size:0.75rem; color:#94a3b8;">Subnet: ${devSub}.x</div>
          </div>
        </div>
        ${parentDev ? `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:#94a3b8;">Terhubung ke (Uplink)</span>
          <span style="color:#f1f5f9; font-weight:600;">${getNodeIcon(parentDev.jenis)} ${parentDev.nama} (${parentDev.ip})</span>
        </div>
        ` : ''}
        ${isDiffSubnet ? `
        <div style="padding:6px 10px; border-radius:6px; background:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.4); color:#fdba74; font-size:0.78rem;">
          ⚡ <strong>Rute Inter-VLAN / L3 Aktif</strong>: Perangkat berbeda subnet dengan parent (${devSub}.x vs ${parentSub}.x).
        </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#94a3b8;">Grup & Lokasi</span>
          <span style="color:#f1f5f9;">${d.grup} / ${d.lokasi}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#94a3b8;">Metode Probe</span>
          <span style="color:#cbd5e1; font-weight:600;">${(d.metode || 'icmp').toUpperCase()}</span>
        </div>
        ${d.responseTime !== null && d.responseTime !== undefined ? `
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#94a3b8;">Latensi Respons</span>
          <span style="color:#22c55e; font-weight:700;">${d.responseTime} ms</span>
        </div>` : ''}
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#94a3b8;">Terakhir Online</span>
          <span style="color:#94a3b8;">${d.status === 'online' ? 'Saat Ini' : formatTimeAgo(d.lastOnline)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#94a3b8;">Terakhir Dicek (Ping)</span>
          <span style="color:#38bdf8; font-weight:600;">${d.lastChecked ? formatTimeAgo(d.lastChecked) : 'Belum pernah'}</span>
        </div>
      </div>
      <div style="display:flex; gap:8px; margin-top:16px;">
        <button id="modal-ping-btn" class="btn btn-secondary btn-sm" style="flex:1;">📡 Probe</button>
        <button id="modal-maint-btn" class="btn btn-warning btn-sm" style="flex:1;">🔧 Maintenance</button>
        <button id="modal-detail-btn" class="btn btn-primary btn-sm" style="flex:1;">🔍 Detail</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    target: document.fullscreenElement || document.querySelector('.network-map-wrapper') || 'body',
    background: '#1a1d2e',
    color: '#e2e8f0',
    width: 440,
    didOpen: () => {
      document.getElementById('modal-ping-btn')?.addEventListener('click', () => {
        Swal.close();
        window.dashboardPingDevice(d.id);
      });
      document.getElementById('modal-maint-btn')?.addEventListener('click', () => {
        Swal.close();
        if (d.status === 'maintenance') {
          window.dashboardEndMaintenance(d.id);
        } else {
          window.dashboardSetMaintenance(d.id);
        }
      });
      document.getElementById('modal-detail-btn')?.addEventListener('click', () => {
        Swal.close();
        window.dashboardDetailDevice(d.id);
      });
    },
  });
}

function showWanCloudModal(w) {
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  const routers = w.routers || [];
  const routerListHtml = routers.map((r) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 12px; background:${isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)'}; border-radius:8px; margin-top:6px; border:1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'};">
      <span style="font-weight:600; color:${isLight ? '#0f172a' : '#f1f5f9'};">${getNodeIcon(r.jenis)} ${r.nama}</span>
      <span style="font-family:monospace; color:${isLight ? '#0284c7' : '#38bdf8'}; font-weight:600;">${cleanDeviceIp(r.ip)}</span>
    </div>
  `).join('');

  Swal.fire({
    title: '☁️ Internet / WAN Cloud Backbone',
    html: `
      <div style="text-align:left; font-size:0.86rem; display:flex; flex-direction:column; gap:12px; padding:4px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid ${isLight ? '#e2e8f0' : 'var(--border-color)'}; padding-bottom:8px;">
          <span style="color:${isLight ? '#64748b' : '#94a3b8'};">Arsitektur Uplink</span>
          <span style="color:${isLight ? '#0284c7' : '#38bdf8'}; font-weight:700;">${routers.length > 1 ? `Multi-Gateway Redundan (${routers.length} Router)` : 'Single Gateway Uplink'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:${isLight ? '#64748b' : '#94a3b8'};">Status Konektivitas Luar</span>
          <span style="color:${w.status === 'online' ? '#16a34a' : '#dc2626'}; font-weight:700;">● ${w.status.toUpperCase()}</span>
        </div>
        <div style="margin-top:2px;">
          <div style="font-size:0.75rem; color:${isLight ? '#64748b' : '#94a3b8'}; margin-bottom:4px; font-weight:600;">Router Gateway Aktif:</div>
          ${routerListHtml}
        </div>
        ${routers.length > 1 ? `
        <div style="margin-top:4px; padding:10px 12px; border-radius:8px; background:${isLight ? '#f3e8ff' : 'rgba(168,85,247,0.15)'}; border:1px solid ${isLight ? '#d8b4fe' : 'rgba(168,85,247,0.4)'}; color:${isLight ? '#6b21a8' : '#e9d5ff'}; font-size:0.78rem; line-height:1.45;">
          ⚡ <strong>Inter-Router HA Trunk Redundansi</strong>: Jalur sinkronisasi failover / HA antar router gateway aktif di peta visual.
        </div>
        ` : ''}
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    target: document.fullscreenElement || document.querySelector('.network-map-wrapper') || 'body',
    background: isLight ? '#ffffff' : '#1a1d2e',
    color: isLight ? '#0f172a' : '#e2e8f0',
    width: 440,
  });
}

function getCanvasMouseCoords(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / (rect.width || 1);
  const scaleY = canvas.height / (rect.height || 1);
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  const vx = (mouseX - mapTransform.x) / mapTransform.scale;
  const vy = (mouseY - mapTransform.y) / mapTransform.scale;
  return { mouseX, mouseY, vx, vy, rect };
}

function updateCanvasDimensions(forceLayout = false) {
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return false;
  const container = canvas.parentElement;
  if (!container) return false;

  const rect = container.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(300, Math.floor(rect.height || 580));

  const hasChanged = canvas.width !== width || canvas.height !== height;
  if (hasChanged || forceLayout) {
    canvas.width = width;
    canvas.height = height;
    computeMapLayout(canvas.width, canvas.height, forceLayout);
    fitToScreen(canvas.width, canvas.height);
    return true;
  }
  return false;
}

function initNetworkMap() {
  const canvas = document.getElementById('networkCanvas');
  const tooltip = document.getElementById('map-tooltip');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvasCtx = ctx;

  updateCanvasDimensions(false);

  // ResizeObserver untuk sinkronisasi layout dinamis antar resolusi & perangkat
  const container = canvas.parentElement;
  if (window.ResizeObserver && container && !container._hasResizeObserver) {
    container._hasResizeObserver = true;
    const ro = new ResizeObserver(() => {
      if (currentTab === 'peta') {
        updateCanvasDimensions(false);
      }
    });
    ro.observe(container);
  }

  // Update badge jumlah perangkat di toolbar peta
  const nodeCountBadge = document.getElementById('map-node-count-badge');
  if (nodeCountBadge) {
    nodeCountBadge.textContent = `${mockDevices.length} Perangkat`;
  }

  if (mapAnimId) {
    cancelAnimationFrame(mapAnimId);
    mapAnimId = null;
  }

  const runLoop = () => {
    if (!document.getElementById('networkCanvas')) {
      if (mapAnimId) cancelAnimationFrame(mapAnimId);
      mapAnimId = null;
      return;
    }
    drawMap(ctx, canvas.width, canvas.height);
    mapAnimId = requestAnimationFrame(runLoop);
  };
  runLoop();

  // Proteksi pasang event listener hanya sekali (anti-duplikasi & anti-lompat)
  if (canvas._mapEventsAttached) return;
  canvas._mapEventsAttached = true;

  // Window resize fallback
  window.addEventListener('resize', () => {
    if (currentTab === 'peta') {
      updateCanvasDimensions(false);
    }
  });

  // Mouse interaction
  canvas.addEventListener('mousedown', (e) => {
    const { mouseX, mouseY, vx, vy } = getCanvasMouseCoords(e, canvas);
    const hit = findNodeAt(vx, vy);

    dragStartMouse = { x: mouseX, y: mouseY };
    isNodeMoved = false;

    if (hit) {
      draggedNode = hit;
    } else {
      isDragging = true;
    }
    lastMouse = { x: mouseX, y: mouseY };
  });

  canvas.addEventListener('mousemove', (e) => {
    const { mouseX, mouseY, vx, vy, rect } = getCanvasMouseCoords(e, canvas);

    if (draggedNode) {
      const dx = (mouseX - lastMouse.x) / mapTransform.scale;
      const dy = (mouseY - lastMouse.y) / mapTransform.scale;
      if (Math.hypot(mouseX - dragStartMouse.x, mouseY - dragStartMouse.y) > 4) {
        isNodeMoved = true;
      }
      if (draggedNode.type === 'device') {
        draggedNode.data.mapPos.x += dx;
        draggedNode.data.mapPos.y += dy;
        customNodePositions[draggedNode.data.id] = { ...draggedNode.data.mapPos };
      } else if (draggedNode.type === 'wan') {
        draggedNode.data.x += dx;
        draggedNode.data.y += dy;
      }
      lastMouse = { x: mouseX, y: mouseY };
      if (tooltip) tooltip.style.display = 'none';
      return;
    }

    if (isDragging) {
      mapTransform.x += mouseX - lastMouse.x;
      mapTransform.y += mouseY - lastMouse.y;
      lastMouse = { x: mouseX, y: mouseY };
      if (tooltip) tooltip.style.display = 'none';
      return;
    }

    // Hover tooltip
    const hit = findNodeAt(vx, vy);
    if (hit && tooltip) {
      canvas.style.cursor = 'pointer';
      if (hit.type === 'wan') {
        const w = hit.data;
        tooltip.innerHTML = `
          <div style="font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
            <span>☁️</span>
            <span>${w.nama}</span>
          </div>
          <div style="color:#94a3b8; font-size:0.75rem; margin:2px 0;">Pusat Gerbang Jaringan Luar (Internet/ISP Backbone)</div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
            <span style="color:#22c55e; font-weight:700;">● ${w.status.toUpperCase()}</span>
          </div>
          <div style="font-size:0.72rem; color:#38bdf8; margin-top:4px;">
            🌐 Terhubung ke ${w.routers?.length || 0} Router Gateway Aktif
          </div>
        `;
      } else {
        const d = hit.data;
        const color = d.status === 'online' ? '#22c55e' : (d.status === 'offline' ? '#ef4444' : '#eab308');
        const devSub = getSubnetPrefix(d.ip);
        const parentDev = d._effectiveParent || getDeviceParent(d);
        const parentSub = parentDev ? getSubnetPrefix(parentDev.ip) : null;
        const isDiffSub = parentDev && parentSub && devSub !== parentSub;

        const displayIp = cleanDeviceIp(d.ip);
        const isRtsp = String(d.ip || '').includes('rtsp://') || String(d.metode || '').toUpperCase() === 'RTSP';

        tooltip.innerHTML = `
          <div style="font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
            <span>${getNodeIcon(d.jenis)}</span>
            <span>${d.nama}</span>
          </div>
          <div style="font-family:monospace; color:#94a3b8; font-size:0.75rem; margin:2px 0;">
            ${displayIp} <span style="color:#64748b;">(${devSub}.x)</span>
            ${isRtsp ? '<span style="font-size:0.65rem; background:rgba(99,102,241,0.25); color:#a5b4fc; padding:1px 5px; border-radius:3px; margin-left:4px;">📹 RTSP</span>' : ''}
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
            <span style="color:${color}; font-weight:700;">● ${(d.status || 'unknown').toUpperCase()}</span>
            ${d.responseTime !== null && d.responseTime !== undefined ? `<span style="color:#22c55e;">${d.responseTime}ms</span>` : ''}
          </div>
          ${parentDev ? `
          <div style="font-size:0.72rem; color:#cbd5e1; margin-top:4px;">
            ↳ Terhubung ke: <strong>${parentDev.nama}</strong> (${cleanDeviceIp(parentDev.ip)})
          </div>
          ` : '<div style="font-size:0.72rem; color:#38bdf8; margin-top:4px;">🌐 Router Gateway Utama / Root</div>'}
          ${isDiffSub ? `
          <div style="margin-top:4px; font-size:0.72rem; color:#fdba74; background:rgba(249,115,22,0.18); border:1px solid rgba(249,115,22,0.35); border-radius:4px; padding:2px 6px;">
            ⚡ Rute Inter-VLAN / L3 (${devSub}.x ➔ ${parentSub}.x)
          </div>
          ` : ''}
          <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Klik untuk tindakan & detail</div>
        `;
      }

      const tipX = e.clientX - rect.left;
      const tipY = e.clientY - rect.top;
      tooltip.style.left = `${Math.min(rect.width - 220, tipX + 15)}px`;
      tooltip.style.top = `${Math.min(rect.height - 100, tipY + 15)}px`;
      tooltip.style.display = 'block';
    } else {
      canvas.style.cursor = 'grab';
      if (tooltip) tooltip.style.display = 'none';
    }
  });

  const endDrag = () => {
    if (draggedNode && !isNodeMoved) {
      if (draggedNode.type === 'device') {
        showDeviceMapModal(draggedNode.data);
      } else if (draggedNode.type === 'wan') {
        showWanCloudModal(draggedNode.data);
      }
    }
    draggedNode = null;
    isDragging = false;
  };

  canvas.addEventListener('mouseup', endDrag);
  canvas.addEventListener('mouseleave', () => {
    endDrag();
    if (tooltip) tooltip.style.display = 'none';
  });

  // Touch interaction untuk perangkat mobile (Drag Node, Pan Canvas, Pinch Zoom & Tap Info)
  let touchStartDist = 0;
  let touchStartScale = 1;
  let touchStartMid = { x: 0, y: 0 };
  let touchMoved = false;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const { mouseX, mouseY, vx, vy } = getCanvasMouseCoords(t, canvas);
      dragStartMouse = { x: mouseX, y: mouseY };
      lastMouse = { x: mouseX, y: mouseY };
      isNodeMoved = false;
      touchMoved = false;
      const hit = findNodeAt(vx, vy);
      if (hit) {
        draggedNode = hit;
      } else {
        isDragging = true;
      }
    } else if (e.touches.length === 2) {
      draggedNode = null;
      isDragging = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartScale = mapTransform.scale;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / (rect.width || 1);
      const scaleY = canvas.height / (rect.height || 1);
      touchStartMid = {
        x: ((t1.clientX + t2.clientX) / 2 - rect.left) * scaleX,
        y: ((t1.clientY + t2.clientY) / 2 - rect.top) * scaleY,
      };
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const { mouseX, mouseY } = getCanvasMouseCoords(t, canvas);
      const dist = Math.hypot(mouseX - dragStartMouse.x, mouseY - dragStartMouse.y);
      if (dist > 6) {
        isNodeMoved = true;
        touchMoved = true;
      }

      if (draggedNode) {
        const dx = (mouseX - lastMouse.x) / mapTransform.scale;
        const dy = (mouseY - lastMouse.y) / mapTransform.scale;
        if (draggedNode.type === 'device') {
          draggedNode.data.mapPos.x += dx;
          draggedNode.data.mapPos.y += dy;
          customNodePositions[draggedNode.data.id] = { ...draggedNode.data.mapPos };
        } else if (draggedNode.type === 'wan') {
          draggedNode.data.x += dx;
          draggedNode.data.y += dy;
        }
        lastMouse = { x: mouseX, y: mouseY };
        if (tooltip) tooltip.style.display = 'none';
        return;
      }

      if (isDragging) {
        mapTransform.x += mouseX - lastMouse.x;
        mapTransform.y += mouseY - lastMouse.y;
        lastMouse = { x: mouseX, y: mouseY };
        if (tooltip) tooltip.style.display = 'none';
        return;
      }
    } else if (e.touches.length === 2 && touchStartDist > 0) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const factor = currentDist / touchStartDist;
      const newScale = Math.max(0.18, Math.min(3.0, touchStartScale * factor));
      mapTransform.x = touchStartMid.x - (touchStartMid.x - mapTransform.x) * (newScale / mapTransform.scale);
      mapTransform.y = touchStartMid.y - (touchStartMid.y - mapTransform.y) * (newScale / mapTransform.scale);
      mapTransform.scale = newScale;
      if (tooltip) tooltip.style.display = 'none';
    }
  }, { passive: false });

  const endTouch = (e) => {
    if (e.touches.length === 0) {
      if (draggedNode && !touchMoved) {
        if (draggedNode.type === 'device') {
          showDeviceMapModal(draggedNode.data);
        } else if (draggedNode.type === 'wan') {
          showWanCloudModal(draggedNode.data);
        }
      }
      draggedNode = null;
      isDragging = false;
      touchStartDist = 0;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const { mouseX, mouseY } = getCanvasMouseCoords(t, canvas);
      lastMouse = { x: mouseX, y: mouseY };
      dragStartMouse = { x: mouseX, y: mouseY };
      touchStartDist = 0;
    }
  };

  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', () => {
    draggedNode = null;
    isDragging = false;
    touchStartDist = 0;
  });

  // Wheel zoom interaktif berpusat kursor
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { mouseX, mouseY } = getCanvasMouseCoords(e, canvas);
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.max(0.18, Math.min(3.0, mapTransform.scale * zoomFactor));
    mapTransform.x = mouseX - (mouseX - mapTransform.x) * (newScale / mapTransform.scale);
    mapTransform.y = mouseY - (mouseY - mapTransform.y) * (newScale / mapTransform.scale);
    mapTransform.scale = newScale;
  }, { passive: false });

  // Toolbar events
  document.getElementById('map-zoom-in')?.addEventListener('click', () => {
    mapTransform.scale = Math.min(3.0, mapTransform.scale * 1.2);
  });
  document.getElementById('map-zoom-out')?.addEventListener('click', () => {
    mapTransform.scale = Math.max(0.18, mapTransform.scale * 0.83);
  });
  document.getElementById('map-filter-group')?.addEventListener('change', (e) => {
    mapFilterGroup = e.target.value;
    fitToFilteredNodes(mapFilterGroup, mapFilterJenis);
  });

  document.getElementById('map-filter-jenis')?.addEventListener('change', (e) => {
    mapFilterJenis = e.target.value;
    fitToFilteredNodes(mapFilterGroup, mapFilterJenis);
  });

  document.getElementById('map-fit-screen')?.addEventListener('click', () => {
    updateCanvasDimensions(false);
    fitToFilteredNodes(mapFilterGroup, mapFilterJenis);
  });

  document.getElementById('map-reset')?.addEventListener('click', () => {
    mapFilterGroup = 'all';
    mapFilterJenis = 'all';
    const grp = document.getElementById('map-filter-group');
    if (grp) grp.value = 'all';
    const jns = document.getElementById('map-filter-jenis');
    if (jns) jns.value = 'all';
    const sch = document.getElementById('map-search-input');
    if (sch) sch.value = '';
    mapSearchQuery = '';
    mapTransform = { x: 0, y: 0, scale: 1 };
    updateCanvasDimensions(false);
    fitToScreen(canvas.width, canvas.height);
  });
  document.getElementById('map-auto-layout')?.addEventListener('click', () => {
    customNodePositions = {};
    updateCanvasDimensions(true);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Topologi berhasil diselaraskan otomatis!',
      timer: 1500,
      showConfirmButton: false,
      target: document.fullscreenElement || document.querySelector('.network-map-wrapper') || 'body',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
  });

  // Fullscreen toggle (Native Browser Fullscreen API + Fallback CSS)
  const toggleMapFullscreen = async () => {
    const wrapper = document.querySelector('.network-map-wrapper');
    if (!wrapper) return;

    const isCurrentlyFs = Boolean(document.fullscreenElement) || wrapper.classList.contains('fullscreen');

    if (!isCurrentlyFs) {
      wrapper.classList.add('fullscreen');
      document.body.classList.add('map-fullscreen-active');
      const btn = document.getElementById('map-fullscreen');
      if (btn) btn.innerHTML = '✕ Keluar Layar Penuh';
      try {
        if (wrapper.requestFullscreen) {
          await wrapper.requestFullscreen();
        }
      } catch (err) {
        // Fallback jika API native diblokir, CSS class tetap aktif
      }
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (err) {}
      wrapper.classList.remove('fullscreen');
      document.body.classList.remove('map-fullscreen-active');
      const btn = document.getElementById('map-fullscreen');
      if (btn) btn.innerHTML = '⛶ Layar Penuh';
    }

    requestAnimationFrame(() => {
      updateCanvasDimensions(true);
      setTimeout(() => updateCanvasDimensions(true), 180);
    });
  };

  document.getElementById('map-fullscreen')?.addEventListener('click', toggleMapFullscreen);

  // Sync event saat user keluar dari fullscreen (misal via tombol ESC keyboard)
  const onMapFsChange = () => {
    const wrapper = document.querySelector('.network-map-wrapper');
    if (!wrapper) return;
    const isNativeFs = Boolean(document.fullscreenElement);
    if (!isNativeFs) {
      wrapper.classList.remove('fullscreen');
      document.body.classList.remove('map-fullscreen-active');
      const btn = document.getElementById('map-fullscreen');
      if (btn) btn.innerHTML = '⛶ Layar Penuh';
    } else {
      wrapper.classList.add('fullscreen');
      document.body.classList.add('map-fullscreen-active');
      const btn = document.getElementById('map-fullscreen');
      if (btn) btn.innerHTML = '✕ Keluar Layar Penuh';
    }
    requestAnimationFrame(() => {
      updateCanvasDimensions(true);
      setTimeout(() => updateCanvasDimensions(true), 180);
    });
  };

  if (!window._mapFsAttached) {
    window._mapFsAttached = true;
    document.addEventListener('fullscreenchange', onMapFsChange);
  }

  // Search input filter
  document.getElementById('map-search-input')?.addEventListener('input', (e) => {
    mapSearchQuery = (e.target.value || '').trim().toLowerCase();
    if (mapSearchQuery.length > 0) {
      const match = mockDevices.find((d) =>
        (d.nama || '').toLowerCase().includes(mapSearchQuery) ||
        (d.ip || '').toLowerCase().includes(mapSearchQuery)
      );
      if (match) {
        focusDeviceOnMap(match);
      }
    }
  });

  document.getElementById('map-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const match = mockDevices.find((d) =>
        (d.nama || '').toLowerCase().includes(mapSearchQuery) ||
        (d.ip || '').toLowerCase().includes(mapSearchQuery)
      );
      if (match) {
        focusDeviceOnMap(match);
      }
    }
  });
}

function drawMap(ctx, w, h) {
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(mapTransform.x, mapTransform.y);
  ctx.scale(mapTransform.scale, mapTransform.scale);

  // Background grid dots
  ctx.fillStyle = isLight ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.04)';
  const step = 32;
  const boundX = (w * 4) / mapTransform.scale;
  const boundY = (h * 4) / mapTransform.scale;
  const startX = -boundX + (mapTransform.x % step);
  const startY = -boundY + (mapTransform.y % step);
  for (let x = startX; x < boundX; x += step) {
    for (let y = startY; y < boundY; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Jika tidak ada perangkat di database
  if (mockDevices.length === 0) {
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText('📡 Belum ada perangkat untuk dipetakan di topologi jaringan', w / 2, h / 2 - 12);
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = isLight ? '#94a3b8' : '#64748b';
    ctx.fillText('Tambahkan perangkat baru atau login mode preview untuk simulasi visual', w / 2, h / 2 + 14);
    ctx.restore();
    return;
  }

  const now = Date.now();
  const currentScale = mapTransform.scale;
  const isSearchActive = mapSearchQuery.length > 0;

  // 00. Draw Group Boundary Boxes (Kluster Lokasi / Kantor)
  groupBoundaries.forEach((gb) => {
    const isFiltered = mapFilterGroup !== 'all' && mapFilterGroup !== gb.grup;
    const isHighlighted = mapFilterGroup === gb.grup;

    ctx.save();
    const bw = gb.maxX - gb.minX;
    const bh = gb.maxY - gb.minY;

    if (isFiltered) {
      ctx.globalAlpha = 0.14;
    }

    const fillColor = isHighlighted
      ? (isLight ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.12)')
      : (isLight ? 'rgba(15, 23, 42, 0.02)' : 'rgba(255, 255, 255, 0.02)');
    const borderColor = isHighlighted
      ? '#6366f1'
      : (isLight ? 'rgba(148, 163, 184, 0.45)' : 'rgba(99, 102, 241, 0.28)');

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isHighlighted ? 1.8 : 1.2;
    ctx.setLineDash(isHighlighted ? [] : [6, 4]);

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(gb.minX, gb.minY, bw, bh, 10);
    } else {
      ctx.rect(gb.minX, gb.minY, bw, bh);
    }
    ctx.fill();
    ctx.stroke();

    // Group Title Pill Tag di pojok kiri atas
    ctx.setLineDash([]);
    const tagH = 18;
    ctx.font = 'bold 9.5px Inter, sans-serif';
    const tagText = `📍 ${gb.grup} (${gb.onlineCount}/${gb.count})`;
    const tagW = ctx.measureText(tagText).width + 16;

    ctx.fillStyle = isHighlighted
      ? '#6366f1'
      : (isLight ? '#e2e8f0' : 'rgba(30, 41, 59, 0.90)');
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(gb.minX + 8, gb.minY - 9, tagW, tagH, 5);
    } else {
      ctx.rect(gb.minX + 8, gb.minY - 9, tagW, tagH);
    }
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isHighlighted
      ? '#ffffff'
      : (isLight ? '#334155' : '#cbd5e1');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, gb.minX + 8 + tagW / 2, gb.minY);

    ctx.restore();
  });

  // 0a. WAN Uplink Links (Internet / Cloud -> Router Gateways)
  if (wanNode && wanNode.routers && wanNode.routers.length > 0) {
    wanNode.routers.forEach((r) => {
      if (!r.mapPos) return;
      const wx = wanNode.x;
      const wy = wanNode.y + wanNode.h / 2;
      const rx = r.mapPos.x;
      const ry = r.mapPos.y - (r._cardHeight ? r._cardHeight / 2 : 22);
      const midY = (wy + ry) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.bezierCurveTo(wx, midY, rx, midY, rx, ry);

      if (r.status === 'online') {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        // Animasi paket WAN mengalir ke router
        const t = ((now / 2000) + (r.id * 0.25)) % 1;
        const bX = Math.pow(1 - t, 3) * wx + 3 * Math.pow(1 - t, 2) * t * wx + 3 * (1 - t) * Math.pow(t, 2) * rx + Math.pow(t, 3) * rx;
        const bY = Math.pow(1 - t, 3) * wy + 3 * Math.pow(1 - t, 2) * t * midY + 3 * (1 - t) * Math.pow(t, 2) * midY + Math.pow(t, 3) * ry;

        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(bX, bY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  // 0b. Inter-Router HA Trunk Redundancy Links (Router 1 <-> Router 2)
  if (interRouterLinks && interRouterLinks.length > 0) {
    interRouterLinks.forEach((link) => {
      const { from, to, label } = link;
      if (!from.mapPos || !to.mapPos) return;

      const fx = from.mapPos.x + (from._cardWidth ? from._cardWidth / 2 : 72);
      const fy = from.mapPos.y;
      const tx = to.mapPos.x - (to._cardWidth ? to._cardWidth / 2 : 72);
      const ty = to.mapPos.y;
      const midX = (fx + tx) / 2;
      const midY = (fy + ty) / 2 - 16;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.moveTo(fx, fy);
      ctx.bezierCurveTo(fx + (tx - fx) * 0.3, midY, tx - (tx - fx) * 0.3, midY, tx, ty);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();

      // Animasi bolak-balik trunk sync
      const t = (now / 1600) % 1;
      const bX = Math.pow(1 - t, 3) * fx + 3 * Math.pow(1 - t, 2) * t * (fx + (tx - fx) * 0.3) + 3 * (1 - t) * Math.pow(t, 2) * (tx - (tx - fx) * 0.3) + Math.pow(t, 3) * tx;
      const bY = Math.pow(1 - t, 3) * fy + 3 * Math.pow(1 - t, 2) * t * midY + 3 * (1 - t) * Math.pow(t, 2) * midY + Math.pow(t, 3) * ty;

      ctx.save();
      ctx.fillStyle = '#c084fc';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(bX, bY, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Label badge inter-router di tengah
      if (currentScale >= 0.45) {
        ctx.save();
        ctx.font = 'bold 9px Inter, sans-serif';
        const txt = label || '⚡ HA Sync';
        const textW = ctx.measureText(txt).width;
        const bw = textW + 14;
        const bh = 18;
        const bx = midX - bw / 2;
        const by = midY - bh / 2;

        ctx.fillStyle = isLight ? '#f3e8ff' : '#241442';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bx, by, bw, bh, 9);
        } else {
          ctx.rect(bx, by, bw, bh);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isLight ? '#7e22ce' : '#e9d5ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, midX, midY + 0.5);
        ctx.restore();
      }
    });
  }

  // 1. Connection: Garis pohon mengakar ke bawah (Hierarchical Cubic Bezier)
  mockDevices.forEach((d) => {
    if (!d.mapPos) return;
    const parent = d._effectiveParent || getDeviceParent(d);
    if (!parent || !parent.mapPos) return;

    const isFilteredOut = (mapFilterGroup !== 'all' && (d.grup || 'Umum') !== mapFilterGroup) ||
      (mapFilterJenis === 'cctv' && !String(d.jenis || '').toLowerCase().includes('cctv')) ||
      (mapFilterJenis === 'infra' && !['router', 'switch', 'gateway', 'access point', 'ap'].some((k) => String(d.jenis || '').toLowerCase().includes(k))) ||
      (mapFilterJenis === 'komputer' && !String(d.jenis || '').toLowerCase().includes('komputer'));

    const parentH = parent._cardHeight || (['switch', 'router', 'gateway', 'server'].some((k) => String(parent.jenis || '').toLowerCase().includes(k)) ? 48 : 44);
    const childH = d._cardHeight || 44;

    const px = parent.mapPos.x;
    const py = parent.mapPos.y + parentH / 2;
    const cx = d.mapPos.x;
    const cy = d.mapPos.y - childH / 2;
    const midY = (py + cy) / 2;

    const devSub = getSubnetPrefix(d.ip);
    const parentSub = getSubnetPrefix(parent.ip);
    const isL3 = devSub && parentSub && devSub !== parentSub;

    ctx.save();
    if (isFilteredOut) {
      ctx.globalAlpha = 0.12;
    }

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.bezierCurveTo(px, midY, cx, midY, cx, cy);

    if (d.status === 'online') {
      ctx.strokeStyle = isL3 ? 'rgba(249, 115, 22, 0.7)' : 'rgba(34, 197, 94, 0.55)';
      ctx.lineWidth = isL3 ? 2.0 : 1.8;
      ctx.stroke();

      // Animasi paket data mengalir turun dari parent ke child
      const t = ((now / 2200) + (d.id * 0.17)) % 1;
      const bX = Math.pow(1 - t, 3) * px + 3 * Math.pow(1 - t, 2) * t * px + 3 * (1 - t) * Math.pow(t, 2) * cx + Math.pow(t, 3) * cx;
      const bY = Math.pow(1 - t, 3) * py + 3 * Math.pow(1 - t, 2) * t * midY + 3 * (1 - t) * Math.pow(t, 2) * midY + Math.pow(t, 3) * cy;

      ctx.fillStyle = isL3 ? '#fb923c' : '#4ade80';
      ctx.beginPath();
      ctx.arc(bX, bY, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.status === 'maintenance') {
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  });

  // 2. Draw Devices as Modern Kapsul / Badge Cards
  mockDevices.forEach((d) => {
    if (!d.mapPos) return;
    const isInfra = ['switch', 'router', 'gateway', 'server'].some((k) => String(d.jenis || '').toLowerCase().includes(k));
    const isOnline = d.status === 'online';
    const isOffline = d.status === 'offline';
    const statusColor = isOnline ? '#22c55e' : (isOffline ? '#ef4444' : '#eab308');
    const statusGlow = isOnline ? 'rgba(34, 197, 94, 0.35)' : (isOffline ? 'rgba(239, 68, 68, 0.4)' : 'rgba(234, 179, 8, 0.35)');

    const isFilteredOut = (mapFilterGroup !== 'all' && (d.grup || 'Umum') !== mapFilterGroup) ||
      (mapFilterJenis === 'cctv' && !String(d.jenis || '').toLowerCase().includes('cctv')) ||
      (mapFilterJenis === 'infra' && !['router', 'switch', 'gateway', 'access point', 'ap'].some((k) => String(d.jenis || '').toLowerCase().includes(k))) ||
      (mapFilterJenis === 'komputer' && !String(d.jenis || '').toLowerCase().includes('komputer'));

    const isSearchMatch = isSearchActive && (
      (d.nama || '').toLowerCase().includes(mapSearchQuery) ||
      (d.ip || '').toLowerCase().includes(mapSearchQuery)
    );

    const cardW = isInfra ? 156 : 144;
    const cardH = isInfra ? 48 : 44;
    const cardX = d.mapPos.x - cardW / 2;
    const cardY = d.mapPos.y - cardH / 2;
    d._cardWidth = cardW;
    d._cardHeight = cardH;

    ctx.save();
    if (isFilteredOut) {
      ctx.globalAlpha = 0.14;
    }

    // Search focus pulsing outer ring
    if (isSearchMatch) {
      const ringPulse = ((now / 800) % 1);
      ctx.save();
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.85 * (1 - ringPulse)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardX - 4 - ringPulse * 8, cardY - 4 - ringPulse * 8, cardW + 8 + ringPulse * 16, cardH + 8 + ringPulse * 16, 12);
      } else {
        ctx.rect(cardX - 4 - ringPulse * 8, cardY - 4 - ringPulse * 8, cardW + 8 + ringPulse * 16, cardH + 8 + ringPulse * 16);
      }
      ctx.stroke();
      ctx.restore();
    }

    // A. Card Background & Shadow
    ctx.save();
    ctx.shadowColor = statusGlow;
    ctx.shadowBlur = isOnline ? 8 : 4;
    ctx.fillStyle = isLight
      ? (isOnline ? '#ffffff' : (isOffline ? '#fff1f2' : '#fefce8'))
      : (isOnline ? 'rgba(15, 23, 42, 0.92)' : (isOffline ? 'rgba(35, 15, 18, 0.92)' : 'rgba(35, 30, 15, 0.92)'));

    ctx.strokeStyle = isInfra
      ? (isOnline ? '#38bdf8' : '#ef4444')
      : (isOnline ? 'rgba(34, 197, 94, 0.65)' : (isOffline ? 'rgba(239, 68, 68, 0.7)' : 'rgba(234, 179, 8, 0.65)'));
    ctx.lineWidth = isInfra ? 1.8 : 1.2;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
    } else {
      ctx.rect(cardX, cardY, cardW, cardH);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // B. Left Icon Bubble (Besar, tajam, dan kontras)
    const bubbleRadius = isInfra ? 16 : 14.5;
    const bubbleX = cardX + bubbleRadius + 7;
    const bubbleY = d.mapPos.y;

    ctx.save();
    ctx.fillStyle = isOnline
      ? (isLight ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.22)')
      : (isLight ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.25)');
    ctx.beginPath();
    ctx.arc(bubbleX, bubbleY, bubbleRadius, 0, Math.PI * 2);
    ctx.fill();

    // Status dot at corner of bubble
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(bubbleX + bubbleRadius * 0.72, bubbleY - bubbleRadius * 0.72, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing aura on online devices
    if (isOnline) {
      const pulsePhase = ((now / 1500) + d.id * 0.2) % 1;
      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, bubbleRadius + pulsePhase * 5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.45 * (1 - pulsePhase)})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Emoji Icon inside bubble (Besar dan selalu terlihat jelas)
    ctx.font = isInfra ? '17px sans-serif' : '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getNodeIcon(d.jenis), bubbleX, bubbleY + 0.5);
    ctx.restore();

    // C. Right Side: Text Information (Nama + IP + Latency)
    const textStartX = bubbleX + bubbleRadius + 8;

    // Line 1: Device Name
    ctx.save();
    ctx.font = isInfra ? 'bold 10.5px Inter, sans-serif' : '600 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';

    let displayName = d.nama || 'Device';
    if (displayName.length > 14) {
      displayName = displayName.substring(0, 13) + '…';
    }
    ctx.fillText(displayName, textStartX, bubbleY - (isInfra ? 8 : 7));

    // Line 2: IP Address
    ctx.font = '9px monospace';
    ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
    const cleanIp = cleanDeviceIp(d.ip);
    let displayIpText = cleanIp;
    if (displayIpText.length > 15) {
      displayIpText = displayIpText.substring(0, 14) + '…';
    }
    ctx.fillText(displayIpText, textStartX, bubbleY + (isInfra ? 8 : 7));

    // Latency badge / pill if online
    if (isOnline) {
      const ms = (d.responseTime !== null && d.responseTime !== undefined && d.responseTime > 0) ? d.responseTime : 1;
      ctx.font = 'bold 8.5px Inter, sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.textAlign = 'right';
      ctx.fillText(`${ms}ms`, cardX + cardW - 7, bubbleY - (isInfra ? 8 : 7));
    }
    ctx.restore();

    ctx.restore();
  });

  // 3. Draw WAN Cloud Node Body (Pusat Internet / Gateway Uplink)
  if (wanNode) {
    ctx.save();
    const wx = wanNode.x;
    const wy = wanNode.y;
    const ww = wanNode.w;
    const wh = wanNode.h;

    // Glowing aura jika online
    ctx.shadowColor = wanNode.status === 'online' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(239, 68, 68, 0.4)';
    ctx.shadowBlur = 12;

    // Background pill
    ctx.fillStyle = isLight ? '#f0f9ff' : '#082f49';
    ctx.strokeStyle = wanNode.status === 'online' ? '#38bdf8' : '#ef4444';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(wx - ww / 2, wy - wh / 2, ww, wh, wh / 2);
    } else {
      ctx.rect(wx - ww / 2, wy - wh / 2, ww, wh);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // WAN Cloud text & status indicator
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = isLight ? '#0369a1' : '#f0f9ff';
    ctx.fillText(`${wanNode.icon} ${wanNode.nama}`, wx, wy - 5);

    ctx.font = '600 9px Inter, sans-serif';
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.fillText(wanNode.sublabel, wx, wy + 8);
    ctx.restore();
  }

  ctx.restore();
}

// ---- DETAIL MODAL DRILL-DOWN GLOBAL STATUS ----
function showHourDetailModal(hourData) {
  if (!hourData) return;
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  const online = hourData.online || 0;
  const offline = hourData.offline || 0;
  const maintenance = hourData.maintenance || 0;
  const nodata = hourData.nodata || 0;
  const devices = hourData.devices || [];

  const deviceRows = devices.map((d) => {
    let badgeHtml = '';
    let latencyText = '-';

    if (d.statusAtHour === 'online') {
      badgeHtml = '<span class="chip chip-online">🟢 Online</span>';
      latencyText = `${d.latencyAtHour || d.responseTime || 1} ms`;
    } else if (d.statusAtHour === 'offline') {
      badgeHtml = '<span class="chip chip-offline">🔴 Offline</span>';
      latencyText = 'Timeout';
    } else if (d.statusAtHour === 'maintenance') {
      badgeHtml = '<span class="chip chip-maintenance">🟡 Maintenance</span>';
      latencyText = 'Maint.';
    } else {
      badgeHtml = `<span class="chip" style="background:${isLight ? '#e2e8f0' : 'rgba(148,163,184,0.15)'}; color:var(--color-muted);">⚪ Belum Ada</span>`;
      latencyText = '-';
    }

    return `
      <tr style="border-bottom:1px solid ${isLight ? '#e2e8f0' : 'var(--border-color)'};">
        <td style="padding:8px 10px; font-weight:600; color:var(--color-text); text-align:left;">
          ${getNodeIcon(d.jenis)} ${d.nama}
        </td>
        <td style="padding:8px 10px; font-family:var(--font-mono); font-size:0.8rem; color:${isLight ? '#0284c7' : '#38bdf8'};" title="${d.ip}">${cleanDeviceIp(d.ip)}</td>
        <td style="padding:8px 10px; font-size:0.8rem; color:var(--color-muted);">${d.grup || 'Umum'}</td>
        <td style="padding:8px 10px;">${badgeHtml}</td>
        <td style="padding:8px 10px; font-family:var(--font-mono); font-size:0.8rem; color:${d.statusAtHour === 'online' ? 'var(--color-online)' : 'var(--color-muted)'};">${latencyText}</td>
      </tr>
    `;
  }).join('');

  Swal.fire({
    title: `<div style="font-size:1.15rem; font-weight:700; color:var(--color-heading); display:flex; align-items:center; justify-content:center; gap:8px;">
      <span>🕒 Status Perangkat — Pukul ${hourData.hour}</span>
    </div>`,
    html: `
      <div style="margin-bottom:14px; display:flex; justify-content:center; gap:8px; flex-wrap:wrap; font-size:0.8rem;">
        <span class="chip chip-online">🟢 Online: <b>${online}</b></span>
        <span class="chip chip-offline">🔴 Offline: <b>${offline}</b></span>
        ${maintenance > 0 ? `<span class="chip chip-maintenance">🟡 Maintenance: <b>${maintenance}</b></span>` : ''}
        ${nodata > 0 ? `<span class="chip" style="background:${isLight ? '#f1f5f9' : 'rgba(148,163,184,0.15)'}; color:var(--color-muted);">⚪ Belum Didaftarkan: <b>${nodata}</b></span>` : ''}
      </div>
      <div style="max-height:360px; overflow-y:auto; border:1px solid ${isLight ? '#e2e8f0' : 'var(--border-color)'}; border-radius:8px; margin-top:10px;">
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; text-align:left;">
          <thead style="background:${isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)'}; border-bottom:1px solid ${isLight ? '#e2e8f0' : 'var(--border-color)'}; color:var(--color-muted); position:sticky; top:0; z-index:1;">
            <tr>
              <th style="padding:8px 10px;">Perangkat</th>
              <th style="padding:8px 10px;">IP Address</th>
              <th style="padding:8px 10px;">Grup</th>
              <th style="padding:8px 10px;">Status</th>
              <th style="padding:8px 10px;">Latency</th>
            </tr>
          </thead>
          <tbody>
            ${devices.length > 0 ? deviceRows : `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--color-muted);">Tidak ada perangkat terdaftar pada jam ini</td></tr>`}
          </tbody>
        </table>
      </div>
    `,
    width: 660,
    showCloseButton: true,
    showConfirmButton: false,
    background: isLight ? '#ffffff' : '#1a1d2e',
    color: isLight ? '#0f172a' : '#e2e8f0',
  });
}

// ---- TIMELINE ----
function initTimeline() {
  const now = new Date();

  // Selalu sinkronkan opsi dropdown perangkat terlebih dahulu
  const select = document.getElementById('timeline-device-select');
  if (select) {
    if (mockDevices.length === 0) {
      select.innerHTML = '<option value="">(Belum ada perangkat terdaftar)</option>';
      select.disabled = true;
    } else {
      select.disabled = false;
      const currentVal = select.value;
      select.innerHTML = mockDevices.map((d) => {
        const isOnline = d.status === 'online';
        const isMaint = d.status === 'maintenance';
        const icon = isOnline ? '🟢' : isMaint ? '🟡' : '🔴';
        const statusText = isOnline ? 'Online' : isMaint ? 'Maintenance' : 'Offline';
        const isSelected = String(d.id) === currentVal;
        const displayIp = cleanDeviceIp(d.ip);
        return `<option value="${d.id}" ${isSelected ? 'selected' : ''}>${icon} ${d.nama} (${displayIp}) — ${statusText}</option>`;
      }).join('');

      if (!select.value && mockDevices.length > 0) {
        select.value = String(mockDevices[0].id);
      }
    }
  }

  if (mockDevices.length === 0) {
    const aggData = Array.from({ length: 24 }, (_, i) => {
      const hTime = new Date(now.getTime() - (23 - i) * 3600000);
      const hourLabel = `${hTime.getHours().toString().padStart(2, '0')}:00`;
      return {
        hour: hourLabel,
        online: 0,
        offline: 0,
        maintenance: 0,
        nodata: 0,
        devices: [],
      };
    });
    renderAggregateTimeline('aggregate-timeline-chart', aggData, showHourDetailModal);
    renderTimeline24h('timeline-chart', []);
    return;
  }

  // Bangun data agregat global 24 jam terakhir riil berdasarkan created_at & status aktual
  const aggData = Array.from({ length: 24 }, (_, i) => {
    const hTime = new Date(now.getTime() - (23 - i) * 3600000);
    const hourLabel = `${hTime.getHours().toString().padStart(2, '0')}:00`;

    let onlineCount = 0;
    let offlineCount = 0;
    let maintenanceCount = 0;
    let nodataCount = 0;
    const devicesAtHour = [];

    mockDevices.forEach((d) => {
      let createdAt = new Date(0);
      if (d.created_at) {
        const raw = String(d.created_at).trim();
        createdAt = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
        if (isNaN(createdAt.getTime())) createdAt = new Date(raw);
      }

      // Jika jam berakhir sebelum perangkat dibuat: nodata
      if (hTime.getTime() + 3600000 < createdAt.getTime()) {
        nodataCount++;
        devicesAtHour.push({
          ...d,
          statusAtHour: 'nodata',
          latencyAtHour: null,
        });
      } else {
        const st = (d.status || 'offline').toLowerCase();
        if (st === 'online') {
          onlineCount++;
        } else if (st === 'maintenance') {
          maintenanceCount++;
        } else {
          offlineCount++;
        }
        devicesAtHour.push({
          ...d,
          statusAtHour: st,
          latencyAtHour: st === 'online' ? (d.responseTime || 1) : null,
        });
      }
    });

    return {
      hour: hourLabel,
      online: onlineCount,
      offline: offlineCount,
      maintenance: maintenanceCount,
      nodata: nodataCount,
      devices: devicesAtHour,
    };
  });

  renderAggregateTimeline('aggregate-timeline-chart', aggData, showHourDetailModal);

  if (!select) return;

  const renderChart = async (deviceId) => {
    if (!deviceId) {
      renderTimeline24h('timeline-chart', []);
      return;
    }
    try {
      const res = await apiGetDevice(deviceId).catch(() => null);
      if (res && res.data && res.data.timeline24h) {
        const mapped = res.data.timeline24h.map((t) => ({
          jam: t.hour,
          status: t.status,
          responseTime: t.latency !== null && t.latency !== undefined ? t.latency : (t.status === 'online' ? 5 : 0),
        }));
        renderTimeline24h('timeline-chart', mapped);
        return;
      }
    } catch { }

    const data = getTimeline24h(parseInt(deviceId));
    renderTimeline24h('timeline-chart', data);
  };

  select.onchange = (e) => renderChart(e.target.value);
  if (select.value) {
    renderChart(select.value);
  } else {
    renderTimeline24h('timeline-chart', []);
  }
}
