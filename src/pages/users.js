// ================================================================
// DevWatch - users.js
// Manajemen pengguna: CRUD, role, avatar upload/kompresi, Admin only
// ================================================================

import Swal from 'sweetalert2';
import { apiGetUsers, apiCreateUser, apiUpdateUser, apiDeleteUser, apiResetPassword } from '../api.js';
import { getSession, setSession } from '../main.js';
import { formatDateWithTz } from '../settingsManager.js';
import { compressAvatarBy70Percent, updateTopbarAndSidebarAvatars } from '../components/topbar.js';

let userSearchTerm = '';
let liveUsers = [];

export async function fetchLiveUsers() {
  try {
    const res = await apiGetUsers();
    if (res && res.data && Array.isArray(res.data)) {
      liveUsers = res.data.map((u) => {
        const initials = (u.nama || 'U').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
        return {
          id: u.id,
          nama: u.nama,
          username: u.username || (u.email ? u.email.split('@')[0] : 'user'),
          email: u.email,
          role: u.role,
          status: u.status || 'aktif',
          avatar: u.avatar && u.avatar.trim() ? u.avatar.trim() : initials,
          lastLogin: u.last_login,
          ipAkses: '127.0.0.1',
          createdAt: u.created_at,
          notifSettings: { devices: [], enabled: false },
        };
      });
    }
  } catch {
    // Tangani error jaringan
  }
}

function getUsersList() {
  return liveUsers;
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
          <p class="page-subtitle">Kelola akun, hak akses login, dan foto profil pengguna sistem</p>
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
            <div class="stat-value" id="user-stat-total">${list.length}</div>
            <div class="stat-label">Total Pengguna</div>
          </div>
        </div>
        <div class="stat-card online-stat">
          <div class="stat-icon online-stat">✅</div>
          <div class="stat-info">
            <div class="stat-value text-online" id="user-stat-aktif">${list.filter((u) => u.status === 'aktif').length}</div>
            <div class="stat-label">Akun Aktif</div>
          </div>
        </div>
        <div class="stat-card offline-stat">
          <div class="stat-icon offline-stat">⛔</div>
          <div class="stat-info">
            <div class="stat-value text-offline" id="user-stat-nonaktif">${list.filter((u) => u.status === 'nonaktif').length}</div>
            <div class="stat-label">Akun Nonaktif</div>
          </div>
        </div>
      </div>

      <!-- Filter -->
      <div class="card" style="padding:12px 16px; margin-bottom:16px;">
        <div class="filter-bar">
          <div class="search-input-wrapper" style="flex:1; min-width:200px; max-width:320px;">
            <span class="search-icon">🔍</span>
            <input type="text" class="form-control" id="user-search" placeholder="Cari nama, username, email..." />
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
    users = users.filter((u) => 
      u.nama.toLowerCase().includes(q) || 
      (u.username && u.username.toLowerCase().includes(q)) || 
      u.email.toLowerCase().includes(q)
    );
  }
  if (filterRole !== 'all') users = users.filter((u) => u.role === filterRole);
  if (filterStatus !== 'all') users = users.filter((u) => u.status === filterStatus);

  const session = getSession();

  const rows = users.map((u) => {
    const hasPhoto = u.avatar && (u.avatar.startsWith('data:image') || u.avatar.startsWith('http') || u.avatar.startsWith('/'));
    const avatarHtml = hasPhoto
      ? `<img src="${u.avatar}" alt="${u.nama}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
      : `<span style="font-size:0.8rem; font-weight:700; color:#ffffff;">${u.avatar}</span>`;

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="user-avatar-sm" style="width:36px; height:36px; min-width:36px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:var(--color-surface, #1e2238); border:1px solid rgba(255,255,255,0.12);">
              ${avatarHtml}
            </div>
            <div>
              <div style="font-weight:600; color:var(--color-heading); display:flex; align-items:center; gap:6px;">
                <span>${u.nama}</span>
                <span class="chip" style="font-size:0.7rem; font-family:var(--font-mono); color:var(--color-accent); padding:1px 6px;">@${u.username}</span>
              </div>
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
          ${formatDateWithTz(u.lastLogin)}
        </td>
        <td><span class="ip-text">${u.ipAkses || '-'}</span></td>
        <td>
          <div class="action-group">
            <button class="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Edit Profil & Foto" onclick="window.editUserBtn(${u.id})">✏️</button>
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
    `;
  }).join('') || `
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
    const list = getUsersList();
    const elTotal = document.getElementById('user-stat-total');
    const elAktif = document.getElementById('user-stat-aktif');
    const elNonaktif = document.getElementById('user-stat-nonaktif');
    if (elTotal) elTotal.textContent = list.length;
    if (elAktif) elAktif.textContent = list.filter((u) => u.status === 'aktif').length;
    if (elNonaktif) elNonaktif.textContent = list.filter((u) => u.status === 'nonaktif').length;
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
      html: `${newStatus === 'nonaktif' ? 'Akun' : 'Aktifkan akun'} <b>${user.nama}</b> (@${user.username}) akan ${newStatus === 'nonaktif' ? 'dinonaktifkan' : 'diaktifkan'}.`,
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
        await apiUpdateUser(id, { status: newStatus });
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
      inputLabel: `Password baru untuk ${user.nama} (@${user.username})`,
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
      html: `Yakin ingin menghapus akun <b>${user.nama}</b> (@${user.username})? Aksi ini tidak bisa dibatalkan.`,
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
  let currentAvatarData = user?.avatar || '';

  const getPreviewAvatarHtml = (avatarVal, nameVal) => {
    if (avatarVal && (avatarVal.startsWith('data:image') || avatarVal.startsWith('http') || avatarVal.startsWith('/'))) {
      return `<img src="${avatarVal}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
    }
    const initials = (nameVal || 'U').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    return `<span style="font-size:1.8rem; font-weight:700; color:#ffffff; user-select:none;">${avatarVal || initials}</span>`;
  };

  const { value: formData, isConfirmed } = await Swal.fire({
    title: isEdit ? '✏️ Edit Pengguna' : '➕ Tambah Pengguna Baru',
    width: 560,
    background: '#1a1d2e',
    color: '#e2e8f0',
    showCancelButton: true,
    confirmButtonText: isEdit ? '💾 Simpan Perubahan' : '➕ Tambah Pengguna',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#6366f1',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:14px; padding:4px 0;">
        <!-- Avatar Photo Editor -->
        <div style="display:flex; align-items:center; gap:16px; padding:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px;">
          <div id="uf-avatar-preview" style="width:68px; height:68px; min-width:68px; border-radius:50%; overflow:hidden; background:linear-gradient(135deg, #4f46e5, #7c3aed); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.3); border:2px solid rgba(255,255,255,0.15);">
            ${getPreviewAvatarHtml(currentAvatarData, user?.nama)}
          </div>
          <div style="flex:1;">
            <div style="font-size:0.85rem; font-weight:700; color:var(--color-heading); margin-bottom:4px;">Foto Profil Pengguna</div>
            <div style="font-size:0.75rem; color:var(--color-muted); margin-bottom:8px;">Format JPG/PNG, otomatis dikompresi efisien (<50KB)</div>
            <div style="display:flex; gap:8px; align-items:center;">
              <label for="uf-avatar-file" class="btn btn-secondary btn-xs" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; padding:4px 10px;">
                📷 Ganti Foto
              </label>
              <input type="file" id="uf-avatar-file" accept="image/*" style="display:none;" />
              <button type="button" id="uf-avatar-remove-btn" class="btn btn-ghost btn-xs" style="font-size:0.75rem; color:#ef4444; padding:4px 8px;">
                🗑️ Reset
              </button>
            </div>
            <div id="uf-avatar-status" style="display:none; font-size:0.72rem; color:#a5b4fc; margin-top:6px;"></div>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Nama Lengkap <span class="required">*</span></label>
            <input type="text" id="uf-nama" class="form-control" placeholder="Ahmad Rizky" value="${user?.nama || ''}" />
          </div>

          <div class="form-group">
            <label class="form-label">Username (ID Login) <span class="required">*</span></label>
            <input type="text" id="uf-username" class="form-control" placeholder="ahmad / teknisi01" value="${user?.username || ''}" />
          </div>

          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Email Kantor <span class="required">*</span></label>
            <input type="email" id="uf-email" class="form-control" placeholder="email@kantor.com" value="${user?.email || ''}" />
            <span style="font-size:0.7rem; color:var(--color-muted); margin-top:3px; display:block;">Email dicadangkan untuk verifikasi dan fitur lupa password.</span>
          </div>

          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Role Akses <span class="required">*</span></label>
            <select id="uf-role" class="form-control">
              <option value="viewer" ${user?.role === 'viewer' ? 'selected' : ''}>Viewer (Hanya Melihat Status & Dashboard)</option>
              <option value="teknisi" ${user?.role === 'teknisi' ? 'selected' : ''}>Teknisi (Dapat Ping, Set Maintenance, & Konfigurasi)</option>
              <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrator (Akses Penuh Seluruh Sistem)</option>
            </select>
          </div>

          ${!isEdit ? `
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Password <span class="required">*</span></label>
            <input type="password" id="uf-password" class="form-control" placeholder="Minimal 8 karakter" />
          </div>` : ''}
        </div>
      </div>
    `,
    didOpen: () => {
      const fileInput = document.getElementById('uf-avatar-file');
      const previewEl = document.getElementById('uf-avatar-preview');
      const removeBtn = document.getElementById('uf-avatar-remove-btn');
      const statusEl = document.getElementById('uf-avatar-status');

      fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:1.5px;display:inline-block;vertical-align:middle;margin-right:4px;"></span> Mengompresi foto...';
          }

          const { dataUrl, originalSize, compressedSize, reductionPercent } = await compressAvatarBy70Percent(file);
          currentAvatarData = dataUrl;

          if (previewEl) {
            previewEl.innerHTML = `<img src="${dataUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
          }

          if (statusEl) {
            const origKb = Math.round(originalSize / 1024);
            const compKb = Math.round(compressedSize / 1024);
            statusEl.innerHTML = `✅ Terkompresi: <b>${compKb} KB</b> (hemat ${reductionPercent}%)`;
          }
        } catch (err) {
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#ef4444';
            statusEl.innerText = `Gagal memproses gambar: ${err.message}`;
          }
        }
      });

      removeBtn?.addEventListener('click', () => {
        const nameVal = document.getElementById('uf-nama')?.value || '';
        const initials = nameVal.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
        currentAvatarData = initials;

        if (previewEl) {
          previewEl.innerHTML = `<span style="font-size:1.8rem; font-weight:700; color:#ffffff; user-select:none;">${initials}</span>`;
        }

        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.style.color = '#94a3b8';
          statusEl.innerText = 'Foto profil direset ke inisial nama default.';
        }
      });
    },
    preConfirm: () => {
      const nama = document.getElementById('uf-nama').value.trim();
      const username = document.getElementById('uf-username').value.trim();
      const email = document.getElementById('uf-email').value.trim();
      const role = document.getElementById('uf-role').value;
      const password = document.getElementById('uf-password')?.value;

      if (!nama) { Swal.showValidationMessage('Nama lengkap wajib diisi!'); return false; }
      if (!username) { Swal.showValidationMessage('Username wajib diisi untuk login!'); return false; }
      if (!email) { Swal.showValidationMessage('Email kantor wajib diisi!'); return false; }
      if (!isEdit && (!password || password.length < 8)) { Swal.showValidationMessage('Password minimal 8 karakter!'); return false; }

      return {
        nama,
        username,
        email,
        role,
        password,
        avatar: currentAvatarData,
      };
    },
  });

  if (isConfirmed && formData) {
    try {
      if (isEdit) {
        await apiUpdateUser(user.id, {
          nama: formData.nama,
          username: formData.username,
          email: formData.email,
          role: formData.role,
          avatar: formData.avatar,
        });

        // Sinkronkan navbar jika mengedit akun sendiri
        const session = getSession();
        if (session && session.id === user.id) {
          setSession({
            ...session,
            nama: formData.nama,
            username: formData.username,
            avatar: formData.avatar,
          });
          updateTopbarAndSidebarAvatars(formData.avatar);
        }
      } else {
        await apiCreateUser(formData);
      }

      Swal.fire({
        icon: 'success',
        title: isEdit ? 'Profil Diperbarui' : 'Pengguna Ditambahkan',
        html: `Akun <b>${formData.nama}</b> (@${formData.username}) berhasil disimpan.`,
        timer: 1800,
        showConfirmButton: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
      onSave?.();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan Pengguna', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    }
  }
}
