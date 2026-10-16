// ================================================================
// DevWatch — devices.js
// Manajemen device: tabel CRUD, import CSV, export CSV
// ================================================================

import Swal from 'sweetalert2';
import Papa from 'papaparse';
import { mockDevices, getGroups, addDevice, deleteDevice, duplicateDevice, syncDevicesFromApi } from '../data/mock-devices.js';
import { apiCreateDevice, apiUpdateDevice, apiDeleteDevice, apiPingDevice, apiTestConnection, apiImportCsv, apiBulkDeleteDevices } from '../api.js';
import { getSession } from '../main.js';
import { getAppSetting } from '../settingsManager.js';

let currentPage = 1;
let rowsPerPage = 25;
let searchTerm = '';
let filterGrup = 'all';
let filterStatus = 'all';
let filterJenis = 'all';
let selectedDeviceIds = new Set();

export function renderDevices() {
  const session = getSession();
  const canEdit = session?.role === 'admin' || session?.role === 'teknisi';
  const isAdmin = session?.role === 'admin';
  const groups = getGroups();

  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">🖥️ Manajemen Device</h1>
          <p class="page-subtitle">Kelola, tambah, dan pantau seluruh device terdaftar</p>
        </div>
        <div class="page-actions">
          ${canEdit ? `
          <button class="btn btn-secondary btn-sm" id="import-csv-btn">📂 Import CSV</button>
          <button class="btn btn-secondary btn-sm" id="export-csv-btn">📥 Export CSV</button>
          <button class="btn btn-primary" id="add-device-btn">➕ Tambah Device</button>
          ` : ''}
        </div>
      </div>

      <!-- Bulk Actions Bar -->
      <div id="bulk-actions-bar" style="display:${selectedDeviceIds.size > 0 ? 'flex' : 'none'}; align-items:center; justify-content:space-between; padding:12px 18px; background:rgba(239, 68, 68, 0.12); border:1px solid rgba(239, 68, 68, 0.35); border-radius:10px; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.3rem;">⚠️</span>
          <span id="bulk-selected-count" style="font-weight:700; color:#f87171;">${selectedDeviceIds.size} device dipilih</span>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary btn-sm" id="bulk-deselect-btn">Batalkan Pilihan</button>
          ${isAdmin ? `<button class="btn btn-sm" id="bulk-delete-btn" style="background:#ef4444; color:#fff; font-weight:700; padding:6px 14px;">🗑️ Hapus Terpilih</button>` : ''}
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="card" style="margin-bottom:16px; padding:12px 16px;">
        <div class="filter-bar">
          <div class="search-input-wrapper" style="flex:1; min-width:200px; max-width:360px;">
            <span class="search-icon">🔍</span>
            <input type="text" class="form-control" id="dev-search" placeholder="Cari nama, IP, hostname..." />
          </div>
          <select class="form-control" id="dev-filter-jenis" style="width:auto;">
            <option value="all">Semua Jenis</option>
            <option value="komputer">💻 Komputer</option>
            <option value="router">🌐 Router</option>
            <option value="switch">🔀 Switch</option>
            <option value="server">🖥️ Server</option>
            <option value="access point">📶 Access Point</option>
            <option value="cctv">📷 CCTV</option>
          </select>
          <select class="form-control" id="dev-filter-status" style="width:auto;">
            <option value="all">Semua Status</option>
            <option value="online">🟢 Online</option>
            <option value="offline">🔴 Offline</option>
            <option value="maintenance">🟡 Maintenance</option>
          </select>
          <select class="form-control" id="dev-filter-grup" style="width:auto;">
            <option value="all">Semua Grup</option>
            ${groups.map((g) => `<option value="${g}">${g}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Table -->
      <div class="card" style="padding:0; overflow:visible;">
        <div id="devices-table-wrapper">
          ${renderDevicesTable(canEdit, isAdmin)}
        </div>
      </div>
    </div>
  `;
}

function getFiltered() {
  return mockDevices.filter((d) => {
    if (filterJenis !== 'all') {
      const j = (d.jenis || '').toLowerCase();
      if (!j.includes(filterJenis)) return false;
    }
    if (filterStatus !== 'all' && (d.status || '').toLowerCase() !== filterStatus) return false;
    if (filterGrup !== 'all' && d.grup !== filterGrup) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (
        !d.nama.toLowerCase().includes(q) &&
        !d.ip.toLowerCase().includes(q) &&
        !(d.hostname || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });
}

function renderDevicesTable(canEdit, isAdmin) {
  const filtered = getFiltered();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * rowsPerPage;
  const paged = filtered.slice(start, start + rowsPerPage);

  const methodBadge = (m) => {
    const safeM = (m || 'ping').toLowerCase();
    const cls = { ping: 'method-ping', isapi: 'method-isapi', rtsp: 'method-rtsp', onvif: 'method-onvif' }[safeM] || 'method-ping';
    return `<span class="device-method-badge ${cls}">${safeM.toUpperCase()}</span>`;
  };

  const getDeviceIcon = (j) => {
    const low = (j || '').toLowerCase();
    if (low.includes('cctv')) return '📷';
    if (low.includes('router') || low.includes('gateway')) return '🌐';
    if (low.includes('switch') || low.includes('hub')) return '🔀';
    if (low.includes('server')) return '🖥️';
    if (low.includes('access point') || low.includes('ap') || low.includes('wifi')) return '📶';
    return '💻';
  };

  const getDeviceTypeBadge = (j) => {
    const low = (j || '').toLowerCase();
    if (low.includes('cctv')) return '📷 CCTV';
    if (low.includes('router') || low.includes('gateway')) return '🌐 Router';
    if (low.includes('switch') || low.includes('hub')) return '🔀 Switch';
    if (low.includes('server')) return '🖥️ Server';
    if (low.includes('access point') || low.includes('ap') || low.includes('wifi')) return '📶 Access Point';
    return '💻 Komputer';
  };

  const rows = paged.length > 0 ? paged.map((d) => {
    const st = d.status || 'offline';
    const statusBadge = `<div class="badge badge-${st}" style="white-space:nowrap;">
      <span class="status-dot ${st}"></span>
      ${st.charAt(0).toUpperCase() + st.slice(1)}
    </div>`;

    return `
      <tr>
        <td style="width:40px; text-align:center;">
          <input type="checkbox" class="device-select-checkbox" data-id="${d.id}" ${selectedDeviceIds.has(d.id) ? 'checked' : ''} style="cursor:pointer; transform:scale(1.15);" />
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.15rem;">${getDeviceIcon(d.jenis)}</span>
            <div>
              <div style="font-weight:600; color:var(--color-heading);">${d.nama}</div>
              <div style="font-size:0.75rem; color:var(--color-muted);">${d.hostname || '—'}</div>
            </div>
          </div>
        </td>
        <td><span class="ip-text">${d.ip}</span></td>
        <td>${getDeviceTypeBadge(d.jenis)}</td>
        <td>${methodBadge(d.metode)}</td>
        <td style="color:var(--color-text-secondary);">${d.interval}d</td>
        <td>
          <span class="chip">${d.grup}</span>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-group">
            <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Detail" onclick="window.devDetailBtn(${d.id})">🔍</button>
            <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Ping Langsung" onclick="window.devPingBtn(${d.id})">📡</button>
            ${canEdit ? `
            <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Edit" onclick="window.devEditBtn(${d.id})">✏️</button>
            <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Duplikat" onclick="window.devDuplicateBtn(${d.id})">📋</button>
            ` : ''}
            ${isAdmin ? `
            <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Hapus" onclick="window.devDeleteBtn(${d.id})" style="color:var(--color-offline);">🗑️</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="9">
        <div class="empty-state" style="padding:48px 16px;">
          <div class="empty-icon" style="font-size:3rem; margin-bottom:12px;">🖥️</div>
          <div class="empty-title" style="font-size:1.1rem; font-weight:700; color:var(--color-heading);">Belum Ada Perangkat di Database</div>
          <div class="empty-desc" style="color:var(--color-muted); max-width:420px; margin:0 auto 16px auto; font-size:0.85rem; line-height:1.5;">
            Database SQLite Anda saat ini bersih tanpa data dummy. Klik tombol <b>+ Tambah Device</b> di atas atau impor berkas CSV untuk mendaftarkan unit pertama Anda.
          </div>
        </div>
      </td>
    </tr>
  `;

  const allPagedSelected = paged.length > 0 && paged.every((d) => selectedDeviceIds.has(d.id));

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border-color); flex-wrap:wrap; gap:8px;">
      <span class="text-sm text-muted">${total > 0 ? `Menampilkan ${start + 1}–${Math.min(start + rowsPerPage, total)} dari ${total} device` : 'Menampilkan 0 device'}</span>
      <div class="rows-per-page">
        Baris per halaman:
        <select id="rows-per-page-select" onchange="window.devRowsPerPage(this.value)">
          <option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50</option>
          <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100</option>
        </select>
      </div>
    </div>
    <div class="table-wrapper" style="border:none; border-radius:0;">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">
              <input type="checkbox" id="select-all-devices" ${allPagedSelected ? 'checked' : ''} style="cursor:pointer; transform:scale(1.15);" />
            </th>
            <th>Nama Device</th>
            <th>IP Address</th>
            <th>Jenis</th>
            <th>Metode</th>
            <th>Interval</th>
            <th>Grup</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="display:flex; justify-content:center; padding:16px;">
      ${renderPagination(currentPage, totalPages)}
    </div>
  `;
}

function renderPagination(page, total) {
  if (total <= 1) return '';
  const pages = [];
  pages.push(`<button class="pagination-btn" onclick="window.devGoPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>◀</button>`);
  for (let i = Math.max(1, page - 2); i <= Math.min(total, page + 2); i++) {
    pages.push(`<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="window.devGoPage(${i})">${i}</button>`);
  }
  pages.push(`<button class="pagination-btn" onclick="window.devGoPage(${page + 1})" ${page === total ? 'disabled' : ''}>▶</button>`);
  return `<div class="pagination">${pages.join('')}</div>`;
}

export function initDevicesEvents(navigate) {
  const session = getSession();
  const canEdit = session?.role === 'admin' || session?.role === 'teknisi';
  const isAdmin = session?.role === 'admin';

  const updateBulkBar = () => {
    const bar = document.getElementById('bulk-actions-bar');
    const label = document.getElementById('bulk-selected-count');
    if (bar && label) {
      if (selectedDeviceIds.size > 0) {
        bar.style.display = 'flex';
        label.textContent = `${selectedDeviceIds.size} device dipilih`;
      } else {
        bar.style.display = 'none';
      }
    }
  };

  const bindCheckboxes = () => {
    const master = document.getElementById('select-all-devices');
    const rowBoxes = document.querySelectorAll('.device-select-checkbox');

    if (master) {
      master.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const filtered = getFiltered();
        const start = (currentPage - 1) * rowsPerPage;
        const paged = filtered.slice(start, start + rowsPerPage);
        paged.forEach((d) => {
          if (checked) selectedDeviceIds.add(d.id);
          else selectedDeviceIds.delete(d.id);
        });
        rowBoxes.forEach((box) => { box.checked = checked; });
        updateBulkBar();
      });
    }

    rowBoxes.forEach((box) => {
      box.addEventListener('change', (e) => {
        const id = parseInt(e.target.getAttribute('data-id'));
        if (e.target.checked) selectedDeviceIds.add(id);
        else selectedDeviceIds.delete(id);
        if (master) {
          const filtered = getFiltered();
          const start = (currentPage - 1) * rowsPerPage;
          const paged = filtered.slice(start, start + rowsPerPage);
          master.checked = paged.length > 0 && paged.every((d) => selectedDeviceIds.has(d.id));
        }
        updateBulkBar();
      });
    });
  };

  const refreshTable = () => {
    const wrapper = document.getElementById('devices-table-wrapper');
    if (wrapper) {
      wrapper.innerHTML = renderDevicesTable(canEdit, isAdmin);
      bindCheckboxes();
      updateBulkBar();
    }
  };

  bindCheckboxes();
  updateBulkBar();

  // Bulk action buttons
  document.getElementById('bulk-deselect-btn')?.addEventListener('click', () => {
    selectedDeviceIds.clear();
    refreshTable();
  });

  document.getElementById('bulk-delete-btn')?.addEventListener('click', async () => {
    const count = selectedDeviceIds.size;
    if (count === 0) return;

    const result = await Swal.fire({
      title: `🗑️ Hapus ${count} Device?`,
      html: `Yakin ingin menghapus <b>${count} device</b> sekaligus?<br><span style="font-size:0.82rem; color:#ef4444;">Perangkat yang dipilih akan dihapus permanen dari database.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Ya, Hapus ${count} Device`,
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#374151',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });

    if (result.isConfirmed) {
      try {
        await apiBulkDeleteDevices(Array.from(selectedDeviceIds));
        selectedDeviceIds.clear();
        await syncDevicesFromApi();
        Swal.fire({
          icon: 'success',
          title: 'Device Dihapus',
          text: `${count} device berhasil dihapus dari database.`,
          timer: 2000,
          showConfirmButton: false,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
        refreshTable();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Menghapus', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  });

  // Filters
  document.getElementById('dev-search')?.addEventListener('input', (e) => { searchTerm = e.target.value; currentPage = 1; refreshTable(); });
  document.getElementById('dev-filter-jenis')?.addEventListener('change', (e) => { filterJenis = e.target.value; currentPage = 1; refreshTable(); });
  document.getElementById('dev-filter-status')?.addEventListener('change', (e) => { filterStatus = e.target.value; currentPage = 1; refreshTable(); });
  document.getElementById('dev-filter-grup')?.addEventListener('change', (e) => { filterGrup = e.target.value; currentPage = 1; refreshTable(); });

  // Global handlers
  window.devGoPage = (p) => { currentPage = p; refreshTable(); };
  window.devRowsPerPage = (v) => { rowsPerPage = parseInt(v); currentPage = 1; refreshTable(); };
  window.devDetailBtn = (id) => navigate('device-detail', { id });

  window.devPingBtn = async (id) => {
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;

    Swal.fire({
      title: `Probe Jaringan ke ${device.nama}`,
      html: `Mengirim probe langsung ke <code style="color:var(--color-accent);">${device.ip}</code>...`,
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
      device.status = isOnline ? 'online' : 'offline';
      device.responseTime = ms;
      refreshTable();

      Swal.fire({
        title: 'Hasil Probe',
        html: isOnline
          ? `<div style="text-align:center;">
              <div style="font-size:2.2rem; font-weight:800; color:var(--color-online); margin:8px 0;">${ms !== null && ms !== undefined ? ms + ' ms' : 'OK'}</div>
              <div style="color:#94a3b8;">${device.ip} merespons probe (${pingData.method || device.metode}) ✅</div>
            </div>`
          : `<div style="text-align:center;">
              <div style="font-size:2rem; font-weight:800; color:var(--color-offline); margin:8px 0;">Offline / Timeout</div>
              <div style="color:#94a3b8;">${device.ip} ${pingData.statusText || pingData.error || 'Request Timeout'} ❌</div>
            </div>`,
        background: '#1a1d2e',
        color: '#e2e8f0',
        confirmButtonColor: '#6366f1',
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Probe', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    }
  };

  window.devDeleteBtn = async (id) => {
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;
    const result = await Swal.fire({
      title: '🗑️ Hapus Device?',
      html: `Yakin ingin menghapus <b>${device.nama}</b>?<br><span style="font-size:0.82rem; color:#64748b;">Data akan dihapus permanen dari database.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#374151',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
    if (result.isConfirmed) {
      try {
        await apiDeleteDevice(id);
        selectedDeviceIds.delete(id);
        await syncDevicesFromApi();
        Swal.fire({ icon: 'success', title: 'Device Dihapus', timer: 1500, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
        refreshTable();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Menghapus', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  };

  window.devDuplicateBtn = (id) => showDeviceForm(id, refreshTable, true);

  window.devEditBtn = (id) => showDeviceForm(id, refreshTable);

  // Add Device
  document.getElementById('add-device-btn')?.addEventListener('click', () => {
    showDeviceForm(null, refreshTable);
  });

  // Export CSV
  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    exportCSV();
  });

  // Import CSV
  document.getElementById('import-csv-btn')?.addEventListener('click', () => {
    showImportCSV(refreshTable);
  });
}

async function showDeviceForm(id, onSave, isDuplicate = false) {
  const device = id ? mockDevices.find((d) => d.id === id) : null;
  const isEdit = !!device && !isDuplicate;

  const defaultNama = isDuplicate && device ? `${device.nama} (Salinan)` : (device?.nama || '');

  // Daftar opsi parent uplink (Router, Switch, dsb)
  const candidateParents = mockDevices.filter((d) => d.id !== id);
  const parentOptionsHtml = candidateParents.map((p) => {
    const isSelected = device?.parent_id === p.id;
    const pIcon = p.jenis === 'router' ? '🌐' : p.jenis === 'switch' ? '🔀' : p.jenis === 'server' ? '🖥️' : '💻';
    return `<option value="${p.id}" ${isSelected ? 'selected' : ''}>${pIcon} ${p.nama} (${p.ip}) - [${p.jenis?.toUpperCase() || 'DEVICE'}]</option>`;
  }).join('');

  const currentJenis = (device?.jenis || '').toLowerCase();

  const { value: formData, isConfirmed } = await Swal.fire({
    title: isDuplicate ? `📋 Duplikat Device` : isEdit ? `✏️ Edit Device` : '➕ Tambah Device Baru',
    width: 660,
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:12px; padding:4px 0;">
        <div class="form-grid">
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Nama Device <span class="required">*</span></label>
            <input type="text" id="sf-nama" class="form-control" placeholder="Router Utama Lantai 1 / CCTV Lobby" value="${defaultNama}" />
          </div>

          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">IP Address <span class="required">*</span></label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="sf-ip" class="form-control" style="flex:1;" placeholder="192.168.1.100" value="${device?.ip || ''}" />
              <button type="button" id="btn-test-inline" class="btn btn-secondary" style="white-space:nowrap; padding:6px 14px; font-size:0.82rem; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.4); color:#a5b4fc; font-weight:600; cursor:pointer;">
                📡 Test Koneksi
              </button>
            </div>
            <div id="test-connection-result" style="margin-top:6px; font-size:0.8rem; display:none; padding:6px 10px; border-radius:6px; background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.08);"></div>
          </div>

          <div class="form-group">
            <label class="form-label">Jenis Device</label>
            <select id="sf-jenis" class="form-control">
              <option value="Komputer" ${currentJenis === 'komputer' ? 'selected' : ''}>💻 Komputer</option>
              <option value="Router" ${currentJenis === 'router' ? 'selected' : ''}>🌐 Router / Gateway</option>
              <option value="Switch" ${currentJenis === 'switch' ? 'selected' : ''}>🔀 Switch / Hub</option>
              <option value="Server" ${currentJenis === 'server' ? 'selected' : ''}>🖥️ Server</option>
              <option value="Access Point" ${['access point', 'ap', 'wifi'].includes(currentJenis) ? 'selected' : ''}>📶 Access Point</option>
              <option value="CCTV Hikvision" ${currentJenis.includes('cctv') ? 'selected' : ''}>📷 CCTV Hikvision</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Terhubung ke (Parent / Uplink)</label>
            <select id="sf-parent" class="form-control">
              <option value="">-- Otomatis Berdasarkan Subnet --</option>
              ${parentOptionsHtml}
            </select>
          </div>

          <div class="form-group" style="grid-column: span 2;">
            <div id="subnet-hint-box" style="display:none; padding:8px 12px; border-radius:6px; font-size:0.8rem; line-height:1.45;"></div>
          </div>

          <div class="form-group">
            <label class="form-label">Metode Pengecekan</label>
            <select id="sf-metode" class="form-control">
              <option value="PING" ${(device?.metode || '').toUpperCase() === 'PING' ? 'selected' : ''}>Ping (ICMP)</option>
              <option value="ISAPI" ${(device?.metode || '').toUpperCase() === 'ISAPI' ? 'selected' : ''}>ISAPI Hikvision</option>
              <option value="RTSP" ${(device?.metode || '').toUpperCase() === 'RTSP' ? 'selected' : ''}>RTSP Stream</option>
              <option value="ONVIF" ${(device?.metode || '').toUpperCase() === 'ONVIF' ? 'selected' : ''}>ONVIF</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Port</label>
            <input type="number" id="sf-port" class="form-control" placeholder="80" value="${device?.port || ''}" />
          </div>

          <div class="form-group">
            <label class="form-label">Interval Polling (detik)</label>
            <input type="number" id="sf-interval" class="form-control" placeholder="60" value="${device?.interval || getAppSetting('default_ping_interval', 60)}" min="30" max="600" />
          </div>

          <div class="form-group">
            <label class="form-label">Grup / Lokasi</label>
            <input type="text" id="sf-grup" class="form-control" placeholder="Lantai 1" value="${device?.grup || ''}" />
          </div>

          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Hostname (opsional)</label>
            <input type="text" id="sf-hostname" class="form-control" placeholder="ROUTER-MAIN-01" value="${device?.hostname || ''}" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Deskripsi</label>
          <textarea id="sf-deskripsi" class="form-control" placeholder="Catatan fungsi perangkat..." style="min-height:55px;">${device?.deskripsi || ''}</textarea>
        </div>
      </div>
    `,
    background: '#1a1d2e',
    color: '#e2e8f0',
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonText: isEdit ? '💾 Simpan Perubahan' : '💾 Simpan Device',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#6366f1',
    cancelButtonColor: '#374151',
    didOpen: () => {
      const btnTest = document.getElementById('btn-test-inline');
      const resDiv = document.getElementById('test-connection-result');
      const ipInput = document.getElementById('sf-ip');
      const metodeSelect = document.getElementById('sf-metode');
      const portInput = document.getElementById('sf-port');
      const parentSelect = document.getElementById('sf-parent');
      const hintBox = document.getElementById('subnet-hint-box');

      const checkSubnet = () => {
        const currentIp = ipInput.value.trim();
        const parentId = parseInt(parentSelect.value, 10);
        if (!currentIp || !parentId) {
          if (hintBox) hintBox.style.display = 'none';
          return;
        }
        const parentDev = mockDevices.find((d) => d.id === parentId);
        if (!parentDev || !parentDev.ip) {
          if (hintBox) hintBox.style.display = 'none';
          return;
        }
        const curParts = currentIp.split('.');
        const parentParts = parentDev.ip.split('.');
        if (curParts.length >= 3 && parentParts.length >= 3) {
          const curSub = curParts.slice(0, 3).join('.');
          const parSub = parentParts.slice(0, 3).join('.');
          if (curSub !== parSub) {
            hintBox.style.display = 'block';
            hintBox.style.background = 'rgba(249,115,22,0.14)';
            hintBox.style.border = '1px solid rgba(249,115,22,0.4)';
            hintBox.style.color = '#fdba74';
            hintBox.innerHTML = `⚡ <strong>Rekomendasi Rute Inter-VLAN / L3</strong>: Subnet perangkat (<code>${curSub}.x</code>) berbeda dengan parent <strong>${parentDev.nama}</strong> (<code>${parSub}.x</code>). Sistem akan otomatis menghubungkan perangkat melalui jalur routing L3 di Peta Topologi.`;
          } else {
            hintBox.style.display = 'block';
            hintBox.style.background = 'rgba(34,197,94,0.12)';
            hintBox.style.border = '1px solid rgba(34,197,94,0.35)';
            hintBox.style.color = '#86efac';
            hintBox.innerHTML = `🟢 <strong>Satu Jaringan Subnet (<code>${curSub}.x</code>)</strong>: Perangkat dan uplink berada dalam satu segmen broadcast (Layer 2 Switching).`;
          }
        }
      };

      ipInput?.addEventListener('input', checkSubnet);
      parentSelect?.addEventListener('change', checkSubnet);
      checkSubnet();

      btnTest?.addEventListener('click', async () => {
        const ip = ipInput.value.trim();
        if (!ip) {
          resDiv.style.display = 'block';
          resDiv.innerHTML = '<span style="color:#ef4444;">⚠️ Masukkan IP Address terlebih dahulu untuk diuji!</span>';
          return;
        }

        btnTest.disabled = true;
        btnTest.innerHTML = '⏳ Menguji...';
        resDiv.style.display = 'block';
        resDiv.innerHTML = `<span style="color:#94a3b8;">Mengirim paket probe ke <strong>${ip}</strong>...</span>`;

        try {
          const resp = await apiTestConnection({
            ip,
            metode: metodeSelect.value,
            port: portInput.value ? parseInt(portInput.value, 10) : null,
          });

          if (resp.alive) {
            resDiv.innerHTML = `<span style="color:#22c55e; font-weight:700;">✅ Berhasil Terhubung!</span> Latensi: <strong>${resp.time || resp.responseTime} ms</strong> (${resp.statusText || 'Online'})`;
          } else {
            resDiv.innerHTML = `<span style="color:#ef4444; font-weight:700;">❌ Gagal Terhubung:</span> ${resp.statusText || 'Request Timeout / Host Unreachable'}`;
          }
        } catch (err) {
          resDiv.innerHTML = `<span style="color:#ef4444; font-weight:700;">❌ Galat Pengujian:</span> ${err.message}`;
        } finally {
          btnTest.disabled = false;
          btnTest.innerHTML = '📡 Test Koneksi';
        }
      });
    },
    preConfirm: () => {
      const nama = document.getElementById('sf-nama').value.trim();
      const ip = document.getElementById('sf-ip').value.trim();
      if (!nama) { Swal.showValidationMessage('Nama device wajib diisi!'); return false; }
      if (!ip) { Swal.showValidationMessage('IP Address wajib diisi!'); return false; }
      const parentVal = document.getElementById('sf-parent').value;
      return {
        nama,
        ip,
        jenis: document.getElementById('sf-jenis').value,
        parent_id: parentVal ? parseInt(parentVal, 10) : null,
        metode: document.getElementById('sf-metode').value,
        port: document.getElementById('sf-port').value ? parseInt(document.getElementById('sf-port').value, 10) : null,
        interval: parseInt(document.getElementById('sf-interval').value, 10) || 60,
        grup: document.getElementById('sf-grup').value.trim() || 'Default',
        hostname: document.getElementById('sf-hostname').value.trim() || null,
        deskripsi: document.getElementById('sf-deskripsi').value.trim(),
        lokasi: document.getElementById('sf-grup').value.trim() || '',
        active: true,
        credHikvision: null,
      };
    },
  });

  if (isConfirmed && formData) {
    try {
      if (isEdit) {
        await apiUpdateDevice(device.id, formData);
        await syncDevicesFromApi();
        Swal.fire({ icon: 'success', title: 'Device Diperbarui', timer: 1500, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
      } else {
        await apiCreateDevice(formData);
        await syncDevicesFromApi();
        Swal.fire({ icon: 'success', title: 'Device Ditambahkan', text: `${formData.nama} berhasil disimpan ke database.`, timer: 2000, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
      }
      onSave?.();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan Device', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    }
  }
}

function exportCSV() {
  const headers = ['ID', 'Nama', 'IP', 'Jenis', 'Metode', 'Port', 'Interval', 'Grup', 'Lokasi', 'Status', 'Uptime24h', 'Deskripsi'];
  const rows = mockDevices.map((d) => [
    d.id, d.nama, d.ip, d.jenis, d.metode,
    d.port || '', d.interval, d.grup, d.lokasi,
    d.status, d.uptime24h, d.deskripsi || '',
  ]);

  const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `devwatch-devices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  Swal.fire({
    toast: true,
    icon: 'success',
    title: 'File CSV berhasil diunduh',
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    background: '#1a1d2e',
    color: '#e2e8f0',
  });
}

function downloadCsvTemplate() {
  const headers = ['Nama', 'IP Address', 'Hostname', 'Jenis', 'Metode', 'Port', 'Interval', 'Grup', 'Lokasi', 'Deskripsi'];
  const samples = [
    ['PC Kasir 01', '192.168.1.101', 'pc-kasir-01', 'Komputer', 'PING', '', '60', 'Kasir', 'Lantai 1', 'PC Kasir Utama'],
    ['CCTV Lobby Lantai 1', '192.168.1.150', 'cctv-lobby', 'CCTV Hikvision', 'ISAPI', '80', '60', 'Keamanan', 'Lobby Lt. 1', 'Kamera gerbang masuk'],
    ['CCTV Area Parkir', '192.168.1.151', 'cctv-parkir', 'CCTV Hikvision', 'RTSP', '554', '60', 'Keamanan', 'Parkir Belakang', 'Kamera outdoor RTSP'],
    ['Kamera Koridor ONVIF', '192.168.1.152', 'cam-onvif', 'CCTV Hikvision', 'ONVIF', '80', '60', 'Keamanan', 'Koridor Timur', 'Kamera profil ONVIF'],
  ];

  const csvRows = [headers, ...samples].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvRows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'devwatch-template-import-devices.csv';
  a.click();
  URL.revokeObjectURL(url);
}

let parsedCsvDevices = [];

async function showImportCSV(onSave) {
  parsedCsvDevices = [];
  const { isConfirmed } = await Swal.fire({
    title: '📂 Import Device dari CSV',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:8px; padding:10px 14px;">
          <div>
            <div style="font-weight:600; font-size:0.85rem; color:var(--color-heading);">Gunakan format CSV standar</div>
            <div style="font-size:0.75rem; color:var(--color-muted);">Kolom: Nama, IP, Jenis, Metode, Port, Interval, Grup, Lokasi</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-download-csv-template" style="padding:5px 12px; font-size:0.78rem; white-space:nowrap;">
            📥 Unduh Template
          </button>
        </div>

        <div class="csv-drop-zone" id="csv-drop-zone">
          <input type="file" id="csv-file-input" accept=".csv" />
          <div class="csv-drop-icon">📂</div>
          <div style="font-weight:600; color:var(--color-text-secondary);">Klik atau drag & drop file CSV di sini</div>
          <div style="font-size:0.78rem; color:var(--color-muted);">Mendukung format koma/titik koma, maks 1.000 baris</div>
        </div>

        <div id="csv-preview" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-weight:600; color:var(--color-heading);" id="csv-preview-count">Preview Perangkat:</div>
            <span class="badge badge-online" id="csv-valid-badge">Siap Diimpor</span>
          </div>
          <div class="table-wrapper import-preview-table" id="csv-preview-table" style="max-height:220px; overflow-y:auto;"></div>
        </div>
      </div>
    `,
    width: 680,
    background: '#1a1d2e',
    color: '#e2e8f0',
    showCancelButton: true,
    confirmButtonText: '📥 Import Sekarang',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#6366f1',
    cancelButtonColor: '#374151',
    didOpen: () => {
      document.getElementById('btn-download-csv-template')?.addEventListener('click', downloadCsvTemplate);
      const fileInput = document.getElementById('csv-file-input');
      fileInput?.addEventListener('change', (e) => handleCSVPreview(e.target.files[0]));
    },
  });

  if (isConfirmed && parsedCsvDevices.length > 0) {
    try {
      const res = await apiImportCsv(parsedCsvDevices);
      await syncDevicesFromApi();
      onSave?.();
      Swal.fire({
        icon: 'success',
        title: 'Import CSV Berhasil',
        text: `${res.imported || res.count || parsedCsvDevices.length} perangkat berhasil dimasukkan ke sistem.`,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Import Gagal', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    }
  }
}

function handleCSVPreview(file) {
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: 'greedy',
    complete: (results) => {
      const rawData = results.data || [];
      if (rawData.length === 0) {
        Swal.showValidationMessage?.('Berkas CSV kosong atau tidak memiliki data.');
        return;
      }

      parsedCsvDevices = rawData.map((row) => {
        // Ambil nilai dengan pencocokan nama kolom fleksibel
        const getVal = (...keys) => {
          for (const k of keys) {
            const match = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
            if (match && row[match] !== undefined && row[match] !== null && String(row[match]).trim() !== '') {
              return String(row[match]).trim();
            }
          }
          return '';
        };

        const nama = getVal('nama', 'name', 'device', 'perangkat') || 'Device CSV';
        const ip = getVal('ip address', 'ip_address', 'ip', 'host', 'target') || '127.0.0.1';
        const hostname = getVal('hostname', 'host_name') || '';
        const jenisRaw = getVal('jenis', 'type', 'kategori') || 'Komputer';
        const jenis = jenisRaw.toLowerCase().includes('cctv') || jenisRaw.toLowerCase().includes('hikvision')
          ? 'CCTV Hikvision'
          : 'Komputer';

        const metodeRaw = getVal('metode', 'method', 'protocol') || 'PING';
        const metodeUp = metodeRaw.toUpperCase();
        const metode = ['PING', 'ISAPI', 'RTSP', 'ONVIF'].includes(metodeUp) ? metodeUp : 'PING';

        const portRaw = getVal('port', 'tcp_port');
        const port = portRaw ? parseInt(portRaw, 10) || null : (metode === 'RTSP' ? 554 : metode === 'ISAPI' ? 80 : null);
        const intervalRaw = getVal('interval', 'interval_detik', 'interval (detik)', 'polling');
        const interval_detik = Math.max(10, Math.min(3600, parseInt(intervalRaw, 10) || 60));
        const grup = getVal('grup', 'group', 'kelompok') || 'Umum';
        const lokasi = getVal('lokasi', 'location', 'ruang', 'lantai') || 'Kantor';
        const deskripsi = getVal('deskripsi', 'description', 'keterangan') || '';

        return {
          nama,
          ip,
          hostname,
          jenis,
          metode,
          port,
          interval_detik,
          grup,
          lokasi,
          deskripsi,
        };
      }).filter((d) => d.nama && d.ip && d.ip !== '');

      const preview = document.getElementById('csv-preview');
      const table = document.getElementById('csv-preview-table');
      const countEl = document.getElementById('csv-preview-count');
      if (countEl) countEl.innerText = `Preview Perangkat (${parsedCsvDevices.length} baris valid):`;
      if (preview) preview.style.display = 'block';

      if (table) {
        table.innerHTML = `
          <table class="data-table" style="font-size:0.75rem;">
            <thead>
              <tr>
                <th>Nama</th>
                <th>IP Address</th>
                <th>Jenis</th>
                <th>Metode</th>
                <th>Port</th>
                <th>Grup</th>
              </tr>
            </thead>
            <tbody>
              ${parsedCsvDevices.slice(0, 8).map((d) => `
                <tr>
                  <td><b>${d.nama}</b></td>
                  <td><code>${d.ip}</code></td>
                  <td>${d.jenis}</td>
                  <td><span class="chip">${d.metode}</span></td>
                  <td>${d.port || '—'}</td>
                  <td>${d.grup}</td>
                </tr>
              `).join('')}
              ${parsedCsvDevices.length > 8 ? `<tr><td colspan="6" style="text-align:center; color:var(--color-muted);">...dan ${parsedCsvDevices.length - 8} perangkat lainnya</td></tr>` : ''}
            </tbody>
          </table>
        `;
      }
    },
    error: (err) => {
      Swal.fire({ icon: 'error', title: 'Format CSV Salah', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    },
  });
}

