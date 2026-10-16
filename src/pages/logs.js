// ================================================================
// DevWatch — logs.js
// Log sistem: 3 tab, filter, color coding, pagination, export PDF
// ================================================================

import Swal from 'sweetalert2';
import { apiGetLogs } from '../api.js';
import { formatDateWithTz } from '../settingsManager.js';
import { exportLogsPdf } from '../services/pdfService.js';
import { getSession } from '../main.js';
import { getDemoLogs } from '../data/demoDevices.js';

let activeTab = 'status';
let logFilters = { search: '', dateFrom: '', dateTo: '', tipe: 'all', device: 'all', user: 'all' };
let logPage = 1;
let logRowsPerPage = 25;
let backendLogs = [];
let backendCounts = { status: 0, aktivitas: 0, konfigurasi: 0 };

export async function fetchLiveLogs() {
  const session = getSession();
  if (session?.is_preview) {
    if (activeTab === 'status') {
      backendLogs = getDemoLogs().map((r) => ({
        id: r.id,
        waktu: r.created_at,
        device: r.device_name || 'Device',
        ip: r.device_ip || '',
        deviceId: r.device_id,
        statusSebelum: r.status_sebelumnya?.toLowerCase() || 'online',
        statusBaru: r.status_baru?.toLowerCase() || 'offline',
        metode: r.metode || 'Probe',
        responseTime: r.response_time || 'OK',
        pesan: r.pesan_log,
        tipe: r.status_baru?.toLowerCase() || 'offline',
      }));
      backendCounts = { status: backendLogs.length, aktivitas: 2, konfigurasi: 2 };
    } else if (activeTab === 'aktivitas') {
      backendLogs = [
        {
          id: 1,
          waktu: new Date(Date.now() - 1800000).toISOString(),
          user: 'Guest Preview',
          email: 'preview@devwatch.demo',
          aksi: 'Mode Preview Masuk',
          detail: 'Eksplorasi antarmuka pemantauan demo',
          ip: '127.0.0.1',
          tipe: 'info',
          pesan: 'Guest Preview masuk ke sistem mode demo preview',
        },
        {
          id: 2,
          waktu: new Date(Date.now() - 3600000).toISOString(),
          user: 'Sistem Simulasi',
          email: 'system@devwatch.demo',
          aksi: 'Health Check Otomatis',
          detail: '20 perangkat sampel berhasil dimuat',
          ip: '127.0.0.1',
          tipe: 'info',
          pesan: 'Simulasi mendeteksi 16 Online, 2 Offline, 2 Maintenance',
        },
      ];
      backendCounts = { status: 5, aktivitas: 2, konfigurasi: 2 };
    } else {
      backendLogs = [
        {
          id: 1,
          waktu: new Date(Date.now() - 7200000).toISOString(),
          user: 'Budi Santoso',
          device: 'PC Gudang',
          parameter: 'Status Perangkat',
          nilaiLama: 'Online',
          nilaiBaru: 'Maintenance',
          tipe: 'maintenance',
          pesan: 'Budi Santoso mengubah status PC Gudang ke Maintenance (Penggantian RAM dan SSD)',
        },
        {
          id: 2,
          waktu: new Date(Date.now() - 10800000).toISOString(),
          user: 'Ahmad Rizky',
          device: 'CCTV Parkiran Belakang',
          parameter: 'Status Perangkat',
          nilaiLama: 'Online',
          nilaiBaru: 'Maintenance',
          tipe: 'maintenance',
          pesan: 'Ahmad Rizky mengatur CCTV Parkiran Belakang ke Maintenance (Pembersihan lensa)',
        },
      ];
      backendCounts = { status: 5, aktivitas: 2, konfigurasi: 2 };
    }
    return;
  }

  try {
    const res = await apiGetLogs({
      type: activeTab,
      search: logFilters.search,
      dateFrom: logFilters.dateFrom,
      dateTo: logFilters.dateTo,
      page: logPage,
      limit: logRowsPerPage,
    });
    if (res && res.data) {
      backendLogs = res.data.map((r) => {
        if (activeTab === 'status') {
          return {
            id: r.id,
            waktu: r.waktu,
            device: r.device_name || 'Device',
            ip: r.device_ip || '',
            deviceId: r.device_id,
            statusSebelum: r.status_lama || 'online',
            statusBaru: r.status_baru || 'offline',
            metode: 'Probe',
            responseTime: r.status_baru === 'online' ? 'OK' : 'Timeout',
            pesan: r.pesan_log,
            tipe: r.tipe_perubahan || r.status_baru,
          };
        } else if (activeTab === 'aktivitas') {
          return {
            id: r.id,
            waktu: r.waktu,
            user: r.user_nama || 'Pengguna',
            email: r.user_email || '',
            aksi: r.aksi || 'Aktivitas',
            detail: r.detail || '',
            ip: r.ip_address || '127.0.0.1',
            tipe: r.tipe || 'info',
            pesan: `${r.user_nama} (${r.user_email}) melakukan ${r.aksi}: ${r.detail || ''}`,
          };
        } else {
          return {
            id: r.id,
            waktu: r.waktu,
            user: r.user_nama || 'Admin',
            device: r.device_nama || 'Sistem',
            parameter: r.aksi || 'Konfigurasi',
            nilaiLama: r.nilai_lama || '-',
            nilaiBaru: r.nilai_baru || '-',
            tipe: 'maintenance',
            pesan: r.detail || `${r.user_nama} mengubah ${r.aksi} pada ${r.device_nama || 'sistem'}`,
          };
        }
      });
      if (res.counts) backendCounts = res.counts;
    }
  } catch {
    backendLogs = null;
  }
}

export function renderLogs() {
  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">📋 Log Sistem</h1>
          <p class="page-subtitle">Riwayat status device, aktivitas pengguna, dan perubahan konfigurasi</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="log-export-btn">📄 Export PDF</button>
          <button class="btn btn-secondary btn-sm" id="log-clear-filter-btn">✕ Reset Filter</button>
        </div>
      </div>

      <!-- Filter Panel -->
      <div class="log-filter-panel">
        <div class="form-group">
          <label class="form-label">Kata Kunci</label>
          <input type="text" class="form-control" id="log-search" placeholder="Cari dalam log..." value="${logFilters.search}" />
        </div>
        <div class="form-group">
          <label class="form-label">Dari Tanggal</label>
          <input type="date" class="form-control" id="log-date-from" value="${logFilters.dateFrom}" />
        </div>
        <div class="form-group">
          <label class="form-label">Sampai Tanggal</label>
          <input type="date" class="form-control" id="log-date-to" value="${logFilters.dateTo}" />
        </div>
        <div class="form-group">
          <label class="form-label">Tipe Log</label>
          <select class="form-control" id="log-filter-tipe">
            <option value="all">Semua Tipe</option>
            <option value="online">🟢 Online</option>
            <option value="offline">🔴 Offline</option>
            <option value="maintenance">🟡 Maintenance</option>
            <option value="warning">⚠️ Warning</option>
            <option value="info">ℹ️ Info</option>
          </select>
        </div>
        <div class="form-group" style="align-self:end;">
          <button class="btn btn-primary w-full" id="log-apply-filter-btn">🔍 Terapkan Filter</button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <div class="tabs-nav">
          <button class="tab-btn ${activeTab === 'status' ? 'active' : ''}" data-tab="status">
            🖥️ Log Status Device
            <span id="badge-count-status" style="
              background:rgba(239,68,68,0.2); color:var(--color-offline);
              font-size:0.65rem; padding:1px 6px; border-radius:10px; font-weight:700;
            ">${backendCounts.status}</span>
          </button>
          <button class="tab-btn ${activeTab === 'aktivitas' ? 'active' : ''}" data-tab="aktivitas">
            👤 Log Aktivitas User
            <span id="badge-count-aktivitas" style="
              background:rgba(99,102,241,0.15); color:var(--color-accent);
              font-size:0.65rem; padding:1px 6px; border-radius:10px; font-weight:700;
            ">${backendCounts.aktivitas}</span>
          </button>
          <button class="tab-btn ${activeTab === 'konfigurasi' ? 'active' : ''}" data-tab="konfigurasi">
            ⚙️ Log Perubahan Konfigurasi
            <span id="badge-count-konfigurasi" style="
              background:rgba(234,179,8,0.15); color:var(--color-maintenance);
              font-size:0.65rem; padding:1px 6px; border-radius:10px; font-weight:700;
            ">${backendCounts.konfigurasi}</span>
          </button>
        </div>
        <div style="
          background:var(--bg-card); border:1px solid var(--border-color);
          border-radius:0 var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg);
          padding:0; overflow:hidden;
        ">
          <div id="log-table-content">
            ${renderLogTable()}
          </div>
        </div>
      </div>
    </div>
  `;
}

function getActiveLogData() {
  return backendLogs || [];
}

function renderLogTable() {
  const data = getActiveLogData();
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / logRowsPerPage));
  logPage = Math.min(logPage, totalPages);
  const start = (logPage - 1) * logRowsPerPage;
  const paged = data.slice(start, start + logRowsPerPage);

  const getRowClass = (log) => {
    if (log.tipe === 'offline') return 'log-offline';
    if (log.tipe === 'online') return 'log-online';
    if (log.tipe === 'maintenance') return 'log-maintenance';
    if (log.tipe === 'warning') return 'log-offline';
    return '';
  };

  let tableHtml = '';

  if (activeTab === 'status') {
    tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Device</th>
            <th>Pesan Log</th>
            <th>Metode</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          ${paged.length === 0 ? `<tr><td colspan="5">${emptyLog()}</td></tr>` : paged.map((l) => `
            <tr class="${getRowClass(l)}">
              <td style="white-space:nowrap; font-size:0.78rem; color:var(--color-muted); font-family:var(--font-mono);">
                ${formatDateWithTz(l.waktu)}
              </td>
              <td>
                <div style="font-weight:600; color:var(--color-text);">${l.device}</div>
                <div class="ip-text" style="margin-top:2px;">${l.ip}</div>
              </td>
              <td class="log-entry-msg">${l.pesan}</td>
              <td><span class="chip">${l.metode}</span></td>
              <td>
                <span style="font-family:var(--font-mono); font-size:0.82rem; color:${l.responseTime === 'Timeout' ? 'var(--color-offline)' : 'var(--color-online)'};">
                  ${l.responseTime}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else if (activeTab === 'aktivitas') {
    tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Pengguna</th>
            <th>Aksi</th>
            <th>Pesan Log</th>
            <th>IP Akses</th>
          </tr>
        </thead>
        <tbody>
          ${paged.length === 0 ? `<tr><td colspan="5">${emptyLog()}</td></tr>` : paged.map((l) => `
            <tr class="${getRowClass(l)}">
              <td style="white-space:nowrap; font-size:0.78rem; color:var(--color-muted); font-family:var(--font-mono);">
                ${formatDateWithTz(l.waktu)}
              </td>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div class="user-avatar-sm">${l.user.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}</div>
                  <div>
                    <div style="font-weight:600; font-size:0.85rem; color:var(--color-text);">${l.user}</div>
                    <div style="font-size:0.75rem; color:var(--color-muted);">${l.email}</div>
                  </div>
                </div>
              </td>
              <td><span class="chip">${l.aksi}</span></td>
              <td class="log-entry-msg">${l.pesan}</td>
              <td><span class="ip-text">${l.ip}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Pengguna</th>
            <th>Aksi</th>
            <th>Device Terkait</th>
            <th>Pesan Log</th>
          </tr>
        </thead>
        <tbody>
          ${paged.length === 0 ? `<tr><td colspan="5">${emptyLog()}</td></tr>` : paged.map((l) => `
            <tr>
              <td style="white-space:nowrap; font-size:0.78rem; color:var(--color-muted); font-family:var(--font-mono);">
                ${formatDateWithTz(l.waktu)}
              </td>
              <td style="font-size:0.85rem; font-weight:600; color:var(--color-text);">${l.user}</td>
              <td><span class="chip">${l.aksi}</span></td>
              <td>${l.device ? `<span class="ip-text">${l.device}</span>` : '<span style="color:var(--color-muted);">Sistem</span>'}</td>
              <td class="log-entry-msg">${l.pesan}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border-color); flex-wrap:wrap; gap:8px;">
      <span class="text-sm text-muted">Menampilkan ${start + 1}–${Math.min(start + logRowsPerPage, total)} dari ${total} entri log</span>
      <div class="rows-per-page">
        Baris per halaman:
        <select id="log-rows-select">
          <option value="25" ${logRowsPerPage === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${logRowsPerPage === 50 ? 'selected' : ''}>50</option>
          <option value="100" ${logRowsPerPage === 100 ? 'selected' : ''}>100</option>
        </select>
      </div>
    </div>
    <div class="table-wrapper" style="border:none; border-radius:0;">
      ${tableHtml}
    </div>
    <div style="display:flex; justify-content:center; padding:16px;">
      ${renderPagination(logPage, totalPages)}
    </div>
  `;
}

function renderPagination(page, total) {
  if (total <= 1) return '';
  const pages = [];
  pages.push(`<button class="pagination-btn" onclick="window.logGoPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>◀</button>`);
  for (let i = Math.max(1, page - 2); i <= Math.min(total, page + 2); i++) {
    pages.push(`<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="window.logGoPage(${i})">${i}</button>`);
  }
  pages.push(`<button class="pagination-btn" onclick="window.logGoPage(${page + 1})" ${page === total ? 'disabled' : ''}>▶</button>`);
  return `<div class="pagination">${pages.join('')}</div>`;
}

function emptyLog() {
  return `<div class="empty-state" style="padding:24px;">
    <div class="empty-icon">📋</div>
    <div class="empty-title">Tidak ada log ditemukan</div>
    <div class="empty-desc">Coba ubah filter atau tab lain</div>
  </div>`;
}

export function initLogsEvents() {
  const refresh = async () => {
    await fetchLiveLogs();
    const content = document.getElementById('log-table-content');
    if (content) content.innerHTML = renderLogTable();
    bindLogRowsSelect();
  };

  fetchLiveLogs().then(() => {
    const content = document.getElementById('log-table-content');
    if (content) content.innerHTML = renderLogTable();
    bindLogRowsSelect();
  });

  // Tab switching
  document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      logPage = 1;
      refresh();
    });
  });

  // Apply filter
  document.getElementById('log-apply-filter-btn')?.addEventListener('click', () => {
    logFilters.search = document.getElementById('log-search')?.value || '';
    logFilters.dateFrom = document.getElementById('log-date-from')?.value || '';
    logFilters.dateTo = document.getElementById('log-date-to')?.value || '';
    logFilters.tipe = document.getElementById('log-filter-tipe')?.value || 'all';
    logPage = 1;
    refresh();
  });

  // Clear filter
  document.getElementById('log-clear-filter-btn')?.addEventListener('click', () => {
    logFilters = { search: '', dateFrom: '', dateTo: '', tipe: 'all', device: 'all', user: 'all' };
    document.getElementById('log-search').value = '';
    document.getElementById('log-date-from').value = '';
    document.getElementById('log-date-to').value = '';
    document.getElementById('log-filter-tipe').value = 'all';
    logPage = 1;
    refresh();
  });

  // Export PDF Riil
  document.getElementById('log-export-btn')?.addEventListener('click', async () => {
    const data = getActiveLogData();
    if (data.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Tidak Ada Log',
        text: 'Tidak ada baris log yang sesuai dengan kriteria filter aktif untuk diekspor.',
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title: '📄 Export Log ke PDF',
      html: `
        <div style="text-align:left; font-size:0.88rem; color:#94a3b8;">
          <p>Total entri yang akan diekspor: <b style="color:#f1f5f9;">${data.length} baris</b></p>
          <p style="margin-top:6px;">Kategori aktif: <b style="color:var(--color-accent);">${activeTab.toUpperCase()}</b></p>
          <p style="margin-top:6px; font-size:0.78rem; color:#64748b;">Kriteria pencarian dan rentang tanggal akan dicantumkan secara otomatis pada dokumen resmi PDF.</p>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '📥 Unduh PDF Sekarang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#374151',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });

    if (isConfirmed) {
      try {
        Swal.fire({
          title: 'Membuat Berkas PDF...',
          html: '<div style="text-align:center;"><div class="spinner spinner-lg" style="margin:0 auto;"></div><div style="margin-top:12px; font-size:0.85rem; color:#94a3b8;">Menyusun tabel log sistem...</div></div>',
          showConfirmButton: false,
          allowOutsideClick: false,
          background: '#1a1d2e',
          color: '#e2e8f0',
          timer: 600,
        });

        const filename = await exportLogsPdf(activeTab, data, logFilters);

        Swal.fire({
          icon: 'success',
          title: 'PDF Log Berhasil Diunduh',
          html: `<span style="font-size:0.85rem; color:#94a3b8;">Berkas <b>${filename}</b> (${data.length} baris) telah berhasil digenerate dan otomatis tersimpan.</span>`,
          confirmButtonColor: '#6366f1',
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Ekspor PDF', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  });

  bindLogRowsSelect();

  window.logGoPage = (p) => { logPage = p; refresh(); };
}

function bindLogRowsSelect() {
  document.getElementById('log-rows-select')?.addEventListener('change', (e) => {
    logRowsPerPage = parseInt(e.target.value);
    logPage = 1;
    const content = document.getElementById('log-table-content');
    if (content) content.innerHTML = renderLogTable();
    bindLogRowsSelect();
  });
}

