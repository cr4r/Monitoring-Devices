// ================================================================
// DevWatch - devices.js
// Manajemen device: tabel CRUD, import CSV, export CSV
// ================================================================

import Swal from 'sweetalert2';
import Papa from 'papaparse';
import { mockDevices, getGroups, addDevice, deleteDevice, duplicateDevice, syncDevicesFromApi, cleanDeviceIp, parseSqliteUtc, formatTimeAgo } from '../data/mock-devices.js';
import { apiCreateDevice, apiUpdateDevice, apiDeleteDevice, apiPingDevice, apiTestConnection, apiImportCsv, apiBulkDeleteDevices, apiPingAllDevices } from '../api.js';
import { getSession } from '../main.js';
import { getAppSetting } from '../settingsManager.js';

let currentPage = 1;
let rowsPerPage = 25;
let searchTerm = '';
let filterGrup = 'all';
let filterStatus = 'all';
let filterJenis = 'all';
let selectedDeviceIds = new Set();
let sortColumn = 'ip';
let sortDirection = 'asc';

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
          <button class="btn btn-secondary btn-sm" id="ping-all-btn" title="Ping serentak seluruh perangkat">📡 Ping All</button>
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
  const list = mockDevices.filter((d) => {
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

  // Sorting
  list.sort((a, b) => {
    let result = 0;
    if (sortColumn === 'ip') {
      result = compareDeviceIps(a.ip, b.ip);
    } else if (sortColumn === 'nama') {
      result = (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' });
    } else if (sortColumn === 'jenis') {
      result = (a.jenis || '').localeCompare(b.jenis || '', 'id', { sensitivity: 'base' });
    } else if (sortColumn === 'metode') {
      result = (a.metode || '').localeCompare(b.metode || '', 'id', { sensitivity: 'base' });
    } else if (sortColumn === 'interval') {
      result = (parseInt(a.interval, 10) || 0) - (parseInt(b.interval, 10) || 0);
    } else if (sortColumn === 'grup') {
      result = (a.grup || '').localeCompare(b.grup || '', 'id', { sensitivity: 'base' });
    } else if (sortColumn === 'lastCheck') {
      const tA = a.lastChecked ? new Date(a.lastChecked).getTime() : 0;
      const tB = b.lastChecked ? new Date(b.lastChecked).getTime() : 0;
      result = tA - tB;
    } else if (sortColumn === 'status') {
      result = (a.status || '').localeCompare(b.status || '', 'id', { sensitivity: 'base' });
    }
    return sortDirection === 'desc' ? -result : result;
  });

  return list;
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

    const checkDate = d.lastChecked ? parseSqliteUtc(d.lastChecked) : null;
    const lastChecked = d.lastChecked ? formatTimeAgo(d.lastChecked) : 'Belum dicek';
    const exactCheck = checkDate ? checkDate.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Belum pernah dicek';

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
              <div style="font-size:0.75rem; color:var(--color-muted);">${d.hostname || '-'}</div>
            </div>
          </div>
        </td>
        <td><span class="ip-text" title="${d.ip}">${cleanDeviceIp(d.ip)}</span></td>
        <td>${getDeviceTypeBadge(d.jenis)}</td>
        <td>${methodBadge(d.metode)}</td>
        <td style="color:var(--color-text-secondary);">${d.interval}d</td>
        <td>
          <span class="chip">${d.grup}</span>
        </td>
        <td style="white-space:nowrap;">
          <span title="${exactCheck}" style="cursor:help; font-size:0.8rem; font-weight:600; color:var(--color-heading);">
            ⏱️ ${lastChecked}
          </span>
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
      <td colspan="10">
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

  const getSortIndicator = (col) => {
    if (sortColumn !== col) {
      return '<span class="sort-icon" style="opacity:0.35; font-size:0.75rem; margin-left:4px;">↕</span>';
    }
    return sortDirection === 'asc'
      ? '<span class="sort-icon" style="color:var(--color-accent); font-weight:700; font-size:0.8rem; margin-left:4px;">▲</span>'
      : '<span class="sort-icon" style="color:var(--color-accent); font-weight:700; font-size:0.8rem; margin-left:4px;">▼</span>';
  };

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
            <th class="sortable-th" data-sort="nama" style="cursor:pointer; user-select:none;" title="Urutkan A-Z / Z-A berdasarkan Nama">
              Nama Device ${getSortIndicator('nama')}
            </th>
            <th class="sortable-th" data-sort="ip" style="cursor:pointer; user-select:none;" title="Urutkan IP (Atas ke Bawah / Bawah ke Atas)">
              IP Address ${getSortIndicator('ip')}
            </th>
            <th class="sortable-th" data-sort="jenis" style="cursor:pointer; user-select:none;" title="Urutkan A-Z / Z-A berdasarkan Jenis">
              Jenis ${getSortIndicator('jenis')}
            </th>
            <th class="sortable-th" data-sort="metode" style="cursor:pointer; user-select:none;" title="Urutkan Metode">
              Metode ${getSortIndicator('metode')}
            </th>
            <th class="sortable-th" data-sort="interval" style="cursor:pointer; user-select:none;" title="Urutkan Interval">
              Interval ${getSortIndicator('interval')}
            </th>
            <th class="sortable-th" data-sort="grup" style="cursor:pointer; user-select:none;" title="Urutkan A-Z / Z-A berdasarkan Grup">
              Grup ${getSortIndicator('grup')}
            </th>
            <th class="sortable-th" data-sort="lastCheck" style="cursor:pointer; user-select:none;" title="Urutkan Waktu Cek Terakhir">
              Last Check ${getSortIndicator('lastCheck')}
            </th>
            <th class="sortable-th" data-sort="status" style="cursor:pointer; user-select:none;" title="Urutkan Status">
              Status ${getSortIndicator('status')}
            </th>
            <th style="text-align:center;">Aksi</th>
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

  const bindTheadSorting = () => {
    document.querySelectorAll('#devices-table-wrapper th.sortable-th').forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (!col) return;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'asc';
        }
        currentPage = 1;
        refreshTable();
      });
    });
  };

  const refreshTable = () => {
    const wrapper = document.getElementById('devices-table-wrapper');
    if (wrapper) {
      wrapper.innerHTML = renderDevicesTable(canEdit, isAdmin);
      bindCheckboxes();
      bindTheadSorting();
      updateBulkBar();
    }
  };

  bindCheckboxes();
  bindTheadSorting();
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

  // Ping All button handler
  document.getElementById('ping-all-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('ping-all-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Memindai...'; }

    Swal.fire({
      title: '📡 Memindai Seluruh Perangkat',
      html: `<div style="text-align:center; padding:10px;">
        <div style="color:var(--color-muted); font-size:0.85rem; margin-bottom:6px;">Mengirim probe serentak ke seluruh perangkat aktif...</div>
        <div style="font-size:0.8rem; color:#94a3b8;">Status tabel akan otomatis disinkronkan.</div>
      </div>`,
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
      showConfirmButton: false,
      background: '#1a1d2e',
      color: '#e2e8f0',
    });

    try {
      const res = await apiPingAllDevices();
      await syncDevicesFromApi();
      refreshTable();

      const onlineCount = res.online !== undefined ? res.online : mockDevices.filter((d) => d.status === 'online').length;
      const offlineCount = res.offline !== undefined ? res.offline : mockDevices.filter((d) => d.status === 'offline').length;
      const maintCount = res.maintenance !== undefined ? res.maintenance : mockDevices.filter((d) => d.status === 'maintenance').length;

      await Swal.fire({
        icon: 'success',
        title: 'Pemindaian Selesai',
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
              Tabel perangkat telah disegarkan dengan status koneksi terkini.
            </div>
          </div>
        `,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#6366f1',
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Memindai', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📡 Ping All'; }
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
  window.showDeviceForm = showDeviceForm;

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

export async function showDeviceForm(id, onSave, isDuplicate = false) {
  const device = id ? mockDevices.find((d) => d.id === id) : null;
  const isEdit = !!device && !isDuplicate;

  const defaultNama = isDuplicate && device ? `${device.nama} (Salinan)` : (device?.nama || '');

  // Kumpulan grup & lokasi unik yang pernah dibuat di sistem/database
  const existingGroups = [...new Set(mockDevices.map((d) => d.grup).filter(Boolean))].sort();
  const existingLocations = [...new Set(mockDevices.map((d) => d.lokasi).filter(Boolean))].sort();

  // Helper subnet label
  const getSubnetLabel = (ip) => {
    if (!ip) return '';
    const parts = ip.split('.');
    return parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}.x` : ip;
  };

  // Daftar opsi parent uplink (Router, Switch, dsb) dikelompokkan per grup
  const candidateParents = mockDevices.filter((d) => d.id !== id);
  const infraParents = candidateParents.filter((p) => ['router', 'switch'].includes((p.jenis || '').toLowerCase()));
  const allParentGroups = [...new Set(candidateParents.map((p) => p.grup || 'Umum'))].sort();

  let parentOptionsHtml = '';

  // 1. Kategori Khusus: Router & Switch (Rekomendasi Utama Uplink)
  if (infraParents.length > 0) {
    parentOptionsHtml += `<optgroup label="🌐 Rekomendasi Uplink (Router & Switch)">`;
    infraParents.forEach((p) => {
      const isSelected = device?.parent_id === p.id;
      const pIcon = (p.jenis || '').toLowerCase() === 'router' ? '🌐' : '🔀';
      const subLabel = getSubnetLabel(p.ip);
      parentOptionsHtml += `<option value="${p.id}" ${isSelected ? 'selected' : ''}>${pIcon} ${p.nama} (${p.ip}) • [${subLabel}] • ${p.grup || 'Umum'}</option>`;
    });
    parentOptionsHtml += `</optgroup>`;
  }

  // 2. Kategori Berdasarkan Grup Kantor / Lokasi
  allParentGroups.forEach((grp) => {
    const grpDevs = candidateParents.filter((p) => (p.grup || 'Umum') === grp);
    if (grpDevs.length > 0) {
      parentOptionsHtml += `<optgroup label="🏢 Grup: ${grp} (${grpDevs.length} node)">`;
      grpDevs.forEach((p) => {
        const isSelected = device?.parent_id === p.id;
        const jLower = (p.jenis || '').toLowerCase();
        const pIcon = jLower === 'router' ? '🌐' : jLower === 'switch' ? '🔀' : jLower === 'server' ? '🖥️' : jLower.includes('ap') || jLower.includes('access') ? '📶' : jLower.includes('cctv') ? '📷' : '💻';
        const subLabel = getSubnetLabel(p.ip);
        parentOptionsHtml += `<option value="${p.id}" ${isSelected ? 'selected' : ''}>${pIcon} ${p.nama} (${p.ip}) • [${subLabel}] • ${p.jenis || 'Device'}</option>`;
      });
      parentOptionsHtml += `</optgroup>`;
    }
  });

  const currentJenis = (device?.jenis || '').toLowerCase();

  const { value: formData, isConfirmed } = await Swal.fire({
    title: isDuplicate ? `📋 Duplikat Device` : isEdit ? `✏️ Edit Device` : '➕ Tambah Device Baru',
    width: 660,
    html: `
      <!-- Datalist Autocomplete dari Database -->
      <datalist id="existing-groups-list">
        ${existingGroups.map((g) => `<option value="${g}">`).join('')}
      </datalist>
      <datalist id="existing-locations-list">
        ${existingLocations.map((loc) => `<option value="${loc}">`).join('')}
      </datalist>

      <div style="text-align:left; display:flex; flex-direction:column; gap:12px; padding:4px 0;">
        <div class="form-grid">
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Nama Device <span class="required">*</span></label>
            <input type="text" id="sf-nama" class="form-control" placeholder="Router Utama Lantai 1 / CCTV Lobby" value="${defaultNama}" autocomplete="off" />
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
            <input type="text" id="sf-grup" list="existing-groups-list" class="form-control" placeholder="Ketik atau pilih grup..." value="${device?.grup || ''}" autocomplete="off" />
          </div>

          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Hostname (opsional / RFC 1123)</label>
            <input type="text" id="sf-hostname" class="form-control" placeholder="ROUTER-MAIN-01" value="${device?.hostname || ''}" autocomplete="off" />
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
      const namaInput = document.getElementById('sf-nama');
      const hostnameInput = document.getElementById('sf-hostname');
      const metodeSelect = document.getElementById('sf-metode');
      const portInput = document.getElementById('sf-port');
      const parentSelect = document.getElementById('sf-parent');
      const hintBox = document.getElementById('subnet-hint-box');

      // Auto-fill format Hostname (RFC 1123) saat mengetik nama device
      let isHostnameManual = !!(device?.hostname);
      hostnameInput?.addEventListener('input', () => {
        isHostnameManual = hostnameInput.value.trim().length > 0;
      });

      namaInput?.addEventListener('input', () => {
        if (!isHostnameManual) {
          const raw = namaInput.value.toUpperCase();
          const slug = raw
            .replace(/[^A-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 32);
          if (hostnameInput) hostnameInput.value = slug;
        }
      });

      const checkSubnet = () => {
        const currentIp = cleanDeviceIp(ipInput.value.trim());
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
        const parentCleanIp = cleanDeviceIp(parentDev.ip);
        const curParts = currentIp.split('.');
        const parentParts = parentCleanIp.split('.');
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
    preConfirm: async () => {
      const nama = document.getElementById('sf-nama').value.trim();
      const ip = document.getElementById('sf-ip').value.trim();
      const grup = document.getElementById('sf-grup').value.trim();

      if (!nama) { Swal.showValidationMessage('Nama device wajib diisi!'); return false; }
      if (!ip) { Swal.showValidationMessage('IP Address wajib diisi!'); return false; }
      if (!grup) { Swal.showValidationMessage('Grup / Lokasi device wajib diisi!'); return false; }

      const parentVal = document.getElementById('sf-parent').value;
      const payload = {
        nama,
        ip,
        jenis: document.getElementById('sf-jenis').value,
        parent_id: parentVal ? parseInt(parentVal, 10) : null,
        metode: document.getElementById('sf-metode').value,
        port: document.getElementById('sf-port').value ? parseInt(document.getElementById('sf-port').value, 10) : null,
        interval: parseInt(document.getElementById('sf-interval').value, 10) || 60,
        grup,
        hostname: document.getElementById('sf-hostname').value.trim() || null,
        deskripsi: document.getElementById('sf-deskripsi').value.trim(),
        lokasi: grup,
        active: true,
        credHikvision: null,
      };

      try {
        if (isEdit) {
          const res = await apiUpdateDevice(device.id, payload);
          return { isEdit: true, id: device.id, payload, res };
        } else {
          const res = await apiCreateDevice(payload);
          return { isEdit: false, id: res.data?.id || res.id, payload, res };
        }
      } catch (err) {
        Swal.showValidationMessage(err.message || 'Gagal menyimpan perangkat ke server.');
        return false;
      }
    },
  });

  if (isConfirmed && formData) {
    await syncDevicesFromApi();
    onSave?.();

    if (formData.isEdit) {
      Swal.fire({
        icon: 'success',
        title: 'Device Diperbarui',
        timer: 1500,
        showConfirmButton: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    } else {
      // Auto-Ping Perangkat Baru yang baru saja ditambahkan
      const newId = formData.id;
      Swal.fire({
        title: '📡 Menguji Koneksi Otomatis...',
        html: `<div style="text-align:center; padding:8px;">
          <div style="font-size:0.9rem; color:#94a3b8;">Perangkat <b>${formData.payload.nama}</b> berhasil disimpan.<br>Mengirim probe awal ke <code>${formData.payload.ip}</code>...</div>
        </div>`,
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });

      try {
        const pingRes = newId ? await apiPingDevice(newId) : null;
        await syncDevicesFromApi();
        onSave?.();

        const pingData = pingRes?.data || pingRes || {};
        const isOnline = Boolean(pingData.alive || pingData.status === 'online');
        const ms = pingData.responseTime ?? pingData.time;

        Swal.fire({
          icon: isOnline ? 'success' : 'warning',
          title: isOnline ? '✅ Device Berhasil Ditambahkan & Online!' : '⚠️ Device Ditambahkan (Offline / Belum Terjangkau)',
          html: `
            <div style="text-align:center; padding:6px;">
              <div style="font-size:1rem; font-weight:700; color:#f1f5f9; margin-bottom:8px;">${formData.payload.nama}</div>
              <div style="display:inline-block; padding:8px 18px; border-radius:8px; background:${isOnline ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; border:1px solid ${isOnline ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}; margin-bottom:12px;">
                <div style="font-size:1.8rem; font-weight:800; color:${isOnline ? '#4ade80' : '#f87171'};">
                  ${isOnline ? (ms !== null && ms !== undefined ? `${ms} ms` : 'Online') : 'Timeout / Offline'}
                </div>
                <div style="font-size:0.75rem; color:#94a3b8;">${isOnline ? 'Probe Awal Berhasil' : (pingData.statusText || 'Host Unreachable')}</div>
              </div>
              <div style="font-size:0.8rem; color:#94a3b8;">
                Perangkat telah tercatat di basis data dan pemantauan aktif berkala telah dimulai.
              </div>
            </div>
          `,
          confirmButtonText: 'Selesai',
          confirmButtonColor: '#6366f1',
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      } catch {
        Swal.fire({
          icon: 'success',
          title: 'Device Ditambahkan',
          text: `${formData.payload.nama} berhasil disimpan ke database.`,
          timer: 2000,
          showConfirmButton: false,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      }
    }
  }
}

export function parseDeviceJenis(val) {
  if (!val) return 'Komputer';
  const low = String(val).trim().toLowerCase();
  if (low.includes('cctv') || low.includes('hikvision') || low.includes('camera') || low.includes('kamera')) return 'CCTV Hikvision';
  if (low.includes('router') || low.includes('gateway') || low.includes('mikrotik')) return 'Router';
  if (low.includes('switch') || low.includes('hub') || low.includes('sw vlan') || low.includes('bridge')) return 'Switch';
  if (low.includes('access point') || low.includes('ap ') || low.endsWith(' ap') || low === 'ap' || low.includes('wifi') || low.includes('wi-fi') || low.includes('wireless')) return 'Access Point';
  if (low.includes('server') || low.includes('srv')) return 'Server';
  return 'Komputer';
}

function exportCSV() {
  const headers = [
    'ID',
    'Nama',
    'IP Address',
    'Hostname',
    'Jenis',
    'Metode',
    'Port',
    'Interval (Detik)',
    'Grup',
    'Lokasi',
    'Terhubung Ke',
    'Parent ID',
    'Deskripsi',
    'Status',
  ];

  const rows = mockDevices.map((d) => {
    const parentDev = d.parent_id ? mockDevices.find((p) => p.id === d.parent_id) : null;
    const parentDesc = parentDev ? `${parentDev.nama} [${parentDev.ip}]` : '';
    return [
      d.id,
      d.nama,
      d.ip,
      d.hostname || '',
      d.jenis,
      d.metode,
      d.port || '',
      d.interval_detik || d.interval || 60,
      d.grup || 'Umum',
      d.lokasi || 'Kantor',
      parentDesc,
      d.parent_id || '',
      d.deskripsi || '',
      d.status || 'offline',
    ];
  });

  const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
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
    text: `${rows.length} perangkat diekspor lengkap dengan hierarki uplink.`,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    background: '#1a1d2e',
    color: '#e2e8f0',
  });
}

function downloadCsvTemplate() {
  const headers = [
    'Nama',
    'IP Address',
    'Hostname',
    'Jenis',
    'Metode',
    'Port',
    'Interval (Detik)',
    'Grup',
    'Lokasi',
    'Terhubung Ke',
    'Deskripsi',
  ];
  const samples = [
    ['Router Gateway Utama', '192.168.1.1', 'gw-core', 'Router', 'PING', '', '60', 'Network Core', 'Ruang Server Lt. 1', '', 'Core Gateway Mikrotik CCR'],
    ['Switch Core Distribution', '192.168.1.2', 'sw-dist-01', 'Switch', 'PING', '', '60', 'Network Core', 'Rack Server A', 'Router Gateway Utama [192.168.1.1]', 'Manageable L3 Switch Cisco'],
    ['Switch Lantai 2', '192.168.1.3', 'sw-lt2', 'Switch', 'PING', '', '60', 'Infrastruktur', 'IDF Lt. 2', 'Switch Core Distribution [192.168.1.2]', 'Switch Akses Ruang Operasional'],
    ['AP Kantor Utama', '192.168.1.50', 'ap-kantor-01', 'Access Point', 'PING', '', '60', 'Wireless', 'Lobby Lt. 1', 'Switch Core Distribution [192.168.1.2]', 'UniFi AP U6 Pro'],
    ['Server Database PostgreSQL', '192.168.1.10', 'srv-db-prod', 'Server', 'PING', '', '30', 'Server Room', 'Rack Server B', 'Switch Core Distribution [192.168.1.2]', 'Database Server Ubuntu 24.04'],
    ['PC Kasir 01', '192.168.1.101', 'pc-kasir-01', 'Komputer', 'PING', '', '60', 'Kasir', 'Lantai 1', 'Switch Core Distribution [192.168.1.2]', 'PC Kasir Utama Dell Optiplex'],
    ['CCTV Lobby Lantai 1', '192.168.1.150', 'cctv-lobby', 'CCTV Hikvision', 'ISAPI', '80', '60', 'Keamanan', 'Lobby Lt. 1', 'Switch Core Distribution [192.168.1.2]', 'Kamera Hikvision Dome DS-2CD2143G0'],
    ['CCTV Area Parkir', '192.168.1.151', 'cctv-parkir', 'CCTV Hikvision', 'RTSP', '554', '60', 'Keamanan', 'Parkir Belakang', 'Switch Lantai 2 [192.168.1.3]', 'Kamera outdoor RTSP Bullet'],
  ];

  const csvRows = [headers, ...samples].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
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
  const { isConfirmed, value: formData } = await Swal.fire({
    title: '📂 Import Device dari CSV',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:8px; padding:10px 14px;">
          <div>
            <div style="font-weight:600; font-size:0.85rem; color:var(--color-heading);">Format CSV Lengkap & Presisi</div>
            <div style="font-size:0.75rem; color:var(--color-muted);">Mendukung jenis perangkat, hierarki uplink, hostname, metode, dan interval.</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-download-csv-template" style="padding:5px 12px; font-size:0.78rem; white-space:nowrap;">
            📥 Unduh Template
          </button>
        </div>

        <div class="csv-drop-zone" id="csv-drop-zone">
          <input type="file" id="csv-file-input" accept=".csv" />
          <div class="csv-drop-icon">📂</div>
          <div style="font-weight:600; color:var(--color-text-secondary);">Klik atau drag & drop file CSV di sini</div>
          <div style="font-size:0.78rem; color:var(--color-muted);">Mendukung koma/titik-koma, auto-detect kolom fleksibel</div>
        </div>

        <!-- Opsi Strategi Duplikasi -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px 14px;">
          <div style="font-weight:600; font-size:0.82rem; color:var(--color-heading); margin-bottom:6px;">
            Strategi Impor Jika Device Sudah Ada (IP / Nama sama):
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; font-size:0.8rem; color:#cbd5e1;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="csv-import-mode" value="replace" checked style="accent-color:#6366f1;" />
              <span>🔄 <b>Perbarui yang Ada (Replace)</b> - Update informasi perangkat tanpa membuat duplikat</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="csv-import-mode" value="duplicate" style="accent-color:#6366f1;" />
              <span>📋 <b>Buat Duplikat Baru (Duplicate)</b> - Simpan sebagai entri terpisah</span>
            </label>
          </div>
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
    width: 720,
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
    preConfirm: () => {
      const mode = document.querySelector('input[name="csv-import-mode"]:checked')?.value || 'replace';
      return { mode };
    },
  });

  if (isConfirmed && parsedCsvDevices.length > 0) {
    const mode = (formData && formData.mode) || 'replace';
    try {
      const res = await apiImportCsv(parsedCsvDevices, mode);
      await syncDevicesFromApi();
      onSave?.();
      Swal.fire({
        icon: 'success',
        title: 'Import CSV Berhasil',
        html: `
          <div style="font-size:0.85rem; color:#94a3b8;">
            <p>${res.message || 'Data CSV berhasil diproses.'}</p>
            <div style="margin-top:10px; display:inline-block; text-align:left; font-size:0.8rem; background:rgba(255,255,255,0.05); padding:8px 14px; border-radius:6px;">
              <div>• Perangkat Baru: <b style="color:#10b981;">${res.imported || 0}</b></div>
              <div>• Perangkat Diperbarui: <b style="color:#6366f1;">${res.updated || 0}</b></div>
              ${res.skipped > 0 ? `<div>• Baris Dilewati: <b style="color:#f59e0b;">${res.skipped}</b></div>` : ''}
            </div>
          </div>
        `,
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
        const jenisRaw = getVal('jenis', 'type', 'kategori');
        const jenis = parseDeviceJenis(jenisRaw);

        const metodeRaw = getVal('metode', 'method', 'protocol') || 'PING';
        const metodeUp = metodeRaw.toUpperCase();
        const metode = ['PING', 'ISAPI', 'RTSP', 'ONVIF'].includes(metodeUp) ? metodeUp : 'PING';

        const portRaw = getVal('port', 'tcp_port');
        const port = portRaw ? parseInt(portRaw, 10) || null : (metode === 'RTSP' ? 554 : metode === 'ISAPI' ? 80 : null);
        const intervalRaw = getVal('interval', 'interval_detik', 'interval (detik)', 'polling');
        const interval_detik = Math.max(10, Math.min(3600, parseInt(intervalRaw, 10) || 60));
        const grup = getVal('grup', 'group', 'kelompok') || 'Umum';
        const lokasi = getVal('lokasi', 'location', 'ruang', 'lantai') || 'Kantor';
        const terhubung_ke = getVal('terhubung ke', 'terhubung_ke', 'parent', 'uplink', 'parent_nama', 'parent_ip') || '';
        const parent_id_raw = getVal('parent_id', 'parent id');
        const parent_id = parent_id_raw && !isNaN(parseInt(parent_id_raw, 10)) ? parseInt(parent_id_raw, 10) : null;
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
          terhubung_ke,
          parent_id,
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
                <th>Perangkat</th>
                <th>IP Address</th>
                <th>Jenis</th>
                <th>Metode</th>
                <th>Terhubung Ke</th>
                <th>Grup / Lokasi</th>
              </tr>
            </thead>
            <tbody>
              ${parsedCsvDevices.slice(0, 8).map((d) => `
                <tr>
                  <td>
                    <b>${d.nama}</b>
                    ${d.hostname ? `<div style="font-size:0.7rem; color:var(--color-muted);">${d.hostname}</div>` : ''}
                  </td>
                  <td><code>${d.ip}</code></td>
                  <td><span class="chip">${d.jenis}</span></td>
                  <td><span class="chip">${d.metode}${d.port ? `:${d.port}` : ''}</span></td>
                  <td>
                    ${d.terhubung_ke ? `<span style="font-size:0.75rem; color:var(--color-accent); font-weight:600;">↳ ${d.terhubung_ke}</span>` : '<span style="color:var(--color-muted);">- (Root)</span>'}
                  </td>
                  <td>${d.grup} / ${d.lokasi}</td>
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

