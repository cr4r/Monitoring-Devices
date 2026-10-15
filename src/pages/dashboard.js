// ================================================================
// DevWatch — dashboard.js
// Dashboard utama: stats, card view, network map, grafik timeline
// ================================================================

import Swal from 'sweetalert2';
import { mockDevices, getStatusCounts, getGroups, updateDeviceStatus, syncDevicesFromApi } from '../data/mock-devices.js';
import { apiPingDevice, apiSetMaintenance, apiFinishMaintenance } from '../api.js';
import { renderTimeline24h, destroyAllCharts } from '../components/charts.js';
import { getTimeline24h } from '../data/mock-reports.js';
import { getSession } from '../main.js';

let currentFilter = { kategori: 'all', status: 'all', grup: 'all', search: '' };
let currentTab = 'kartu';
let canvasCtx = null;
let mapTransform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let lastMouse = { x: 0, y: 0 };

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
            <div class="stat-value">${counts.total}</div>
            <div class="stat-label">Total Device</div>
            <div class="stat-sub">PC + CCTV</div>
          </div>
        </div>
        <div class="stat-card online-stat">
          <div class="stat-icon online-stat">🟢</div>
          <div class="stat-info">
            <div class="stat-value text-online">${counts.online}</div>
            <div class="stat-label">Online</div>
            <div class="stat-sub">${uptimePct}% dari total</div>
          </div>
        </div>
        <div class="stat-card offline-stat">
          <div class="stat-icon offline-stat">🔴</div>
          <div class="stat-info">
            <div class="stat-value text-offline">${counts.offline}</div>
            <div class="stat-label">Offline</div>
            <div class="stat-sub">Perlu perhatian</div>
          </div>
        </div>
        <div class="stat-card maintenance-stat">
          <div class="stat-icon maintenance-stat">🟡</div>
          <div class="stat-info">
            <div class="stat-value text-maintenance">${counts.maintenance}</div>
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
                <option value="cctv" ${currentFilter.kategori === 'cctv' ? 'selected' : ''}>📷 CCTV</option>
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
                <button class="btn btn-secondary btn-sm" id="map-zoom-in">🔍+</button>
                <button class="btn btn-secondary btn-sm" id="map-zoom-out">🔍−</button>
                <button class="btn btn-secondary btn-sm" id="map-reset">↺ Reset</button>
                <div class="map-legend">
                  <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-online);"></div> Online</div>
                  <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-offline);"></div> Offline</div>
                  <div class="map-legend-item"><div class="map-legend-dot" style="background:var(--color-maintenance);"></div> Maintenance</div>
                  <div class="map-legend-item"><div class="map-legend-dot" style="background:rgba(99,102,241,0.8); border-radius:3px;"></div> Switch/Router (mock)</div>
                </div>
              </div>
              <canvas id="networkCanvas" width="900" height="500" style="width:100%; height:500px;"></canvas>
            </div>
          </div>

          <!-- TAB: TIMELINE -->
          <div class="tab-content ${currentTab === 'timeline' ? 'active' : ''}" id="tab-content-timeline">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
              <label class="form-label" style="margin:0;">Pilih Device:</label>
              <select class="form-control timeline-device-select" id="timeline-device-select" style="width:auto; min-width:200px;">
                ${mockDevices.map((d) => `<option value="${d.id}">${d.nama}</option>`).join('')}
              </select>
              <span class="text-xs text-muted">Data 24 jam terakhir</span>
            </div>
            <div class="chart-container">
              <div style="height:300px;">
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
    const icon = d.jenis === 'cctv' ? '📷' : '💻';

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
    if (currentFilter.kategori !== 'all' && d.jenis !== currentFilter.kategori) return false;
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
    applyFilter();
  });

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
      const isOnline = res.status === 'online';
      const ms = res.responseTime;
      updateDeviceStatus(id, res.status);
      device.responseTime = ms;
      device.status = res.status;

      await Swal.fire({
        title: 'Hasil Probe Jaringan',
        html: isOnline
          ? `<div style="text-align:center;">
              <div style="font-size:2.5rem; font-weight:800; color:var(--color-online); margin:8px 0;">${ms !== null ? ms + ' ms' : 'OK'}</div>
              <div style="color:#94a3b8; font-size:0.85rem;">📡 <b>${device.ip}</b> merespons probe (${res.method || device.metode})</div>
              <div class="badge badge-online" style="margin-top:8px;">✅ Online</div>
            </div>`
          : `<div style="text-align:center;">
              <div style="font-size:2rem; font-weight:800; color:var(--color-offline); margin:8px 0;">Offline / Timeout</div>
              <div style="color:#94a3b8; font-size:0.85rem;">📡 <b>${device.ip}</b> tidak merespons (${res.error || 'Request Timeout'})</div>
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
            <span style="font-size:1.5rem;">${device.jenis === 'cctv' ? '📷' : '💻'}</span>
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

// ---- NETWORK MAP (Canvas) ----
function initNetworkMap() {
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvasCtx = ctx;

  // Set actual canvas resolution
  canvas.width = canvas.offsetWidth;
  canvas.height = 500;

  drawMap(ctx, canvas.width, canvas.height);

  // Mouse events for drag/zoom
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouse = { x: e.offsetX, y: e.offsetY };
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    mapTransform.x += e.offsetX - lastMouse.x;
    mapTransform.y += e.offsetY - lastMouse.y;
    lastMouse = { x: e.offsetX, y: e.offsetY };
    drawMap(ctx, canvas.width, canvas.height);
  });

  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    mapTransform.scale = Math.max(0.5, Math.min(2.5, mapTransform.scale + delta));
    drawMap(ctx, canvas.width, canvas.height);
  }, { passive: false });

  // Toolbar buttons
  document.getElementById('map-zoom-in')?.addEventListener('click', () => {
    mapTransform.scale = Math.min(2.5, mapTransform.scale + 0.2);
    drawMap(ctx, canvas.width, canvas.height);
  });
  document.getElementById('map-zoom-out')?.addEventListener('click', () => {
    mapTransform.scale = Math.max(0.5, mapTransform.scale - 0.2);
    drawMap(ctx, canvas.width, canvas.height);
  });
  document.getElementById('map-reset')?.addEventListener('click', () => {
    mapTransform = { x: 0, y: 0, scale: 1 };
    drawMap(ctx, canvas.width, canvas.height);
  });

  // Click to show device info
  canvas.addEventListener('click', (e) => {
    const mx = (e.offsetX - mapTransform.x) / mapTransform.scale;
    const my = (e.offsetY - mapTransform.y) / mapTransform.scale;
    const hit = mockDevices.find((d) => {
      const dx = d.mapPos.x - mx;
      const dy = d.mapPos.y - my;
      return Math.sqrt(dx * dx + dy * dy) < 18;
    });
    if (hit) {
      Swal.fire({
        title: hit.nama,
        html: `
          <div style="text-align:left; font-size:0.88rem; display:flex; flex-direction:column; gap:8px;">
            <div><b>IP:</b> <code>${hit.ip}</code></div>
            <div><b>Jenis:</b> ${hit.jenis === 'cctv' ? '📷 CCTV' : '💻 Komputer'}</div>
            <div><b>Status:</b> <span style="color:${hit.status === 'online' ? '#22c55e' : hit.status === 'offline' ? '#ef4444' : '#eab308'}; font-weight:700;">${hit.status.toUpperCase()}</span></div>
            <div><b>Lokasi:</b> ${hit.lokasi}</div>
            <div><b>Metode:</b> ${hit.metode.toUpperCase()}</div>
          </div>
        `,
        background: '#1a1d2e',
        color: '#e2e8f0',
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#6366f1',
        width: 360,
      });
    }
  });
}

function drawMap(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(mapTransform.x, mapTransform.y);
  ctx.scale(mapTransform.scale, mapTransform.scale);

  // Grid background dots
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < w / mapTransform.scale; x += 30) {
    for (let y = 0; y < h / mapTransform.scale; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Central router/switch node
  const centerX = w / 2 / mapTransform.scale;
  const centerY = h / 2 / mapTransform.scale;

  // Draw connections first
  mockDevices.forEach((d) => {
    const color = d.status === 'online' ? 'rgba(34,197,94,0.3)' :
                  d.status === 'offline' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(d.mapPos.x, d.mapPos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash(d.status === 'offline' ? [4, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Draw central switch
  ctx.save();
  ctx.shadowColor = 'rgba(99,102,241,0.6)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.roundRect(centerX - 20, centerY - 12, 40, 24, 6);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SWITCH', centerX, centerY + 4);

  // Draw device nodes
  mockDevices.forEach((d) => {
    const color = d.status === 'online' ? '#22c55e' : d.status === 'offline' ? '#ef4444' : '#eab308';
    const glowColor = d.status === 'online' ? 'rgba(34,197,94,0.4)' : d.status === 'offline' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)';

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(d.mapPos.x, d.mapPos.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Icon text
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.jenis === 'cctv' ? '📷' : '💻', d.mapPos.x, d.mapPos.y + 5);

    // Label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    const shortName = d.nama.length > 15 ? d.nama.substring(0, 15) + '…' : d.nama;
    ctx.fillText(shortName, d.mapPos.x, d.mapPos.y + 26);
  });

  ctx.restore();
}

// ---- TIMELINE ----
function initTimeline() {
  const select = document.getElementById('timeline-device-select');
  if (!select) return;

  const renderChart = (deviceId) => {
    const data = getTimeline24h(parseInt(deviceId));
    renderTimeline24h('timeline-chart', data);
  };

  select.addEventListener('change', (e) => renderChart(e.target.value));
  renderChart(select.value);
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
