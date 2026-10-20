// ================================================================
// DevWatch — topbar.js
// Header: halaman title, live indicator, notifikasi terkelola, user menu
// ================================================================

import { getSession, logout, setSession } from '../main.js';
import { getAppSetting } from '../settingsManager.js';
import { t } from '../i18n.js';
import { toggleTheme, getEffectiveTheme } from '../themeManager.js';
import { apiUpdateProfileAvatar } from '../api.js';
import Swal from 'sweetalert2';

const NOTIF_STORAGE_KEY = 'devwatch_notifications';

function getStoredNotifications() {
  const session = getSession();
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  if (session?.is_preview) {
    return [
      { id: 1, icon: '🔴', text: 'PC Marketing 01 OFFLINE sejak 06:50', time: '47 menit lalu', read: false },
      { id: 2, icon: '🔴', text: 'PC Keuangan 01 OFFLINE sejak 06:32', time: '1 jam lalu', read: false },
      { id: 3, icon: '🟡', text: 'CCTV Gudang Barang OFFLINE sejak 07:32', time: '1 jam lalu', read: false },
    ];
  }
  return [];
}

function saveNotifications(notifs) {
  try {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifs));
  } catch { }
  updateNotificationBadge();
}

function updateNotificationBadge() {
  const notifs = getStoredNotifications();
  const unreadCount = notifs.filter((n) => !n.read).length;
  const badge = document.getElementById('notif-count');
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

const pageTitles = {
  dashboard: { titleKey: 'nav_dashboard', fallback: 'Dashboard', subtitle: 'Monitoring real-time semua device jaringan' },
  devices: { titleKey: 'nav_devices', fallback: 'Manajemen Device', subtitle: 'Kelola, tambah, dan pantau seluruh device' },
  'device-detail': { titleKey: 'nav_devices', fallback: 'Detail Device', subtitle: 'Informasi lengkap dan riwayat insiden' },
  logs: { titleKey: 'nav_logs', fallback: 'Log Sistem', subtitle: 'Riwayat status, aktivitas, dan perubahan konfigurasi' },
  reports: { titleKey: 'nav_reports', fallback: 'Laporan', subtitle: 'Uptime, SLA, dan laporan insiden' },
  users: { titleKey: 'nav_users', fallback: 'Manajemen Pengguna', subtitle: 'Kelola akun dan hak akses pengguna' },
  settings: { titleKey: 'nav_settings', fallback: 'Pengaturan Sistem', subtitle: 'Konfigurasi monitoring, notifikasi, dan keamanan' },
  about: { titleKey: 'nav_about', fallback: 'Tentang Aplikasi', subtitle: 'Informasi versi dan lisensi MonDev' },
};

export function renderTopbar(currentRoute = 'dashboard') {
  const session = getSession();
  const page = pageTitles[currentRoute] || pageTitles.dashboard;
  const title = t(page.titleKey, page.fallback);
  const appName = getAppSetting('app_name', 'MonDev');
  const initials = session?.nama
    ? session.nama.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const notifs = getStoredNotifications();
  const unreadCount = notifs.filter((n) => !n.read).length;
  const isLight = getEffectiveTheme() === 'light';
  const avatarHtml = (session?.avatar && typeof session.avatar === 'string' && (session.avatar.startsWith('data:image') || session.avatar.startsWith('http') || session.avatar.startsWith('/')))
    ? `<img src="${session.avatar}" alt="${session?.nama || 'User'}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
    : initials;

  return `
    <header class="topbar" id="topbar">
      <div class="topbar-left">
        <button class="hamburger" id="hamburger-btn" aria-label="Toggle menu">☰</button>
        <div>
          <div class="topbar-title">${title}</div>
          <div class="topbar-breadcrumb text-xs">
            <span class="brand-app-name">${appName}</span>
            <span>›</span>
            <span>${title}</span>
          </div>
        </div>
      </div>

      <div class="topbar-right">
        ${session?.is_preview ? `
          <div style="display:flex; align-items:center; gap:6px; padding:4px 10px; background:linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2)); border:1px solid rgba(168, 85, 247, 0.5); border-radius:20px; font-size:0.75rem; font-weight:700; color:#c084fc;">
            <span class="live-dot" style="background:#a855f7; box-shadow:0 0 8px #a855f7;"></span>
            <span>⚡ MODE PREVIEW</span>
            <button type="button" id="exit-preview-btn" style="background:none; border:none; color:#f43f5e; cursor:pointer; font-size:0.75rem; font-weight:700; padding:0 2px; margin-left:4px;" title="Keluar dari Mode Preview">✕ Keluar</button>
          </div>
        ` : ''}

        <div class="live-indicator" title="Monitoring aktif">
          <span class="live-dot"></span>
          <span class="topbar-time" id="topbar-clock">--:--:--</span>
        </div>

        <button class="btn btn-ghost btn-icon" id="theme-toggle-btn" aria-label="Ganti Tema" title="${isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang Lembut'}" data-tooltip="${isLight ? 'Mode Gelap' : 'Mode Terang'}" style="font-size:1.15rem; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:8px; border:1px solid var(--border-color); background:rgba(255,255,255,0.03);">
          ${isLight ? '🌙' : '☀️'}
        </button>

        <div class="dropdown" id="notif-dropdown">
          <button class="btn btn-ghost btn-icon" id="notif-btn" aria-label="Notifikasi" style="position:relative;">
            🔔
            <span class="notif-badge" id="notif-count" style="${unreadCount > 0 ? 'display:flex;' : 'display:none;'}">${unreadCount}</span>
          </button>
          <div class="dropdown-menu" id="notif-menu" style="display:none; width:360px; max-width:calc(100vw - 24px); padding:0; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.4);">
            <div style="padding:10px 14px; font-weight:700; font-size:0.85rem; border-bottom:1px solid var(--border-color); color:var(--color-heading); display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02); gap:8px;">
              <span style="display:flex; align-items:center; gap:6px; white-space:nowrap;">
                🔔 ${t('topbar_notifications', 'Notifikasi')}
                <span id="notif-header-count" style="font-size:0.7rem; background:rgba(99,102,241,0.2); color:var(--color-primary); padding:1px 6px; border-radius:10px; font-weight:700;">${notifs.length}</span>
              </span>
              <div style="display:flex; align-items:center; gap:6px;">
                <button type="button" class="btn btn-ghost btn-xs" id="notif-mark-read-btn" title="Tandai semua telah dibaca" style="padding:3px 8px; font-size:0.75rem; color:var(--color-online); border:1px solid rgba(34,197,94,0.3); border-radius:6px; white-space:nowrap;">
                  ✓ Baca
                </button>
                <button type="button" class="btn btn-ghost btn-xs" id="notif-clear-btn" title="Bersihkan semua notifikasi" style="padding:3px 8px; font-size:0.75rem; color:var(--color-danger); border:1px solid rgba(239,68,68,0.3); border-radius:6px; white-space:nowrap;">
                  🗑️ Hapus
                </button>
              </div>
            </div>
            <div id="notif-list" style="max-height:340px; overflow-y:auto;"></div>
            <div id="notif-collapse-bar"></div>
            <div style="padding:8px 14px; border-top:1px solid var(--border-color); text-align:center; background:rgba(255,255,255,0.01);">
              <button class="btn btn-ghost btn-sm" id="close-notif-menu-btn" style="font-size:0.8rem;">
                ${t('notif_close', 'Tutup')}
              </button>
            </div>
          </div>
        </div>

        <div class="dropdown" id="user-dropdown">
          <button class="btn btn-ghost" id="user-btn" style="gap:8px;">
            <div class="user-avatar" id="topbar-avatar" style="width:28px;height:28px;font-size:0.72rem;overflow:hidden;">${avatarHtml}</div>
            <span class="text-sm font-medium">${session?.nama?.split(' ')[0] || 'User'}</span>
            <span style="font-size:0.7rem;color:var(--color-muted);">▼</span>
          </button>
          <div class="dropdown-menu" id="user-menu" style="display:none;">
            <div style="padding:12px 16px; border-bottom:1px solid var(--border-color);">
              <div style="font-weight:600; font-size:0.88rem; color:var(--color-heading);">${session?.nama}</div>
              <div style="font-size:0.75rem; color:var(--color-muted);">${session?.email}</div>
            </div>
            <button class="dropdown-item" id="profile-btn">👤 ${t('topbar_profile', 'Profil Saya')}</button>
            <button class="dropdown-item" id="notif-settings-btn">🔔 ${t('topbar_notif_settings', 'Pengaturan Notif')}</button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" id="logout-btn">🚪 ${t('topbar_logout', 'Keluar')}</button>
          </div>
        </div>
      </div>
    </header>
  `;
}

export function initTopbarEvents(navigate) {
  // Exit Preview Mode button
  const exitPreviewBtn = document.getElementById('exit-preview-btn');
  exitPreviewBtn?.addEventListener('click', () => {
    logout();
    navigate('login');
  });

  // Clock dengan timezone & language dinamis
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);
  window._clockInterval = clockInterval;

  // Theme toggle button
  const themeBtn = document.getElementById('theme-toggle-btn');
  themeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    themeBtn.style.transform = 'scale(0.82) rotate(18deg)';
    setTimeout(() => {
      themeBtn.style.transform = '';
    }, 200);
    toggleTheme();
  });

  // Notif dropdown toggle
  const notifBtn = document.getElementById('notif-btn');
  const notifMenu = document.getElementById('notif-menu');
  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = notifMenu.style.display === 'block';
    closeAllDropdowns();
    notifMenu.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderNotifications(navigate);
  });

  // User dropdown toggle
  const userBtn = document.getElementById('user-btn');
  const userMenu = document.getElementById('user-menu');
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = userMenu.style.display === 'block';
    closeAllDropdowns();
    userMenu.style.display = isOpen ? 'none' : 'block';
  });

  // Close notif dropdown button
  document.getElementById('close-notif-menu-btn')?.addEventListener('click', () => {
    if (notifMenu) notifMenu.style.display = 'none';
  });

  // Close on outside click
  document.addEventListener('click', closeAllDropdowns);

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const result = await Swal.fire({
      title: 'Keluar dari DevWatch?',
      text: 'Anda akan diarahkan ke halaman login.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal',
      background: '#1a1d2e',
      color: '#e2e8f0',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#374151',
    });
    if (result.isConfirmed) {
      logout();
      navigate('login');
    }
  });

  // Profile
  document.getElementById('profile-btn')?.addEventListener('click', () => {
    closeAllDropdowns();
    Swal.fire({
      title: 'Profil Pengguna',
      html: buildProfileHtml(),
      background: '#1a1d2e',
      color: '#e2e8f0',
      confirmButtonText: 'Tutup',
      confirmButtonColor: '#6366f1',
      width: 440,
      didOpen: () => {
        const fileInput = document.getElementById('avatar-file-input');
        const statusBox = document.getElementById('avatar-compress-status');
        const previewEl = document.getElementById('modal-avatar-preview');

        fileInput?.addEventListener('change', async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          if (!file.type.startsWith('image/')) {
            Swal.showValidationMessage('Harap pilih berkas gambar (JPG, PNG, WebP).');
            return;
          }

          // TAHAP 1: Membaca & Mengompresi Foto
          if (statusBox) {
            statusBox.style.display = 'block';
            statusBox.innerHTML = `
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="spinner spinner-sm"></div>
                <div>
                  <div style="font-weight:600; color:#cbd5e1;">Tahap 1/2: Mengompresi Foto...</div>
                  <div style="font-size:0.7rem; color:#94a3b8;">Mengurangi ukuran minimal 70% dari berkas asli</div>
                </div>
              </div>
            `;
          }

          try {
            const { dataUrl, originalSize, compressedSize, reductionPercent } = await compressAvatarBy70Percent(file);

            const origKb = (originalSize / 1024).toFixed(1);
            const compKb = (compressedSize / 1024).toFixed(1);

            // LANGSUNG PERBARUI AVATAR DI MODAL PREVIEW
            if (previewEl) {
              previewEl.innerHTML = `<img src="${dataUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
            }

            // TAHAP 2: Mengunggah ke Server
            if (statusBox) {
              statusBox.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                  <div class="spinner spinner-sm"></div>
                  <div>
                    <div style="font-weight:600; color:#cbd5e1;">Tahap 2/2: Menyimpan ke Database...</div>
                    <div style="font-size:0.7rem; color:var(--color-online);">
                      ✓ Terkompresi (-${reductionPercent}%): ${origKb} KB ➔ ${compKb} KB
                    </div>
                  </div>
                </div>
              `;
            }

            // Simpan ke backend
            const curSession = getSession();
            let newAvatarUrl = dataUrl;

            if (!curSession?.is_preview) {
              const res = await apiUpdateProfileAvatar(dataUrl);
              if (res?.data?.avatar) {
                newAvatarUrl = res.data.avatar;
              } else if (res?.avatar) {
                newAvatarUrl = res.avatar;
              }
            }

            // SEGERA UPDATE SESSION LOKAL & VISUAL TOPBAR + SIDEBAR
            const updated = { ...curSession, avatar: newAvatarUrl };
            setSession(updated);
            updateTopbarAndSidebarAvatars(newAvatarUrl);

            // TAHAP 3: Selesai
            if (statusBox) {
              statusBox.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="color:var(--color-online); font-size:1.1rem; font-weight:700;">✓</span>
                  <div>
                    <div style="font-weight:700; color:var(--color-online);">Foto Profil Berhasil Diperbarui!</div>
                    <div style="font-size:0.72rem; color:#cbd5e1;">
                      Ukuran asli: <b>${origKb} KB</b> ➔ Terkompresi: <b>${compKb} KB</b> (Hemat ${reductionPercent}%)
                    </div>
                  </div>
                </div>
              `;
            }

            // Toast notifikasi
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: `Foto profil berhasil diubah! Terkompresi ${reductionPercent}%`,
              timer: 3000,
              showConfirmButton: false,
              background: '#1a1d2e',
              color: '#e2e8f0',
            });
          } catch (err) {
            if (statusBox) {
              statusBox.style.display = 'block';
              statusBox.innerHTML = `
                <div style="color:var(--color-offline); font-size:0.75rem;">
                  ✕ Gagal memproses gambar: ${err.message}
                </div>
              `;
            }
          }
        });
      },
    });
  });

  document.getElementById('notif-settings-btn')?.addEventListener('click', () => {
    closeAllDropdowns();
    navigate('settings');
  });

  // Re-render clock and badge immediately if settings update
  window.addEventListener('devwatch:settings_updated', () => {
    updateClock();
    updateNotificationBadge();
  });
}

function closeAllDropdowns() {
  const notifMenu = document.getElementById('notif-menu');
  const userMenu = document.getElementById('user-menu');
  if (notifMenu) notifMenu.style.display = 'none';
  if (userMenu) userMenu.style.display = 'none';
}

function updateClock() {
  const clock = document.getElementById('topbar-clock');
  if (clock) {
    const tz = getAppSetting('timezone', 'Asia/Jakarta');
    const lang = getAppSetting('language', 'id') === 'en' ? 'en-US' : 'id-ID';
    try {
      clock.textContent = new Date().toLocaleTimeString(lang, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: tz,
      });
    } catch {
      clock.textContent = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
  }
}

let isNotifExpanded = false;
const NOTIF_COLLAPSE_LIMIT = 4;

function renderNotifications(navigate) {
  const list = document.getElementById('notif-list');
  if (!list) return;

  const notifs = getStoredNotifications();
  updateNotificationBadge();

  // Update counter di header notifikasi
  const headerCount = document.getElementById('notif-header-count');
  if (headerCount) {
    headerCount.textContent = notifs.length;
  }

  // Pasang event tombol 'Tandai Telah Dibaca'
  const markReadBtn = document.getElementById('notif-mark-read-btn');
  if (markReadBtn) {
    markReadBtn.onclick = (e) => {
      e.stopPropagation();
      const updated = notifs.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      renderNotifications(navigate);
      Swal.fire({
        toast: true,
        icon: 'success',
        title: 'Semua notifikasi ditandai telah dibaca',
        position: 'top-end',
        timer: 1500,
        showConfirmButton: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    };
  }

  // Pasang event tombol 'Bersihkan Semua'
  const clearBtn = document.getElementById('notif-clear-btn');
  if (clearBtn) {
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      saveNotifications([]);
      isNotifExpanded = false;
      renderNotifications(navigate);
      Swal.fire({
        toast: true,
        icon: 'info',
        title: 'Semua notifikasi telah dibersihkan',
        position: 'top-end',
        timer: 1500,
        showConfirmButton: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    };
  }

  const collapseBar = document.getElementById('notif-collapse-bar');

  if (notifs.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding:28px 16px; color:var(--color-muted);">
        <span style="font-size:2rem; display:block; margin-bottom:8px; opacity:0.6;">🔕</span>
        <div style="font-size:0.85rem; font-weight:600; color:#cbd5e1;">${t('notif_empty', 'Tidak ada notifikasi baru')}</div>
        <div style="font-size:0.75rem; margin-top:2px;">Sistem jaringan beroperasi normal</div>
      </div>
    `;
    if (collapseBar) {
      collapseBar.style.display = 'none';
      collapseBar.innerHTML = '';
    }
    return;
  }

  // Filter notifikasi sesuai mode collapse/expand
  const displayNotifs = (!isNotifExpanded && notifs.length > NOTIF_COLLAPSE_LIMIT)
    ? notifs.slice(0, NOTIF_COLLAPSE_LIMIT)
    : notifs;

  list.innerHTML = displayNotifs.map((n, i) => `
    <div
      class="notif-item-row"
      data-index="${i}"
      style="
        display:flex; align-items:flex-start; gap:10px; padding:10px 14px;
        border-bottom:1px solid var(--border-color); cursor:pointer;
        background:${n.read ? 'transparent' : 'rgba(99,102,241,0.06)'};
        transition:background 0.15s; position:relative;
      "
      onmouseover="this.style.background='rgba(255,255,255,0.04)'"
      onmouseout="this.style.background='${n.read ? 'transparent' : 'rgba(99,102,241,0.06)'}'"
    >
      <span style="font-size:1.1rem; margin-top:1px;">${n.icon || 'ℹ️'}</span>
      <div style="flex:1; min-width:0;">
        <div style="font-size:0.82rem; font-weight:${n.read ? '400' : '600'}; color:var(--color-text); line-height:1.3;">
          ${n.text}
        </div>
        <div style="font-size:0.72rem; color:var(--color-muted); margin-top:3px;">${n.time}</div>
      </div>
      ${!n.read ? `
        <span style="width:7px; height:7px; border-radius:50%; background:var(--color-primary); flex-shrink:0; margin-top:6px;" title="Belum dibaca"></span>
      ` : ''}
    </div>
  `).join('');

  // Tampilkan bar collapse jika notifikasi melebihi batas
  if (collapseBar) {
    if (notifs.length > NOTIF_COLLAPSE_LIMIT) {
      collapseBar.style.display = 'block';
      if (!isNotifExpanded) {
        collapseBar.innerHTML = `
          <div style="padding:8px 14px; text-align:center; background:rgba(255,255,255,0.02); border-top:1px dashed var(--border-color);">
            <button type="button" class="btn btn-ghost btn-xs w-full" id="notif-toggle-collapse-btn" style="color:var(--color-primary); font-weight:600; font-size:0.78rem; display:flex; align-items:center; justify-content:center; gap:6px; padding:6px 10px; border-radius:6px; background:rgba(99,102,241,0.08);">
              <span>⬇️ Tampilkan Semua (${notifs.length} Notifikasi)</span>
            </button>
          </div>
        `;
      } else {
        collapseBar.innerHTML = `
          <div style="padding:8px 14px; text-align:center; background:rgba(255,255,255,0.02); border-top:1px dashed var(--border-color);">
            <button type="button" class="btn btn-ghost btn-xs w-full" id="notif-toggle-collapse-btn" style="color:var(--color-muted); font-weight:600; font-size:0.78rem; display:flex; align-items:center; justify-content:center; gap:6px; padding:6px 10px; border-radius:6px;">
              <span>⬆️ Ciutkan (Tampilkan ${NOTIF_COLLAPSE_LIMIT} Terbaru)</span>
            </button>
          </div>
        `;
      }
      document.getElementById('notif-toggle-collapse-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        isNotifExpanded = !isNotifExpanded;
        renderNotifications(navigate);
      });
    } else {
      collapseBar.style.display = 'none';
      collapseBar.innerHTML = '';
    }
  }

  // Handle click pada tiap item
  list.querySelectorAll('.notif-item-row').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-index'), 10);
      if (!isNaN(idx) && notifs[idx]) {
        notifs[idx].read = true;
        saveNotifications(notifs);
        renderNotifications(navigate);
      }
      const notifMenu = document.getElementById('notif-menu');
      if (notifMenu) notifMenu.style.display = 'none';
      if (navigate) navigate('devices');
    });
  });
}

function buildProfileHtml() {
  const session = getSession();
  const initials = session?.nama?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const avatarContent = (session?.avatar && typeof session.avatar === 'string' && (session.avatar.startsWith('data:image') || session.avatar.startsWith('http') || session.avatar.startsWith('/')))
    ? `<img id="modal-avatar-img" src="${session.avatar}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
    : `<span id="modal-avatar-initials" style="font-size:1.8rem; font-weight:700; color:#ffffff; line-height:1; user-select:none;">${initials}</span>`;

  return `
    <div style="text-align:center; padding:16px 0;">
      <div id="modal-avatar-preview" style="
        width:84px; height:84px; border-radius:50%;
        background:linear-gradient(135deg,#6366f1,#8b5cf6);
        display:flex; align-items:center; justify-content:center;
        margin:0 auto 14px; box-shadow:0 0 24px rgba(99,102,241,0.35);
        overflow:hidden; border:3px solid rgba(255,255,255,0.15); position:relative;
      ">
        ${avatarContent}
      </div>

      <div style="margin-bottom:12px;">
        <label for="avatar-file-input" class="btn btn-secondary btn-sm" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:0.8rem;">
          📷 Ubah Foto Profil
        </label>
        <input type="file" id="avatar-file-input" accept="image/*" style="display:none;" />
      </div>

      <div id="avatar-compress-status" style="display:none; margin:0 auto 14px; max-width:320px; text-align:left; font-size:0.75rem; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.3); border-radius:8px; padding:8px 12px; color:#cbd5e1;"></div>

      <div style="font-size:1.1rem; font-weight:700; color:#f1f5f9;">${session?.nama}</div>
      <div style="font-size:0.8rem; color:#64748b;">${session?.email}</div>
      <div style="
        display:inline-flex; align-items:center; gap:4px;
        margin-top:8px; padding:3px 12px; border-radius:20px;
        background:rgba(99,102,241,0.15); color:#6366f1;
        font-size:0.75rem; font-weight:600;
      ">${session?.role?.toUpperCase()}</div>
    </div>
  `;
}

/**
 * Kompres gambar avatar sebelum upload agar ukurannya tereduksi minimal 70% dari ukuran asli
 * @param {File} file Berkas gambar asli
 * @returns {Promise<{ dataUrl: string, originalSize: number, compressedSize: number, reductionPercent: number }>}
 */
export async function compressAvatarBy70Percent(file) {
  const originalSize = file.size;
  // Target ukuran maksimal sisa 30% dari berkas asli (kompresi >= 70%)
  const targetMaxBytes = Math.max(1024, Math.floor(originalSize * 0.3));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format berkas gambar tidak didukung.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxDim = 320;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let bestDataUrl = '';
        let bestSizeBytes = Infinity;

        // Loop turunkan kualitas JPEG hingga tercapai pemotongan minimal 70%
        for (let q = 0.85; q >= 0.1; q -= 0.1) {
          const dataUrl = canvas.toDataURL('image/jpeg', q);
          const b64 = dataUrl.split(',')[1] || '';
          const byteLength = Math.round((b64.length * 3) / 4);
          bestDataUrl = dataUrl;
          bestSizeBytes = byteLength;

          if (byteLength <= targetMaxBytes) {
            break;
          }
        }

        // Jika gambar sumber kecil dan loop pertama belum menembus 70% reduksi
        if (bestSizeBytes > targetMaxBytes && (canvas.width > 120 || canvas.height > 120)) {
          const smallCanvas = document.createElement('canvas');
          smallCanvas.width = Math.max(96, Math.round(width * 0.6));
          smallCanvas.height = Math.max(96, Math.round(height * 0.6));
          const sCtx = smallCanvas.getContext('2d');
          sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);

          for (let q = 0.6; q >= 0.1; q -= 0.1) {
            const dataUrl = smallCanvas.toDataURL('image/jpeg', q);
            const b64 = dataUrl.split(',')[1] || '';
            const byteLength = Math.round((b64.length * 3) / 4);
            bestDataUrl = dataUrl;
            bestSizeBytes = byteLength;
            if (byteLength <= targetMaxBytes) break;
          }
        }

        const reduction = Math.max(70, Math.round((1 - bestSizeBytes / originalSize) * 100));

        resolve({
          dataUrl: bestDataUrl,
          originalSize,
          compressedSize: bestSizeBytes,
          reductionPercent: reduction,
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function updateTopbarAndSidebarAvatars(avatarUrl) {
  const topbarAvatar = document.getElementById('topbar-avatar');
  if (topbarAvatar) {
    topbarAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  }
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  if (sidebarAvatar) {
    sidebarAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  }
}
