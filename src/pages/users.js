// ================================================================
// DevWatch — users.js
// Manajemen pengguna: CRUD, role, Admin only
// ================================================================

import Swal from 'sweetalert2';
import { mockUsers } from '../data/mock-users.js';
import { apiGetUsers, apiCreateUser, apiUpdateUser, apiDeleteUser, apiResetPassword } from '../api.js';
import { getSession } from '../main.js';

let userSearchTerm = '';
let liveUsers = null;

export async function fetchLiveUsers() {
  try {
    const res = await apiGetUsers();
    if (res && res.data) {
      liveUsers = res.data.map((u) => ({
        id: u.id,
        nama: u.nama,
        email: u.email,
        role: u.role,
        status: u.is_active === 1 ? 'aktif' : 'nonaktif',
        avatar: (u.nama || 'U').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
        lastLogin: u.last_login,
        ipAkses: '127.0.0.1',
        createdAt: u.created_at,
        notifSettings: { devices: [], enabled: false },
      }));
    }
  } catch {
    liveUsers = null;
  }
}

function getUsersList() {
  return liveUsers || mockUsers;
}

export function renderUsers() {
  const session = getSession();
  if (session?.role !== 'admin') {
    return `
      <div class="page-container fade-in-up">
        <div class="empty-state" style="padding:80px;">
          <div class="empty-icon">🔒</div>
          <div class="empty-title">Akses Ditolak</div>
          <div class="empty-desc">Halaman ini hanya dapat diakses oleh Admin</div>
        </div>
      </div>
    `;
  }

  const list = getUsersList();

  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">👥 Manajemen Pengguna</h1>
          <p class="page-subtitle">Kelola akun dan hak akses pengguna sistem</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="add-user-btn">➕ Tambah Pengguna</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:20px;">
        <div class="stat-card total">
          <div class="stat-icon total">👥</div>
          <div class="stat-info">
            <div class="stat-value">${list.length}</div>
            <div class="stat-label">Total Pengguna</div>
          </div>
        </div>
        <div class="stat-card online-stat">
          <div class="stat-icon online-stat">✅</div>
          <div class="stat-info">
            <div class="stat-value text-online">${list.filter((u) => u.status === 'aktif').length}</div>
            <div class="stat-label">Akun Aktif</div>
          </div>
        </div>
        <div class="stat-card offline-stat">
          <div class="stat-icon offline-stat">⛔</div>
          <div class="stat-info">
            <div class="stat-value text-offline">${list.filter((u) => u.status === 'nonaktif').length}</div>
            <div class="stat-label">Akun Nonaktif</div>
          </div>
        </div>
      </div>

      <!-- Filter -->
      <div class="card" style="padding:12px 16px; margin-bottom:16px;">
        <div class="filter-bar">
          <div class="search-input-wrapper" style="flex:1; min-width:200px; max-width:320px;">
            <span class="search-icon">🔍</span>
            <input type="text" class="form-control" id="user-search" placeholder="Cari nama atau email..." />
          </div>
          <select class="form-control" id="user-filter-role" style="width:auto;">
            <option value="all">Semua Role</option>
            <option value="admin">Administrator</option>
            <option value="teknisi">Teknisi</option>
            <option value="viewer">Viewer</option>
          </select>
          <select class="form-control" id="user-filter-status" style="width:auto;">
            <option value="all">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>
      </div>

      <!-- Table -->
      <div class="card" style="padding:0; overflow:visible;">
        <div id="users-table-wrapper">
          ${renderUsersTable()}
        </div>
      </div>
    </div>
  `;
}

function renderUsersTable(search = '', filterRole = 'all', filterStatus = 'all') {
  let users = [...getUsersList()];
  if (search) {
    const q = search.toLowerCase();
    users = users.filter((u) => u.nama.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }
  if (filterRole !== 'all') users = users.filter((u) => u.role === filterRole);
  if (filterStatus !== 'all') users = users.filter((u) => u.status === filterStatus);

  const session = getSession();

  const rows = users.map((u) => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="user-avatar-sm">${u.avatar}</div>
          <div>
            <div style="font-weight:600; color:var(--color-heading);">${u.nama}</div>
            <div style="font-size:0.75rem; color:var(--color-muted);">${u.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="role-chip ${u.role}">${u.role === 'admin' ? 'Administrator' : u.role === 'teknisi' ? 'Teknisi' : 'Viewer'}</span>
      </td>
      <td>
        <span class="badge ${u.status === 'aktif' ? 'badge-online' : 'badge-offline'}">
          ${u.status === 'aktif' ? '✅ Aktif' : '⛔ Nonaktif'}
        </span>
      </td>
      <td style="font-size:0.78rem; color:var(--color-muted);">
        ${u.lastLogin ? new Date(u.lastLogin).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}
      </td>
      <td><span class="ip-text">${u.ipAkses || '—'}</span></td>
      <td>
        <div class="action-group">
          <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Edit" onclick="window.editUserBtn(${u.id})">✏️</button>
          <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="${u.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}" onclick="window.toggleUserBtn(${u.id})">
            ${u.status === 'aktif' ? '⛔' : '✅'}
          </button>
          ${u.id !== session?.id ? `
          <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Reset Password" onclick="window.resetPasswordBtn(${u.id})">🔑</button>
          <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Hapus" onclick="window.deleteUserBtn(${u.id})" style="color:var(--color-offline);">🗑️</button>
          ` : `<span class="chip" style="font-size:0.7rem;">Anda</span>`}
        </div>
      </td>
    </tr>
  `).join('') || `
    <tr><td colspan="6">
      <div class="empty-state" style="padding:24px;">
        <div class="empty-icon">👥</div>
        <div class="empty-title">Tidak ada pengguna ditemukan</div>
      </div>
    </td></tr>
  `;

  return `
    <div class="table-wrapper" style="border:none; border-radius:0;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Pengguna</th>
            <th>Role</th>
            <th>Status</th>
            <th>Login Terakhir</th>
            <th>IP Terakhir</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function initUsersEvents() {
  const session = getSession();
  if (session?.role !== 'admin') return;

  let roleFilter = 'all';
  let statusFilter = 'all';

  const refresh = async () => {
    await fetchLiveUsers();
    const wrapper = document.getElementById('users-table-wrapper');
    if (wrapper) wrapper.innerHTML = renderUsersTable(userSearchTerm, roleFilter, statusFilter);
  };

  fetchLiveUsers().then(refresh);

  document.getElementById('user-search')?.addEventListener('input', (e) => {
    userSearchTerm = e.target.value;
    const wrapper = document.getElementById('users-table-wrapper');
    if (wrapper) wrapper.innerHTML = renderUsersTable(userSearchTerm, roleFilter, statusFilter);
  });
  document.getElementById('user-filter-role')?.addEventListener('change', (e) => {
    roleFilter = e.target.value;
    const wrapper = document.getElementById('users-table-wrapper');
    if (wrapper) wrapper.innerHTML = renderUsersTable(userSearchTerm, roleFilter, statusFilter);
  });
  document.getElementById('user-filter-status')?.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    const wrapper = document.getElementById('users-table-wrapper');
    if (wrapper) wrapper.innerHTML = renderUsersTable(userSearchTerm, roleFilter, statusFilter);
  });

  // Add user
  document.getElementById('add-user-btn')?.addEventListener('click', () => showUserForm(null, refresh));

  window.editUserBtn = (id) => {
    const user = getUsersList().find((u) => u.id === id);
    if (user) showUserForm(user, refresh);
  };

  window.toggleUserBtn = async (id) => {
    const user = getUsersList().find((u) => u.id === id);
    if (!user) return;
    const newStatus = user.status === 'aktif' ? 'nonaktif' : 'aktif';
    const result = await Swal.fire({
      title: newStatus === 'nonaktif' ? '⛔ Nonaktifkan Pengguna?' : '✅ Aktifkan Pengguna?',
      html: `${newStatus === 'nonaktif' ? 'Akun' : 'Aktifkan akun'} <b>${user.nama}</b> akan ${newStatus === 'nonaktif' ? 'dinonaktifkan' : 'diaktifkan'}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: newStatus === 'nonaktif' ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: newStatus === 'nonaktif' ? '#ef4444' : '#22c55e',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
    if (result.isConfirmed) {
      try {
        await apiUpdateUser(id, { isActive: newStatus === 'aktif' ? 1 : 0 });
        await refresh();
        Swal.fire({ icon: 'success', title: `Pengguna ${newStatus === 'aktif' ? 'Diaktifkan' : 'Dinonaktifkan'}`, timer: 1500, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Mengubah Status', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  };

  window.resetPasswordBtn = async (id) => {
    const user = getUsersList().find((u) => u.id === id);
    if (!user) return;
    const result = await Swal.fire({
      title: '🔑 Reset Password',
      input: 'password',
      inputLabel: `Password baru untuk ${user.nama}`,
      inputPlaceholder: 'Minimal 8 karakter',
      showCancelButton: true,
      confirmButtonText: '🔑 Reset Password',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      background: '#1a1d2e',
      color: '#e2e8f0',
      inputValidator: (val) => { if (!val || val.length < 8) return 'Password minimal 8 karakter!'; },
    });
    if (result.isConfirmed && result.value) {
      try {
        await apiResetPassword(id, result.value);
        Swal.fire({ icon: 'success', title: 'Password Berhasil Direset', text: `Password untuk ${user.nama} telah diperbarui.`, timer: 2000, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Reset Password', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  };

  window.deleteUserBtn = async (id) => {
    const user = getUsersList().find((u) => u.id === id);
    if (!user) return;
    const result = await Swal.fire({
      title: '🗑️ Hapus Pengguna?',
      html: `Yakin ingin menghapus akun <b>${user.nama}</b>? Aksi ini tidak bisa dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
    if (result.isConfirmed) {
      try {
        await apiDeleteUser(id);
        await refresh();
        Swal.fire({ icon: 'success', title: 'Pengguna Dihapus', timer: 1500, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Menghapus', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  };
}

async function showUserForm(user, onSave) {
  const isEdit = !!user;
  const { value: formData, isConfirmed } = await Swal.fire({
    title: isEdit ? '✏️ Edit Pengguna' : '➕ Tambah Pengguna',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Nama Lengkap <span class="required">*</span></label>
            <input type="text" id="uf-nama" class="form-control" placeholder="Ahmad Rizky" value="${user?.nama || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Email <span class="required">*</span></label>
            <input type="email" id="uf-email" class="form-control" placeholder="email@kantor.com" value="${user?.email || ''}" ${isEdit ? 'readonly' : ''} />
          </div>
          <div class="form-group">
            <label class="form-label">Role <span class="required">*</span></label>
            <select id="uf-role" class="form-control">
              <option value="viewer" ${user?.role === 'viewer' ? 'selected' : ''}>Viewer</option>
              <option value="teknisi" ${user?.role === 'teknisi' ? 'selected' : ''}>Teknisi</option>
              <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrator</option>
            </select>
          </div>
          ${!isEdit ? `
          <div class="form-group">
            <label class="form-label">Password <span class="required">*</span></label>
            <input type="password" id="uf-password" class="form-control" placeholder="Minimal 8 karakter" />
          </div>` : ''}
        </div>
      </div>
    `,
    width: 520,
    background: '#1a1d2e',
    color: '#e2e8f0',
    showCancelButton: true,
    confirmButtonText: isEdit ? '💾 Simpan' : '➕ Tambah',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#6366f1',
    preConfirm: () => {
      const nama = document.getElementById('uf-nama').value.trim();
      const email = document.getElementById('uf-email').value.trim();
      const role = document.getElementById('uf-role').value;
      const password = document.getElementById('uf-password')?.value;
      if (!nama) { Swal.showValidationMessage('Nama wajib diisi!'); return false; }
      if (!email) { Swal.showValidationMessage('Email wajib diisi!'); return false; }
      if (!isEdit && (!password || password.length < 8)) { Swal.showValidationMessage('Password minimal 8 karakter!'); return false; }
      return { nama, email, role, password };
    },
  });

  if (isConfirmed && formData) {
    try {
      if (isEdit) {
        await apiUpdateUser(user.id, { nama: formData.nama, role: formData.role });
      } else {
        await apiCreateUser(formData);
      }
      Swal.fire({ icon: 'success', title: isEdit ? 'Pengguna Diperbarui' : 'Pengguna Ditambahkan', timer: 1500, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
      onSave?.();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan Pengguna', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    }
  }
}
