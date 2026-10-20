// ================================================================
// DevWatch — dashboard.js
// Dashboard utama: stats, card view, network map, grafik timeline
// ================================================================

import Swal from 'sweetalert2';
import { mockDevices, getStatusCounts, getGroups, updateDeviceStatus, syncDevicesFromApi } from '../data/mock-devices.js';
import { apiPingDevice, apiSetMaintenance, apiFinishMaintenance, apiGetDevice } from '../api.js';
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
          <button class="btn btn-secondary btn-sm" id="refresh-btn">🔄 Refresh</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card total">
          <div class="stat-icon total">📡</div>
          <div class="stat-info">
            <div class="stat-value" id="stat-total-val">${counts.total}</div>
            <div class="stat-label">Total Device</div>
            <div class="stat-sub">PC + CCTV</div>
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
                <button class="btn btn-secondary btn-sm" id="map-zoom-in" title="Perbesar Tampilan">🔍+</button>
                <button class="btn btn-secondary btn-sm" id="map-zoom-out" title="Perkecil Tampilan">🔍−</button>
                <button class="btn btn-secondary btn-sm" id="map-reset" title="Reset Posisi & Zoom">↺ Reset</button>
                <button class="btn btn-secondary btn-sm" id="map-auto-layout" title="Tata Ulang Hierarki Otomatis">📐 Auto-Layout</button>
                <div class="map-legend">
                  <div class="map-legend-item"><div class="map-legend-dot" style="background:#0284c7; border-radius:3px;"></div> Gateway & Switch</div>
                  <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-online);"></div> L2 (Satu Subnet)</div>
                  <div class="map-legend-item"><div class="map-legend-dot" style="background:#f97316; border-radius:3px;"></div> ⚡ L3 / Inter-VLAN</div>
                  <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-offline);"></div> Offline</div>
                </div>
              </div>
              <div style="position:relative; width:100%; overflow:hidden;">
                <canvas id="networkCanvas" width="960" height="560" style="width:100%; height:560px;"></canvas>
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
                      return `<option value="${d.id}">${icon} ${d.nama} (${d.ip}) — ${statusText}</option>`;
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
            <div class="device-card-ip">${d.ip}</div>
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

      if (currentTab === 'peta') initNetworkMap();
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
      return `<option value="${d.id}" ${isSelected ? 'selected' : ''}>${icon} ${d.nama} (${d.ip}) — ${statusText}</option>`;
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
      if (currentTab === 'peta') initNetworkMap();
      if (currentTab === 'timeline') initTimeline();
    })
    .catch((err) => {
      console.warn('Gagal memuat otomatis perangkat:', err);
    });

  // Refresh button
  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    Swal.fire({
      toast: true,
      icon: 'info',
      title: 'Menyinkronkan data dengan database...',
      position: 'top-end',
      showConfirmButton: false,
      timer: 800,
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
    await syncDevicesFromApi();
    updateDashboardStats();
    applyFilter();
    updateGroupFilterOptions();
    updateTimelineSelectOptions();
    if (currentTab === 'timeline') initTimeline();
  });

  // Sinkronkan stat awal saat event dipasang
  updateDashboardStats();

  // Countdown timers
  startCountdownTimers();

  // Init tab peta if active
  if (currentTab === 'peta') initNetworkMap();
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
  const parts = String(ip).trim().split('.');
  if (parts.length >= 3) {
    return parts.slice(0, 3).join('.');
  }
  return String(ip).trim();
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

function computeMapLayout(w, h, force = false) {
  const groups = getGroups();
  const effectiveGroups = groups.length > 0 ? groups : ['Umum'];

  // 1. Identifikasi router & switch riil di database
  const realRouters = mockDevices.filter((d) => (d.jenis || '').toLowerCase().includes('router'));
  const primaryRouter = realRouters[0] || null;

  const realSwitches = mockDevices.filter((d) => (d.jenis || '').toLowerCase().includes('switch'));
  const primarySwitch = realSwitches[0] || null;

  // Tingkat 1: Gateway Node (Router Riil atau Virtual Gateway) - Top Center
  const gwPos = (!force && customNodePositions['__gw__']) || { x: w / 2, y: 55 };
  const gwNode = {
    id: primaryRouter ? `__real_${primaryRouter.id}` : '__gw__',
    type: 'gateway',
    isReal: !!primaryRouter,
    realId: primaryRouter ? primaryRouter.id : null,
    nama: primaryRouter ? primaryRouter.nama : 'Gateway Router (Virtual)',
    ip: primaryRouter ? primaryRouter.ip : '192.168.1.1',
    status: primaryRouter ? primaryRouter.status : 'online',
    icon: '🌐',
    x: gwPos.x,
    y: gwPos.y,
    w: 156,
    h: 38,
  };
  if (primaryRouter) {
    primaryRouter.mapPos = { x: gwNode.x, y: gwNode.y };
  }

  // Tingkat 2: Core Distribution Node (Switch Riil atau Virtual Core) - Middle Center
  const corePos = (!force && customNodePositions['__core__']) || { x: w / 2, y: 140 };
  const fallbackCoreIp = primaryRouter ? `${getSubnetPrefix(primaryRouter.ip)}.2` : '192.168.1.2';
  const coreNode = {
    id: primarySwitch ? `__real_${primarySwitch.id}` : '__core__',
    type: 'core_switch',
    isReal: !!primarySwitch,
    realId: primarySwitch ? primarySwitch.id : null,
    nama: primarySwitch ? primarySwitch.nama : 'Core Switch L3',
    ip: primarySwitch ? primarySwitch.ip : fallbackCoreIp,
    status: primarySwitch ? primarySwitch.status : 'online',
    icon: '🔀',
    x: corePos.x,
    y: corePos.y,
    w: 146,
    h: 36,
  };
  if (primarySwitch) {
    primarySwitch.mapPos = { x: coreNode.x, y: coreNode.y };
  }

  // Tingkat 3: Group / Distribution Switches - Horizontal Spacing
  const remainingSwitches = realSwitches.filter((s) => s.id !== primarySwitch?.id);
  const groupNodes = effectiveGroups.map((grp, idx) => {
    const defaultX = (w / (effectiveGroups.length + 1)) * (idx + 1);
    const defaultY = 235;
    const pos = (!force && customNodePositions['__grp_' + grp]) || { x: defaultX, y: defaultY };
    const matchedRealSwitch = remainingSwitches.find((s) => (s.grup || 'Umum') === grp);
    const gNode = {
      id: matchedRealSwitch ? `__real_${matchedRealSwitch.id}` : '__grp_' + grp,
      type: 'group_switch',
      isReal: !!matchedRealSwitch,
      realId: matchedRealSwitch ? matchedRealSwitch.id : null,
      nama: matchedRealSwitch ? matchedRealSwitch.nama : `Switch ${grp}`,
      ip: matchedRealSwitch ? matchedRealSwitch.ip : `VLAN ${10 + (idx + 1) * 10}`,
      grup: grp,
      status: matchedRealSwitch ? matchedRealSwitch.status : 'online',
      icon: '🔀',
      x: pos.x,
      y: pos.y,
      w: 130,
      h: 34,
    };
    if (matchedRealSwitch) {
      matchedRealSwitch.mapPos = { x: gNode.x, y: gNode.y };
    }
    return gNode;
  });

  virtualNodes = [gwNode, coreNode, ...groupNodes];

  // Tingkat 4: Endpoint devices (Komputer, CCTV, Server, AP)
  // Kecualikan device yang menjadi node gateway, core switch, atau switch grup
  const backboneRealIds = new Set([gwNode.realId, coreNode.realId, ...groupNodes.map((g) => g.realId)].filter(Boolean));
  const endpointDevs = mockDevices.filter((d) => !backboneRealIds.has(d.id));

  // Kelompokkan endpoint berdasarkan uplink parent sebenarnya
  const hubBuckets = new Map();
  groupNodes.forEach((gn) => hubBuckets.set(gn.id, []));
  hubBuckets.set(coreNode.id, []);
  hubBuckets.set(gwNode.id, []);

  endpointDevs.forEach((d) => {
    let targetHub = null;
    if (d.parent_id) {
      targetHub = virtualNodes.find((v) => v.realId === d.parent_id);
    }
    if (!targetHub) {
      targetHub = groupNodes.find((g) => g.grup === (d.grup || 'Umum')) || coreNode;
    }
    if (!hubBuckets.has(targetHub.id)) {
      hubBuckets.set(targetHub.id, []);
    }
    hubBuckets.get(targetHub.id).push(d);
  });

  // Susun rapi bertingkat langsung di bawah parent masing-masing
  hubBuckets.forEach((devs, hubId) => {
    if (devs.length === 0) return;
    const hub = virtualNodes.find((v) => v.id === hubId) || coreNode;
    const cols = Math.min(devs.length, 3);
    const spacingX = Math.min(90, Math.max(75, (w / (effectiveGroups.length + 1)) / cols));
    const spacingY = 76;

    devs.forEach((d, j) => {
      if (!force && customNodePositions[d.id]) {
        d.mapPos = { ...customNodePositions[d.id] };
        return;
      }
      const col = j % cols;
      const row = Math.floor(j / cols);
      const startX = hub.x - ((cols - 1) * spacingX) / 2;
      const x = startX + col * spacingX;
      const y = hub.y + 76 + row * spacingY;
      d.mapPos = { x, y };
      customNodePositions[d.id] = { x, y };
    });
  });
}

function findNodeAt(vx, vy) {
  // Check devices first
  for (let i = mockDevices.length - 1; i >= 0; i--) {
    const d = mockDevices[i];
    if (!d.mapPos) continue;
    const dist = Math.hypot(d.mapPos.x - vx, d.mapPos.y - vy);
    if (dist <= 20) {
      return { type: 'device', data: d };
    }
  }

  // Check virtual / infrastructure nodes
  for (let i = virtualNodes.length - 1; i >= 0; i--) {
    const v = virtualNodes[i];
    if (Math.abs(v.x - vx) <= v.w / 2 && Math.abs(v.y - vy) <= v.h / 2) {
      if (v.isReal && v.realId) {
        const realDev = mockDevices.find((d) => d.id === v.realId);
        if (realDev) return { type: 'device', data: realDev, isVirtualBackbone: true };
      }
      return { type: 'virtual', data: v };
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

function initNetworkMap() {
  const canvas = document.getElementById('networkCanvas');
  const tooltip = document.getElementById('map-tooltip');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvasCtx = ctx;

  canvas.width = canvas.offsetWidth || 960;
  canvas.height = 560;

  computeMapLayout(canvas.width, canvas.height, false);

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

  // Mouse interaction
  canvas.addEventListener('mousedown', (e) => {
    const vx = (e.offsetX - mapTransform.x) / mapTransform.scale;
    const vy = (e.offsetY - mapTransform.y) / mapTransform.scale;
    const hit = findNodeAt(vx, vy);

    dragStartMouse = { x: e.offsetX, y: e.offsetY };
    isNodeMoved = false;

    if (hit) {
      draggedNode = hit;
    } else {
      isDragging = true;
    }
    lastMouse = { x: e.offsetX, y: e.offsetY };
  });

  canvas.addEventListener('mousemove', (e) => {
    const vx = (e.offsetX - mapTransform.x) / mapTransform.scale;
    const vy = (e.offsetY - mapTransform.y) / mapTransform.scale;

    if (draggedNode) {
      const dx = (e.offsetX - lastMouse.x) / mapTransform.scale;
      const dy = (e.offsetY - lastMouse.y) / mapTransform.scale;
      if (Math.hypot(e.offsetX - dragStartMouse.x, e.offsetY - dragStartMouse.y) > 4) {
        isNodeMoved = true;
      }
      if (draggedNode.type === 'device') {
        draggedNode.data.mapPos.x += dx;
        draggedNode.data.mapPos.y += dy;
        customNodePositions[draggedNode.data.id] = { ...draggedNode.data.mapPos };
      } else {
        draggedNode.data.x += dx;
        draggedNode.data.y += dy;
        customNodePositions[draggedNode.data.id] = { x: draggedNode.data.x, y: draggedNode.data.y };
      }
      lastMouse = { x: e.offsetX, y: e.offsetY };
      if (tooltip) tooltip.style.display = 'none';
      return;
    }

    if (isDragging) {
      mapTransform.x += e.offsetX - lastMouse.x;
      mapTransform.y += e.offsetY - lastMouse.y;
      lastMouse = { x: e.offsetX, y: e.offsetY };
      if (tooltip) tooltip.style.display = 'none';
      return;
    }

    // Hover tooltip
    const hit = findNodeAt(vx, vy);
    if (hit && tooltip) {
      canvas.style.cursor = 'pointer';
      if (hit.type === 'device') {
        const d = hit.data;
        const color = d.status === 'online' ? '#22c55e' : (d.status === 'offline' ? '#ef4444' : '#eab308');
        const devSub = getSubnetPrefix(d.ip);
        const parentDev = d.parent_id ? mockDevices.find((p) => p.id === d.parent_id) : null;
        const parentSub = parentDev ? getSubnetPrefix(parentDev.ip) : null;
        const isDiffSub = parentDev && parentSub && devSub !== parentSub;

        tooltip.innerHTML = `
          <div style="font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
            <span>${getNodeIcon(d.jenis)}</span>
            <span>${d.nama}</span>
          </div>
          <div style="font-family:monospace; color:#94a3b8; font-size:0.75rem; margin:2px 0;">${d.ip} <span style="color:#64748b;">(${devSub}.x)</span></div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
            <span style="color:${color}; font-weight:700;">● ${d.status.toUpperCase()}</span>
            ${d.responseTime !== null && d.responseTime !== undefined ? `<span style="color:#22c55e;">${d.responseTime}ms</span>` : ''}
          </div>
          ${isDiffSub ? `
          <div style="margin-top:4px; font-size:0.72rem; color:#fdba74; background:rgba(249,115,22,0.18); border:1px solid rgba(249,115,22,0.35); border-radius:4px; padding:2px 6px;">
            ⚡ Rute Inter-VLAN / L3 (${devSub}.x ➔ ${parentSub}.x)
          </div>
          ` : `
          <div style="margin-top:4px; font-size:0.72rem; color:#86efac;">🟢 Subnet: ${devSub}.x (L2 Switch)</div>
          `}
          <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">Klik untuk tindakan</div>
        `;
      } else {
        const v = hit.data;
        const realDev = v.realId ? mockDevices.find((d) => d.id === v.realId) : null;
        const isOnline = realDev ? realDev.status === 'online' : v.status === 'online';
        const rawLatency = realDev ? (realDev.responseTime ?? realDev.response_time_ms) : null;
        const latencyVal = (rawLatency !== null && rawLatency !== undefined && rawLatency > 0) ? rawLatency : (isOnline ? (v.type === 'gateway' ? 1 : 2) : null);
        const st = realDev ? realDev.status : v.status;
        const color = st === 'online' ? '#22c55e' : (st === 'offline' ? '#ef4444' : '#eab308');

        tooltip.innerHTML = `
          <div style="font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
            <span>${v.icon}</span>
            <span>${v.nama}</span>
          </div>
          <div style="font-family:monospace; color:#94a3b8; font-size:0.75rem; margin:2px 0;">${v.ip}</div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
            <span style="color:${color}; font-weight:700;">● ${(st || 'ONLINE').toUpperCase()}</span>
            ${latencyVal !== null ? `<span style="color:#22c55e; font-weight:700;">⚡ ${latencyVal} ms</span>` : ''}
          </div>
          <div style="font-size:0.7rem; color:#38bdf8; margin-top:4px;">Infrastruktur Utama Jaringan</div>
        `;
      }
      tooltip.style.left = `${Math.min(canvas.offsetWidth - 220, e.offsetX + 15)}px`;
      tooltip.style.top = `${Math.min(canvas.offsetHeight - 100, e.offsetY + 15)}px`;
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
      } else if (draggedNode.data?.realId) {
        const realDev = mockDevices.find((d) => d.id === draggedNode.data.realId);
        if (realDev) showDeviceMapModal(realDev);
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

  // Wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    mapTransform.scale = Math.max(0.5, Math.min(2.5, mapTransform.scale + delta));
  }, { passive: false });

  // Toolbar
  document.getElementById('map-zoom-in')?.addEventListener('click', () => {
    mapTransform.scale = Math.min(2.5, mapTransform.scale + 0.2);
  });
  document.getElementById('map-zoom-out')?.addEventListener('click', () => {
    mapTransform.scale = Math.max(0.5, mapTransform.scale - 0.2);
  });
  document.getElementById('map-reset')?.addEventListener('click', () => {
    mapTransform = { x: 0, y: 0, scale: 1 };
  });
  document.getElementById('map-auto-layout')?.addEventListener('click', () => {
    customNodePositions = {};
    computeMapLayout(canvas.width, canvas.height, true);
    mapTransform = { x: 0, y: 0, scale: 1 };
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
}

function drawMap(ctx, w, h) {
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(mapTransform.x, mapTransform.y);
  ctx.scale(mapTransform.scale, mapTransform.scale);

  // Background grid dots
  ctx.fillStyle = isLight ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.04)';
  const step = 28;
  const boundX = (w * 1.5) / mapTransform.scale;
  const boundY = (h * 1.5) / mapTransform.scale;
  for (let x = -boundX; x < boundX; x += step) {
    for (let y = -boundY; y < boundY; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
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

  const gw = virtualNodes.find((v) => v.type === 'gateway');
  const core = virtualNodes.find((v) => v.type === 'core_switch');
  const groupHubs = virtualNodes.filter((v) => v.type === 'group_switch');

  const now = Date.now();

  // 1. Connection: Gateway -> Core Switch
  if (gw && core) {
    ctx.beginPath();
    ctx.moveTo(gw.x, gw.y + gw.h / 2);
    ctx.lineTo(core.x, core.y - core.h / 2);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pulse bead
    const tGw = (now / 1500) % 1;
    const pxGw = gw.x;
    const pyGw = (gw.y + gw.h / 2) + (core.y - core.h / 2 - (gw.y + gw.h / 2)) * tGw;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(pxGw, pyGw, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Connection: Core Switch -> Group Switches
  if (core) {
    groupHubs.forEach((grp, idx) => {
      ctx.beginPath();
      ctx.moveTo(core.x, core.y + core.h / 2);
      ctx.lineTo(grp.x, grp.y - grp.h / 2);
      ctx.strokeStyle = 'rgba(99,102,241,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Traveling packet
      const tGrp = ((now / 2000) + idx * 0.25) % 1;
      const px = core.x + (grp.x - core.x) * tGrp;
      const py = (core.y + core.h / 2) + (grp.y - grp.h / 2 - (core.y + core.h / 2)) * tGrp;
      ctx.fillStyle = '#a5b4fc';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 3. Connection: Uplink Hub -> Devices (Subnet-Aware)
  const backboneRealIds = new Set([gw?.realId, core?.realId].filter(Boolean));
  const endpointDevs = mockDevices.filter((d) => !backboneRealIds.has(d.id));

  endpointDevs.forEach((d) => {
    if (!d.mapPos) return;

    // Tentukan simpul uplink (parent eksplisit atau grup switch / core)
    let uplink = null;
    if (d.parent_id) {
      uplink = mockDevices.find((p) => p.id === d.parent_id) || virtualNodes.find((v) => v.realId === d.parent_id);
    }
    if (!uplink) {
      uplink = groupHubs.find((g) => g.grup === (d.grup || 'Umum')) || core || gw;
    }
    if (!uplink) return;

    const ux = uplink.mapPos ? uplink.mapPos.x : uplink.x;
    const uy = uplink.mapPos ? uplink.mapPos.y + (uplink.h ? uplink.h / 2 : 14) : uplink.y + (uplink.h ? uplink.h / 2 : 14);

    const devSubnet = getSubnetPrefix(d.ip);
    const uplinkSubnet = getSubnetPrefix(uplink.ip);
    const isL3 = devSubnet && uplinkSubnet && devSubnet !== uplinkSubnet;

    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.lineTo(d.mapPos.x, d.mapPos.y);

    if (isL3) {
      // Jalur Inter-VLAN / L3 Route (Beda Subnet)
      if (d.status === 'online') {
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.75)';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Flowing orange pulse packet
        const tDev = ((now / 2000) + (d.id * 0.19)) % 1;
        const px = ux + (d.mapPos.x - ux) * tDev;
        const py = uy + (d.mapPos.y - uy) * tDev;
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      // Jalur Layer 2 Lokal (Satu Subnet)
      if (d.status === 'online') {
        ctx.strokeStyle = 'rgba(34,197,94,0.45)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([]);
        ctx.stroke();

        // Flowing packet bead
        const tDev = ((now / 2200) + (d.id * 0.17)) % 1;
        const px = ux + (d.mapPos.x - ux) * tDev;
        const py = uy + (d.mapPos.y - uy) * tDev;
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(px, py, 2.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.status === 'offline') {
        ctx.strokeStyle = 'rgba(239,68,68,0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = 'rgba(234,179,8,0.45)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  });

  // 4. Draw Virtual / Backbone Nodes
  virtualNodes.forEach((node) => {
    const rx = node.x - node.w / 2;
    const ry = node.y - node.h / 2;

    ctx.save();
    let grad;
    if (node.type === 'gateway') {
      ctx.shadowColor = 'rgba(2,132,199,0.5)';
      ctx.shadowBlur = 12;
      grad = ctx.createLinearGradient(rx, ry, rx + node.w, ry + node.h);
      grad.addColorStop(0, '#0369a1');
      grad.addColorStop(1, '#0c4a6e');
    } else if (node.type === 'core_switch') {
      ctx.shadowColor = 'rgba(99,102,241,0.5)';
      ctx.shadowBlur = 12;
      grad = ctx.createLinearGradient(rx, ry, rx + node.w, ry + node.h);
      grad.addColorStop(0, '#4f46e5');
      grad.addColorStop(1, '#312e81');
    } else {
      ctx.shadowColor = 'rgba(139,92,246,0.4)';
      ctx.shadowBlur = 10;
      grad = ctx.createLinearGradient(rx, ry, rx + node.w, ry + node.h);
      grad.addColorStop(0, '#6d28d9');
      grad.addColorStop(1, '#431407');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(rx, ry, node.w, node.h, 8);
    ctx.fill();

    ctx.strokeStyle = node.isReal ? '#38bdf8' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = node.isReal ? 1.8 : 1;
    ctx.stroke();
    ctx.restore();

    // Node text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelTitle = node.nama;
    ctx.fillText(`${node.icon} ${labelTitle}`, node.x, node.y - 1);

    // Ambil info perangkat riil jika ada
    const realDev = node.realId ? mockDevices.find((d) => d.id === node.realId) : null;
    const isOnline = realDev ? realDev.status === 'online' : node.status === 'online';
    const rawLatency = realDev ? (realDev.responseTime ?? realDev.response_time_ms) : null;
    const latencyVal = (rawLatency !== null && rawLatency !== undefined && rawLatency > 0) ? rawLatency : (isOnline ? (node.type === 'gateway' ? 1 : 2) : null);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText(node.ip, node.x, node.y + 12);

    // Latency badge pada router & switch (Backbone / Infrastructure)
    if (isOnline && latencyVal !== null) {
      ctx.save();
      const badgeText = `⚡ ${latencyVal} ms`;
      ctx.font = 'bold 8px Inter, sans-serif';
      const textW = ctx.measureText(badgeText).width;
      const bw = textW + 8;
      const bh = 14;
      const bx = rx + node.w - bw - 4;
      const by = ry + 4;

      ctx.fillStyle = 'rgba(22, 101, 52, 0.9)';
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#86efac';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, bx + bw / 2, by + 10);
      ctx.restore();
    }
  });

  // 5. Draw Endpoint Device Nodes
  endpointDevs.forEach((d) => {
    if (!d.mapPos) return;
    const color = d.status === 'online' ? '#22c55e' : (d.status === 'offline' ? '#ef4444' : '#eab308');

    // Tentukan apakah node ini dalam rute L3
    const devSubnet = getSubnetPrefix(d.ip);
    let uplinkDev = d.parent_id ? mockDevices.find((p) => p.id === d.parent_id) : (gw?.realId ? mockDevices.find((p) => p.id === gw.realId) : null);
    const uplinkSubnet = uplinkDev ? getSubnetPrefix(uplinkDev.ip) : (gw ? getSubnetPrefix(gw.ip) : null);
    const isL3 = devSubnet && uplinkSubnet && devSubnet !== uplinkSubnet;

    // Pulsing aura on online devices
    if (d.status === 'online') {
      const pulsePhase = ((now / 1500) + d.id * 0.2) % 1;
      ctx.beginPath();
      ctx.arc(d.mapPos.x, d.mapPos.y, 14 + pulsePhase * 10, 0, Math.PI * 2);
      ctx.strokeStyle = isL3 ? `rgba(249,115,22,${0.6 * (1 - pulsePhase)})` : `rgba(34,197,94,${0.5 * (1 - pulsePhase)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Node body
    ctx.save();
    ctx.shadowColor = d.status === 'online' ? (isL3 ? 'rgba(249,115,22,0.6)' : 'rgba(34,197,94,0.5)') : (d.status === 'offline' ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.4)');
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(d.mapPos.x, d.mapPos.y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isL3 ? '#f97316' : '#ffffff';
    ctx.lineWidth = isL3 ? 2 : 1.5;
    ctx.stroke();
    ctx.restore();

    // Icon
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(getNodeIcon(d.jenis), d.mapPos.x, d.mapPos.y + 4);

    // L3 Badge if different subnet
    if (isL3) {
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 8.5px Inter, sans-serif';
      ctx.fillText('⚡ L3', d.mapPos.x, d.mapPos.y - 18);
    }

    // Name label
    ctx.fillStyle = isLight ? '#0f172a' : '#f1f5f9';
    ctx.font = '600 9.5px Inter, sans-serif';
    ctx.textAlign = 'center';
    const shortName = d.nama.length > 13 ? d.nama.substring(0, 13) + '…' : d.nama;
    ctx.fillText(shortName, d.mapPos.x, d.mapPos.y + 26);

    // IP label
    ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
    ctx.font = '8.5px monospace';
    ctx.fillText(d.ip, d.mapPos.x, d.mapPos.y + 36);

    // Latency badge if online (Router/Switch get dedicated prominent badge, others get standard tag)
    const isRouterOrSwitch = ['router', 'switch', 'gateway', 'hub'].some((k) => String(d.jenis || '').toLowerCase().includes(k));
    if (d.status === 'online') {
      const msVal = (d.responseTime !== null && d.responseTime !== undefined && d.responseTime > 0) ? d.responseTime : 1;
      if (isRouterOrSwitch) {
        ctx.save();
        const badgeText = `⚡ ${msVal} ms`;
        ctx.font = 'bold 8px Inter, sans-serif';
        const textW = ctx.measureText(badgeText).width;
        const bw = textW + 8;
        const bh = 14;
        const bx = d.mapPos.x - bw / 2;
        const by = d.mapPos.y + 46;

        ctx.fillStyle = 'rgba(22, 101, 52, 0.9)';
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#86efac';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, d.mapPos.x, by + 10);
        ctx.restore();
      } else {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.fillText(`${msVal}ms`, d.mapPos.x, isL3 ? d.mapPos.y - 28 : d.mapPos.y - 18);
      }
    }
  });

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
    } catch {}

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
