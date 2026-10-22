// ================================================================
// DevWatch — dashboard.js
// Dashboard utama: stats, card view, network map, grafik timeline
// ================================================================

import Swal from 'sweetalert2';
import { mockDevices, getStatusCounts, getGroups, updateDeviceStatus, syncDevicesFromApi, cleanDeviceIp } from '../data/mock-devices.js';
import { apiPingDevice, apiSetMaintenance, apiFinishMaintenance, apiGetDevice, apiPingAllDevices } from '../api.js';
import { renderTimeline24h, renderAggregateTimeline, destroyAllCharts } from '../components/charts.js';
import { getTimeline24h } from '../data/mock-reports.js';
import { getSession } from '../main.js';

let currentFilter = { kategori: 'all', status: 'all', grup: 'all', search: '' };
let currentTab = 'kartu';
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
          <div class="live-indicator">
            <span class="live-dot"></span>
            <span style="font-size:0.8rem; font-weight:600; color:var(--color-online);">LIVE</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="ping-all-btn" title="Ping serentak seluruh perangkat">📡 Ping All</button>
          <button class="btn btn-secondary btn-sm" id="refresh-btn" title="Muat ulang & verifikasi koneksi seluruh perangkat">🔄 Refresh</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card total">
          <div class="stat-icon total">📡</div>
          <div class="stat-info">
            <div class="stat-value" id="stat-total-val">${counts.total}</div>
            <div class="stat-label">Total Device</div>
          </div>
        </div>
        <div class="stat-card online-stat">
          <div class="stat-icon online-stat">🟢</div>
          <div class="stat-info">
            <div class="stat-value text-online" id="stat-online-val">${counts.online}</div>
            <div class="stat-label">Online</div>
            <div class="stat-sub" id="stat-uptime-sub">${uptimePct}% dari total</div>
          </div>
        </div>
        <div class="stat-card offline-stat">
          <div class="stat-icon offline-stat">🔴</div>
          <div class="stat-info">
            <div class="stat-value text-offline" id="stat-offline-val">${counts.offline}</div>
            <div class="stat-label">Offline</div>
            <div class="stat-sub">Perlu perhatian</div>
          </div>
        </div>
        <div class="stat-card maintenance-stat">
          <div class="stat-icon maintenance-stat">🟡</div>
          <div class="stat-info">
            <div class="stat-value text-maintenance" id="stat-maint-val">${counts.maintenance}</div>
            <div class="stat-label">Maintenance</div>
            <div class="stat-sub">Mode terjadwal</div>
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

  const devices = filtered || getFilteredDevices();
  if (devices.length === 0) {
    return `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Tidak ada device ditemukan</div>
        <div class="empty-desc">Coba ubah filter atau kata kunci pencarian</div>
      </div>
    `;
  }

  const session = getSession();
  const canEdit = session?.role === 'admin' || session?.role === 'teknisi';

  return devices.map((d) => {
    const statusColor = {
      online: 'var(--color-online)',
      offline: 'var(--color-offline)',
      maintenance: 'var(--color-maintenance)',
    }[d.status];

    const statusLabel = { online: '🟢 Online', offline: '🔴 Offline', maintenance: '🟡 Maintenance' }[d.status];
    const icon = getNodeIcon(d.jenis);

    const lastChecked = d.lastChecked
      ? formatTimeAgo(d.lastChecked)
      : 'Belum dicek';

    const lastOnline = d.lastOnline
      ? formatTimeAgo(d.lastOnline)
      : 'Tidak diketahui';

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
            <span>${lastChecked}</span>
          </div>
          <div class="device-card-meta-row">
            <span class="device-card-meta-label">🟢 Last Online:</span>
            <span>${d.status === 'online' ? 'Sekarang' : lastOnline}</span>
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
  }).join('');
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

export function initDashboardEvents(navigate) {
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

  // Jika d adalah switch, sambungkan ke router utama jika tersedia
  if (String(d.jenis || '').toLowerCase().includes('switch')) {
    const devSub = getSubnetPrefix(d.ip);
    const sameSubRouter = mockDevices.find((p) =>
      p.id !== d.id &&
      String(p.jenis || '').toLowerCase().includes('router') &&
      getSubnetPrefix(p.ip) === devSub &&
      !wouldCauseCycle(d.id, p.id)
    );
    if (sameSubRouter) return sameSubRouter;

    const mainRouter = mockDevices.find((p) =>
      p.id !== d.id &&
      String(p.jenis || '').toLowerCase().includes('router') &&
      !wouldCauseCycle(d.id, p.id)
    );
    if (mainRouter) return mainRouter;
  }

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
  const SLOT_WIDTH = 140;
  const HORIZONTAL_GAP = 36;
  const LEVEL_GAP = 135;
  // Jika ada WAN Cloud di atas router, beri ruang vertikal di tingkat atas
  const TOP_MARGIN = hasWanCloud ? 140 : 80;

  // Hitung lebar setiap subtree secara rekursif
  function measureSubtree(node) {
    const children = childrenMap.get(node.id) || [];
    if (children.length === 0) {
      node._subtreeWidth = SLOT_WIDTH;
      return SLOT_WIDTH;
    }
    let total = 0;
    children.forEach((c, idx) => {
      total += measureSubtree(c);
      if (idx < children.length - 1) total += HORIZONTAL_GAP;
    });
    node._subtreeWidth = Math.max(SLOT_WIDTH, total);
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
    const children = childrenMap.get(node.id) || [];
    const width = node._subtreeWidth;
    const x = startX + width / 2;
    const y = TOP_MARGIN + depth * LEVEL_GAP;

    if (force || !customNodePositions[node.id]) {
      node.mapPos = { x, y };
    } else {
      node.mapPos = { ...customNodePositions[node.id] };
    }

    let childStartX = startX;
    children.forEach((ch) => {
      positionSubtree(ch, childStartX, depth + 1);
      childStartX += ch._subtreeWidth + HORIZONTAL_GAP;
    });
  }

  roots.forEach((r) => {
    positionSubtree(r, currentRootX, 0);
    currentRootX += r._subtreeWidth + HORIZONTAL_GAP * 2.5;
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
    minX = Math.min(minX, d.mapPos.x - 70);
    maxX = Math.max(maxX, d.mapPos.x + 70);
    minY = Math.min(minY, d.mapPos.y - 45);
    maxY = Math.max(maxY, d.mapPos.y + 65);
  });
  if (wanNode) {
    minX = Math.min(minX, wanNode.x - wanNode.w / 2 - 20);
    maxX = Math.max(maxX, wanNode.x + wanNode.w / 2 + 20);
    minY = Math.min(minY, wanNode.y - 25);
  }
  if (minX === Infinity) {
    mapTransform = { x: 0, y: 0, scale: 1 };
    return;
  }
  const treeW = maxX - minX;
  const treeH = maxY - minY;
  const padding = 60;
  const scaleX = (w - padding * 2) / Math.max(100, treeW);
  const scaleY = (h - padding * 2) / Math.max(100, treeH);
  // Auto scale sesuai kebutuhan 100+ devices, min 0.22, max 1.05
  const targetScale = Math.max(0.22, Math.min(1.05, Math.min(scaleX, scaleY)));

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
    const hitRadius = isInfra ? 26 : 20;
    const dist = Math.hypot(d.mapPos.x - vx, d.mapPos.y - vy);
    if (dist <= hitRadius) {
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
      </div>
      <div style="display:flex; gap:8px; margin-top:16px;">
        <button id="modal-ping-btn" class="btn btn-secondary btn-sm" style="flex:1;">📡 Probe</button>
        <button id="modal-maint-btn" class="btn btn-warning btn-sm" style="flex:1;">🔧 Maintenance</button>
        <button id="modal-detail-btn" class="btn btn-primary btn-sm" style="flex:1;">🔍 Detail</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
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
  const routers = w.routers || [];
  const routerListHtml = routers.map((r) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:rgba(255,255,255,0.04); border-radius:6px; margin-top:4px; border:1px solid rgba(255,255,255,0.06);">
      <span style="font-weight:600; color:#f1f5f9;">${getNodeIcon(r.jenis)} ${r.nama}</span>
      <span style="font-family:monospace; color:#38bdf8;">${cleanDeviceIp(r.ip)}</span>
    </div>
  `).join('');

  Swal.fire({
    title: '☁️ Internet / WAN Cloud Backbone',
    html: `
      <div style="text-align:left; font-size:0.86rem; display:flex; flex-direction:column; gap:10px; padding:6px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
          <span style="color:#94a3b8;">Arsitektur Uplink</span>
          <span style="color:#38bdf8; font-weight:700;">${routers.length > 1 ? `Multi-Gateway Redundan (${routers.length} Router)` : 'Single Gateway Uplink'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:#94a3b8;">Status Konektivitas Luar</span>
          <span style="color:${w.status === 'online' ? '#22c55e' : '#ef4444'}; font-weight:700;">● ${w.status.toUpperCase()}</span>
        </div>
        <div style="margin-top:6px;">
          <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px; font-weight:600;">Router Gateway Aktif:</div>
          ${routerListHtml}
        </div>
        ${routers.length > 1 ? `
        <div style="margin-top:6px; padding:8px 10px; border-radius:6px; background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.4); color:#e9d5ff; font-size:0.78rem;">
          ⚡ <strong>Inter-Router HA Trunk Redundansi</strong>: Jalur sinkronisasi failover / HA antar router gateway aktif di peta visual.
        </div>
        ` : ''}
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    background: '#1a1d2e',
    color: '#e2e8f0',
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
  document.getElementById('map-fit-screen')?.addEventListener('click', () => {
    updateCanvasDimensions(false);
    fitToScreen(canvas.width, canvas.height);
  });
  document.getElementById('map-reset')?.addEventListener('click', () => {
    mapTransform = { x: 0, y: 0, scale: 1 };
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
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
  });

  // Fullscreen toggle
  document.getElementById('map-fullscreen')?.addEventListener('click', () => {
    const wrapper = document.querySelector('.network-map-wrapper');
    if (!wrapper) return;
    wrapper.classList.toggle('fullscreen');
    const isFs = wrapper.classList.contains('fullscreen');
    const btn = document.getElementById('map-fullscreen');
    if (btn) btn.innerHTML = isFs ? '✕ Keluar Layar Penuh' : '⛶ Layar Penuh';
    setTimeout(() => {
      updateCanvasDimensions(false);
    }, 120);
  });

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

  // 0a. WAN Uplink Links (Internet / Cloud -> Router Gateways)
  if (wanNode && wanNode.routers && wanNode.routers.length > 0) {
    wanNode.routers.forEach((r) => {
      if (!r.mapPos) return;
      const wx = wanNode.x;
      const wy = wanNode.y + wanNode.h / 2;
      const rx = r.mapPos.x;
      const ry = r.mapPos.y - 18;
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

      const fx = from.mapPos.x + 18;
      const fy = from.mapPos.y;
      const tx = to.mapPos.x - 18;
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
      if (currentScale >= 0.5) {
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

    const px = parent.mapPos.x;
    const py = parent.mapPos.y + 14;
    const cx = d.mapPos.x;
    const cy = d.mapPos.y - 14;
    const midY = (py + cy) / 2;

    const devSub = getSubnetPrefix(d.ip);
    const parentSub = getSubnetPrefix(parent.ip);
    const isL3 = devSub && parentSub && devSub !== parentSub;

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
  });

  // 2. Draw Devices with Level of Detail (LOD) Multi-Skala
  mockDevices.forEach((d) => {
    if (!d.mapPos) return;
    const isInfra = ['switch', 'router', 'gateway', 'server'].some((k) => String(d.jenis || '').toLowerCase().includes(k));
    const color = d.status === 'online' ? '#22c55e' : (d.status === 'offline' ? '#ef4444' : '#eab308');

    const isSearchMatch = isSearchActive && (
      (d.nama || '').toLowerCase().includes(mapSearchQuery) ||
      (d.ip || '').toLowerCase().includes(mapSearchQuery)
    );

    // Search focus ring
    if (isSearchMatch) {
      const ringPulse = ((now / 800) % 1);
      ctx.save();
      ctx.beginPath();
      ctx.arc(d.mapPos.x, d.mapPos.y, 22 + ringPulse * 16, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.85 * (1 - ringPulse)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    if (currentScale < 0.42) {
      // === LOD 3: MACRO RINGKAS (100+ Perangkat Tanpa Teks Overlap) ===
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = d.status === 'online' ? 8 : 4;
      ctx.beginPath();
      ctx.arc(d.mapPos.x, d.mapPos.y, isInfra ? 11 : 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
      return;
    }

    // === LOD 2 & 1: Body Node ===
    const radius = isInfra ? 17 : 14;

    // Pulsing aura pada perangkat online
    if (d.status === 'online') {
      const pulsePhase = ((now / 1500) + d.id * 0.2) % 1;
      ctx.beginPath();
      ctx.arc(d.mapPos.x, d.mapPos.y, radius + pulsePhase * 9, 0, Math.PI * 2);
      ctx.strokeStyle = isInfra ? `rgba(2, 132, 199, ${0.5 * (1 - pulsePhase)})` : `rgba(34, 197, 94, ${0.45 * (1 - pulsePhase)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Node Body
    ctx.save();
    ctx.shadowColor = d.status === 'online' ? (isInfra ? 'rgba(2,132,199,0.5)' : 'rgba(34,197,94,0.45)') : (d.status === 'offline' ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.4)');
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(d.mapPos.x, d.mapPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isInfra ? '#38bdf8' : '#ffffff';
    ctx.lineWidth = isInfra ? 2 : 1.4;
    ctx.stroke();
    ctx.restore();

    // Node Icon
    ctx.fillStyle = '#ffffff';
    ctx.font = isInfra ? '13px sans-serif' : '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(getNodeIcon(d.jenis), d.mapPos.x, d.mapPos.y + 4);

    // === LABEL TEXT (Disesuaikan LOD Skala) ===
    if (currentScale >= 0.42 && currentScale < 0.75) {
      // LOD 2: Tampilkan Icon + Nama Singkat (Sembunyikan IP)
      ctx.fillStyle = isLight ? '#0f172a' : '#f1f5f9';
      ctx.font = '600 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      const shortName = d.nama.length > 10 ? d.nama.substring(0, 9) + '…' : d.nama;
      ctx.fillText(shortName, d.mapPos.x, d.mapPos.y + 24);
    } else {
      // LOD 1: Tampilkan Penuh (Nama + IP + Latency Badge)
      ctx.fillStyle = isLight ? '#0f172a' : '#f1f5f9';
      ctx.font = '600 9.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      const shortName = d.nama.length > 14 ? d.nama.substring(0, 13) + '…' : d.nama;
      ctx.fillText(shortName, d.mapPos.x, d.mapPos.y + 25);

      ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
      ctx.font = '8.5px monospace';
      ctx.fillText(cleanDeviceIp(d.ip), d.mapPos.x, d.mapPos.y + 36);

      if (d.status === 'online') {
        const msVal = (d.responseTime !== null && d.responseTime !== undefined && d.responseTime > 0) ? d.responseTime : 1;
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.fillText(`${msVal}ms`, d.mapPos.x, d.mapPos.y - 18);
      }
    }
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
      badgeHtml = '<span class="chip" style="background:rgba(148,163,184,0.15); color:var(--color-muted);">⚪ Belum Ada</span>';
      latencyText = '-';
    }

    return `
      <tr style="border-bottom:1px solid var(--border-color);">
        <td style="padding:8px 10px; font-weight:600; color:var(--color-text); text-align:left;">
          ${getNodeIcon(d.jenis)} ${d.nama}
        </td>
        <td style="padding:8px 10px; font-family:var(--font-mono); font-size:0.8rem; color:var(--color-muted);">${d.ip}</td>
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
        ${nodata > 0 ? `<span class="chip" style="background:rgba(148,163,184,0.15); color:var(--color-muted);">⚪ Belum Didaftarkan: <b>${nodata}</b></span>` : ''}
      </div>
      <div style="max-height:360px; overflow-y:auto; border:1px solid var(--border-color); border-radius:8px; margin-top:10px;">
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; text-align:left;">
          <thead style="background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border-color); color:var(--color-muted); position:sticky; top:0; z-index:1;">
            <tr>
              <th style="padding:8px 10px;">Perangkat</th>
              <th style="padding:8px 10px;">IP Address</th>
              <th style="padding:8px 10px;">Grup</th>
              <th style="padding:8px 10px;">Status</th>
              <th style="padding:8px 10px;">Latency</th>
            </tr>
          </thead>
          <tbody>
            ${devices.length > 0 ? deviceRows : '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--color-muted);">Tidak ada perangkat terdaftar pada jam ini</td></tr>'}
          </tbody>
        </table>
      </div>
    `,
    width: 660,
    showCloseButton: true,
    showConfirmButton: false,
    background: 'var(--color-surface, #1a1d2e)',
    color: 'var(--color-text, #e2e8f0)',
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
        return `<option value="${d.id}" ${isSelected ? 'selected' : ''}>${icon} ${d.nama} (${d.ip}) — ${statusText}</option>`;
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

// Format relative time
function formatTimeAgo(isoString) {
  const diff = new Date() - new Date(isoString);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}
