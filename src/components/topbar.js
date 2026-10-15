// ================================================================
// DevWatch — topbar.js
// Header: halaman title, live indicator, notifikasi, user menu
// ================================================================

import { getSession, logout } from '../main.js';
import Swal from 'sweetalert2';

const pageTitles = {
  dashboard: { title: 'Dashboard', subtitle: 'Monitoring real-time semua device jaringan' },
  devices: { title: 'Manajemen Device', subtitle: 'Kelola, tambah, dan pantau seluruh device' },
  'device-detail': { title: 'Detail Device', subtitle: 'Informasi lengkap dan riwayat insiden' },
  logs: { title: 'Log Sistem', subtitle: 'Riwayat status, aktivitas, dan perubahan konfigurasi' },
  reports: { title: 'Laporan', subtitle: 'Uptime, SLA, dan laporan insiden' },
  users: { title: 'Manajemen Pengguna', subtitle: 'Kelola akun dan hak akses pengguna' },
  settings: { title: 'Pengaturan Sistem', subtitle: 'Konfigurasi monitoring, notifikasi, dan keamanan' },
  about: { title: 'Tentang Aplikasi', subtitle: 'Informasi versi dan lisensi DevWatch' },
};

export function renderTopbar(currentRoute = 'dashboard') {
  const session = getSession();
  const page = pageTitles[currentRoute] || pageTitles.dashboard;
  const initials = session?.nama
    ? session.nama.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return `
    <header class="topbar" id="topbar">
      <div class="topbar-left">
        <button class="hamburger" id="hamburger-btn" aria-label="Toggle menu">☰</button>
        <div>
          <div class="topbar-title">${page.title}</div>
          <div class="topbar-breadcrumb text-xs">
            <span>DevWatch</span>
            <span>›</span>
            <span>${page.title}</span>
          </div>
        </div>
      </div>

      <div class="topbar-right">
        <div class="live-indicator" title="Monitoring aktif">
          <span class="live-dot"></span>
          <span class="topbar-time" id="topbar-clock">--:--:--</span>
        </div>

        <div class="dropdown" id="notif-dropdown">
          <button class="btn btn-ghost btn-icon" id="notif-btn" aria-label="Notifikasi" style="position:relative;">
            🔔
            <span class="notif-badge" id="notif-count">3</span>
          </button>
          <div class="dropdown-menu" id="notif-menu" style="display:none; width:300px;">
            <div style="padding:12px 16px; font-weight:700; font-size:0.85rem; border-bottom:1px solid var(--border-color); color:var(--color-heading);">
              Notifikasi
            </div>
            <div id="notif-list"></div>
            <div style="padding:8px 16px; border-top:1px solid var(--border-color); text-align:center;">
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('notif-menu').style.display='none'">
                Tutup
              </button>
            </div>
          </div>
        </div>

        <div class="dropdown" id="user-dropdown">
          <button class="btn btn-ghost" id="user-btn" style="gap:8px;">
            <div class="user-avatar" style="width:28px;height:28px;font-size:0.72rem;">${initials}</div>
            <span class="text-sm font-medium">${session?.nama?.split(' ')[0] || 'User'}</span>
            <span style="font-size:0.7rem;color:var(--color-muted);">▼</span>
          </button>
          <div class="dropdown-menu" id="user-menu" style="display:none;">
            <div style="padding:12px 16px; border-bottom:1px solid var(--border-color);">
              <div style="font-weight:600; font-size:0.88rem; color:var(--color-heading);">${session?.nama}</div>
              <div style="font-size:0.75rem; color:var(--color-muted);">${session?.email}</div>
            </div>
            <button class="dropdown-item" id="profile-btn">👤 Profil Saya</button>
            <button class="dropdown-item" id="notif-settings-btn">🔔 Pengaturan Notif</button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" id="logout-btn">🚪 Keluar</button>
          </div>
        </div>
      </div>
    </header>
  `;
}

export function initTopbarEvents(navigate) {
  // Clock
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);
  window._clockInterval = clockInterval;

  // Notif dropdown
  const notifBtn = document.getElementById('notif-btn');
  const notifMenu = document.getElementById('notif-menu');
  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = notifMenu.style.display === 'block';
    closeAllDropdowns();
    notifMenu.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderNotifications();
  });

  // User dropdown
  const userBtn = document.getElementById('user-btn');
  const userMenu = document.getElementById('user-menu');
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = userMenu.style.display === 'block';
    closeAllDropdowns();
    userMenu.style.display = isOpen ? 'none' : 'block';
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
      width: 400,
    });
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
    clock.textContent = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta',
    });
  }
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  const count = document.getElementById('notif-count');
  if (!list) return;

  const notifs = [
    { icon: '🔴', text: 'PC Marketing 01 OFFLINE sejak 06:50', time: '47 menit lalu', route: 'devices' },
    { icon: '🔴', text: 'PC Keuangan 01 OFFLINE sejak 06:32', time: '1 jam lalu', route: 'devices' },
    { icon: '🟡', text: 'CCTV Gudang Barang OFFLINE sejak 07:32', time: '1 jam lalu', route: 'devices' },
  ];

  if (count) count.textContent = notifs.length;

  list.innerHTML = notifs.map((n, i) => `
    <div style="
      display:flex; align-items:flex-start; gap:10px; padding:10px 16px;
      border-bottom:1px solid var(--border-color); cursor:pointer;
      transition:background 0.15s;
    "
    onmouseover="this.style.background='rgba(255,255,255,0.04)'"
    onmouseout="this.style.background='transparent'"
    onclick="document.getElementById('notif-menu').style.display='none'"
    >
      <span style="font-size:1rem; margin-top:2px;">${n.icon}</span>
      <div>
        <div style="font-size:0.82rem; color:var(--color-text);">${n.text}</div>
        <div style="font-size:0.75rem; color:var(--color-muted);">${n.time}</div>
      </div>
    </div>
  `).join('');
}

function buildProfileHtml() {
  const session = getSession();
  const initials = session?.nama?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  return `
    <div style="text-align:center; padding:16px 0;">
      <div style="
        width:64px; height:64px; border-radius:50%;
        background:linear-gradient(135deg,#6366f1,#8b5cf6);
        display:flex; align-items:center; justify-content:center;
        font-size:1.5rem; font-weight:700; color:#fff;
        margin:0 auto 12px; box-shadow:0 0 20px rgba(99,102,241,0.4);
      ">${initials}</div>
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
