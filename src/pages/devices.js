// ================================================================
// DevWatch — devices.js
// Manajemen device: tabel CRUD, import CSV, export CSV
// ================================================================

import Swal from 'sweetalert2';
import { mockDevices, getGroups, addDevice, deleteDevice, duplicateDevice } from '../data/mock-devices.js';
import { getSession } from '../main.js';

let currentPage = 1;
let rowsPerPage = 25;
let searchTerm = '';
let filterGrup = 'all';
let filterStatus = 'all';
let filterJenis = 'all';

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
    if (filterJenis !== 'all' && d.jenis !== filterJenis) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
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
    const cls = { ping: 'method-ping', isapi: 'method-isapi', rtsp: 'method-rtsp', onvif: 'method-onvif' }[m] || 'method-ping';
    return `<span class="device-method-badge ${cls}">${m.toUpperCase()}</span>`;
  };

  const rows = paged.length > 0 ? paged.map((d) => {
    const statusBadge = `<div class="badge badge-${d.status}" style="white-space:nowrap;">
      <span class="status-dot ${d.status}"></span>
      ${d.status.charAt(0).toUpperCase() + d.status.slice(1)}
    </div>`;

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span>${d.jenis === 'cctv' ? '📷' : '💻'}</span>
            <div>
              <div style="font-weight:600; color:var(--color-heading);">${d.nama}</div>
              <div style="font-size:0.75rem; color:var(--color-muted);">${d.hostname || '—'}</div>
            </div>
          </div>
        </td>
        <td><span class="ip-text">${d.ip}</span></td>
        <td>${d.jenis === 'cctv' ? '📷 CCTV' : '💻 Komputer'}</td>
        <td>${methodBadge(d.metode)}</td>
        <td style="color:var(--color-text-secondary);">${d.interval}d</td>
        <td>
          <span class="chip">${d.grup}</span>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-group">
            <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Detail" onclick="window.devDetailBtn(${d.id})">🔍</button>
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
      <td colspan="8">
        <div class="empty-state">
          <div class="empty-icon">🖥️</div>
          <div class="empty-title">Tidak ada device ditemukan</div>
          <div class="empty-desc">Coba ubah filter atau tambah device baru</div>
        </div>
      </td>
    </tr>
  `;

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border-color); flex-wrap:wrap; gap:8px;">
      <span class="text-sm text-muted">Menampilkan ${start + 1}–${Math.min(start + rowsPerPage, total)} dari ${total} device</span>
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

  const refreshTable = () => {
    const wrapper = document.getElementById('devices-table-wrapper');
    if (wrapper) wrapper.innerHTML = renderDevicesTable(canEdit, isAdmin);
  };

  // Filters
  document.getElementById('dev-search')?.addEventListener('input', (e) => { searchTerm = e.target.value; currentPage = 1; refreshTable(); });
  document.getElementById('dev-filter-jenis')?.addEventListener('change', (e) => { filterJenis = e.target.value; currentPage = 1; refreshTable(); });
  document.getElementById('dev-filter-status')?.addEventListener('change', (e) => { filterStatus = e.target.value; currentPage = 1; refreshTable(); });
  document.getElementById('dev-filter-grup')?.addEventListener('change', (e) => { filterGrup = e.target.value; currentPage = 1; refreshTable(); });

  // Global handlers
  window.devGoPage = (p) => { currentPage = p; refreshTable(); };
  window.devRowsPerPage = (v) => { rowsPerPage = parseInt(v); currentPage = 1; refreshTable(); };
  window.devDetailBtn = (id) => navigate('device-detail', { id });

  window.devDeleteBtn = async (id) => {
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;
    const result = await Swal.fire({
      title: '🗑️ Hapus Device?',
      html: `Yakin ingin menghapus <b>${device.nama}</b>?<br><span style="font-size:0.82rem; color:#64748b;">Semua riwayat log device ini tetap tersimpan.</span>`,
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
      deleteDevice(id);
      Swal.fire({ icon: 'success', title: 'Device Dihapus', timer: 1500, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
      refreshTable();
    }
  };

  window.devDuplicateBtn = async (id) => {
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;
    const result = await Swal.fire({
      title: '📋 Duplikat Device',
      input: 'text',
      inputLabel: 'Nama device baru',
      inputValue: `${device.nama} (Copy)`,
      showCancelButton: true,
      confirmButtonText: 'Duplikat',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
    if (result.isConfirmed) {
      const newDev = duplicateDevice(id);
      if (newDev) {
        newDev.nama = result.value;
        Swal.fire({ icon: 'success', title: 'Device Diduplikat', text: `${result.value} berhasil ditambahkan.`, timer: 2000, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
        refreshTable();
      }
    }
  };

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

async function showDeviceForm(id, onSave) {
  const device = id ? mockDevices.find((d) => d.id === id) : null;
  const isEdit = !!device;

  const { value: formData, isConfirmed } = await Swal.fire({
    title: isEdit ? `✏️ Edit Device` : '➕ Tambah Device Baru',
    width: 640,
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:12px; padding:4px 0;">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Nama Device <span class="required">*</span></label>
            <input type="text" id="sf-nama" class="form-control" placeholder="CCTV Lobby Lantai 1" value="${device?.nama || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">IP Address <span class="required">*</span></label>
            <input type="text" id="sf-ip" class="form-control" placeholder="192.168.1.100" value="${device?.ip || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Jenis Device</label>
            <select id="sf-jenis" class="form-control">
              <option value="komputer" ${device?.jenis === 'komputer' ? 'selected' : ''}>💻 Komputer</option>
              <option value="cctv" ${device?.jenis === 'cctv' ? 'selected' : ''}>📷 CCTV Hikvision</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Metode Pengecekan</label>
            <select id="sf-metode" class="form-control">
              <option value="ping" ${device?.metode === 'ping' ? 'selected' : ''}>Ping (ICMP)</option>
              <option value="isapi" ${device?.metode === 'isapi' ? 'selected' : ''}>ISAPI Hikvision</option>
              <option value="rtsp" ${device?.metode === 'rtsp' ? 'selected' : ''}>RTSP Stream</option>
              <option value="onvif" ${device?.metode === 'onvif' ? 'selected' : ''}>ONVIF</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Port</label>
            <input type="number" id="sf-port" class="form-control" placeholder="80" value="${device?.port || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Interval Polling (detik)</label>
            <input type="number" id="sf-interval" class="form-control" placeholder="60" value="${device?.interval || 60}" min="30" max="600" />
          </div>
          <div class="form-group">
            <label class="form-label">Grup / Lokasi</label>
            <input type="text" id="sf-grup" class="form-control" placeholder="Lantai 1" value="${device?.grup || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Hostname (opsional)</label>
            <input type="text" id="sf-hostname" class="form-control" placeholder="PC-LOBBY-01" value="${device?.hostname || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Deskripsi</label>
          <textarea id="sf-deskripsi" class="form-control" placeholder="Catatan tambahan..." style="min-height:60px;">${device?.deskripsi || ''}</textarea>
        </div>
      </div>
    `,
    background: '#1a1d2e',
    color: '#e2e8f0',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: isEdit ? '💾 Simpan' : '🔌 Test & Simpan',
    denyButtonText: '📡 Test Koneksi',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#6366f1',
    denyButtonColor: '#374151',
    cancelButtonColor: '#374151',
    preConfirm: () => {
      const nama = document.getElementById('sf-nama').value.trim();
      const ip = document.getElementById('sf-ip').value.trim();
      if (!nama) { Swal.showValidationMessage('Nama device wajib diisi!'); return false; }
      if (!ip) { Swal.showValidationMessage('IP Address wajib diisi!'); return false; }
      return {
        nama,
        ip,
        jenis: document.getElementById('sf-jenis').value,
        metode: document.getElementById('sf-metode').value,
        port: document.getElementById('sf-port').value ? parseInt(document.getElementById('sf-port').value) : null,
        interval: parseInt(document.getElementById('sf-interval').value) || 60,
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
    if (isEdit) {
      Object.assign(device, formData);
      Swal.fire({ icon: 'success', title: 'Device Diperbarui', timer: 1500, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
    } else {
      addDevice(formData);
      Swal.fire({ icon: 'success', title: 'Device Ditambahkan', text: `${formData.nama} berhasil ditambahkan ke sistem.`, timer: 2000, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
    }
    onSave?.();
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

async function showImportCSV(onSave) {
  await Swal.fire({
    title: '📂 Import Device dari CSV',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
        <div class="alert-banner info">
          ℹ️ Format CSV: Nama, IP, Jenis (komputer/cctv), Metode (ping/isapi/rtsp/onvif), Interval (detik), Grup
        </div>
        <div class="csv-drop-zone" id="csv-drop-zone">
          <input type="file" id="csv-file-input" accept=".csv" />
          <div class="csv-drop-icon">📂</div>
          <div style="font-weight:600; color:var(--color-text-secondary);">Klik atau drag & drop file CSV di sini</div>
          <div style="font-size:0.78rem; color:var(--color-muted);">Format: .csv, maks 1000 baris</div>
        </div>
        <div id="csv-preview" style="display:none;">
          <div style="font-weight:600; margin-bottom:8px; color:var(--color-heading);">Preview:</div>
          <div class="table-wrapper import-preview-table" id="csv-preview-table"></div>
        </div>
      </div>
    `,
    width: 600,
    background: '#1a1d2e',
    color: '#e2e8f0',
    showCancelButton: true,
    confirmButtonText: '📥 Import Sekarang',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#6366f1',
    cancelButtonColor: '#374151',
    didOpen: () => {
      const fileInput = document.getElementById('csv-file-input');
      fileInput?.addEventListener('change', (e) => handleCSVPreview(e.target.files[0]));
    },
  });
}

function handleCSVPreview(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split('\n').filter((l) => l.trim());
    const rows = lines.slice(0, 6).map((l) => l.split(',').map((c) => c.replace(/"/g, '').trim()));
    const preview = document.getElementById('csv-preview');
    const table = document.getElementById('csv-preview-table');
    if (preview) preview.style.display = 'block';
    if (table) {
      table.innerHTML = `
        <table class="data-table">
          <thead><tr>${rows[0]?.map((h) => `<th>${h}</th>`).join('') || ''}</tr></thead>
          <tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      `;
    }
  };
  reader.readAsText(file, 'UTF-8');
}
