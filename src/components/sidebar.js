// ================================================================
// DevWatch - sidebar.js
// Komponen sidebar navigasi dengan role-based menu & i18n
// ================================================================

import Swal from 'sweetalert2';
import { getSession, logout } from '../main.js';
import { getAppSetting } from '../settingsManager.js';
import { getEffectiveTheme, toggleTheme } from '../themeManager.js';
import { isWsConnected, apiLogout } from '../api.js';
import { getStatusCounts } from '../data/mock-devices.js';
import { t } from '../i18n.js';

function getMenuItems() {
  return [
    {
      sectionKey: 'nav_monitoring',
      fallbackSection: 'Monitoring',
      items: [
        { id: 'nav-dashboard', icon: '📊', labelKey: 'nav_dashboard', fallbackLabel: 'Dashboard', route: 'dashboard', roles: ['admin', 'teknisi', 'viewer'] },
      ],
    },
    {
      sectionKey: 'nav_management',
      fallbackSection: 'Manajemen',
      items: [
        { id: 'nav-devices', icon: '🖥️', labelKey: 'nav_devices', fallbackLabel: 'Devices', route: 'devices', roles: ['admin', 'teknisi'] },
        { id: 'nav-logs', icon: '📋', labelKey: 'nav_logs', fallbackLabel: 'Log Sistem', route: 'logs', roles: ['admin', 'teknisi'] },
        { id: 'nav-reports', icon: '📈', labelKey: 'nav_reports', fallbackLabel: 'Laporan', route: 'reports', roles: ['admin', 'teknisi', 'viewer'] },
      ],
    },
    {
      sectionKey: 'nav_admin',
      fallbackSection: 'Administrasi',
      items: [
        { id: 'nav-users', icon: '👥', labelKey: 'nav_users', fallbackLabel: 'Pengguna', route: 'users', roles: ['admin'] },
        { id: 'nav-settings', icon: '⚙️', labelKey: 'nav_settings', fallbackLabel: 'Pengaturan', route: 'settings', roles: ['admin'] },
        { id: 'nav-about', icon: 'ℹ️', labelKey: 'nav_about', fallbackLabel: 'Tentang', route: 'about', roles: ['admin', 'teknisi', 'viewer'] },
      ],
    },
  ];
}

export function renderNavSectionsHtml(role) {
  const menuItems = getMenuItems();
  return menuItems.map((section) => {
    const items = section.items
      .filter((item) => item.roles.includes(role))
      .map(
        (item) => {
          const label = t(item.labelKey, item.fallbackLabel);
          return `
            <button
              id="${item.id}"
              class="nav-item"
              data-route="${item.route}"
              aria-label="${label}"
            >
              <span class="nav-icon">${item.icon}</span>
              <span class="nav-label">${label}</span>
            </button>
          `;
        }
      )
      .join('');

    if (!items) return '';

    return `
      <div class="nav-section">
        <div class="nav-section-label">${t(section.sectionKey, section.fallbackSection)}</div>
        ${items}
      </div>
    `;
  }).join('');
}

export function renderSidebar() {
  const session = getSession();
  const role = session?.role || 'viewer';
  const navSections = renderNavSectionsHtml(role);

  const initials = session?.nama
    ? session.nama.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const userAvatarHtml = (session?.avatar && typeof session.avatar === 'string' && (session.avatar.startsWith('data:image') || session.avatar.startsWith('http') || session.avatar.startsWith('/')))
    ? `<img src="${session.avatar}" alt="${session?.nama || 'Pengguna'}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
    : initials;

  const appName = getAppSetting('app_name', 'DevWatch');
  const appLogo = getAppSetting('app_logo', '');

  const counts = getStatusCounts();
  const total = counts.total || 0;
  const online = counts.online || 0;
  const healthPercent = total > 0 ? Math.round((online / total) * 100) : 0;
  const healthClass = healthPercent >= 80 ? 'good' : healthPercent >= 50 ? 'warning' : 'danger';
  const wsActive = isWsConnected();
  const isLight = getEffectiveTheme() === 'light';

  return `
    <aside class="sidebar" id="sidebar">
      <a class="sidebar-logo" href="#/dashboard">
        <div class="sidebar-logo-icon ${appLogo ? 'has-custom-logo' : ''}" ${appLogo ? 'style="background:transparent !important; box-shadow:none !important;"' : ''}>
          ${appLogo ? `<img src="${appLogo}" class="custom-app-logo" style="width:32px;height:32px;object-fit:contain;border-radius:6px;" alt="Logo" />` : '📡'}
        </div>
        <div class="sidebar-logo-text">
          <span class="sidebar-logo-name">${appName}</span>
          <span class="sidebar-logo-sub">Network Monitor</span>
        </div>
      </a>

      <nav class="sidebar-nav" id="sidebar-nav" aria-label="Navigasi utama">
        ${navSections}
      </nav>

      <div class="sidebar-footer">
        <!-- NOC Live Telemetry Card -->
        <div class="sidebar-telemetry-card" id="sidebar-telemetry-card">
          <div class="telemetry-header">
            <div class="telemetry-pulse">
              <span class="telemetry-dot"></span>
              <span class="telemetry-title">NOC Telemetry</span>
            </div>
            <span class="telemetry-health-badge ${healthClass}" id="sidebar-telemetry-health">${healthPercent}%</span>
          </div>
          <div class="telemetry-progress-bg">
            <div class="telemetry-progress-fill ${healthClass}" id="sidebar-telemetry-bar" style="width: ${healthPercent}%;"></div>
          </div>
          <div class="telemetry-stats-row">
            <span class="telemetry-stat" id="sidebar-telemetry-count">
              <span class="stat-dot ${online === total && total > 0 ? 'good' : 'normal'}">●</span> ${online}/${total} Online
            </span>
            <span class="telemetry-ws-pill ${wsActive ? 'connected' : 'connecting'}" id="sidebar-ws-pill" title="Koneksi WebSocket real-time">
              <span class="ws-dot"></span>
              <span class="ws-label">${wsActive ? 'WS Live' : 'Connecting'}</span>
            </span>
          </div>
        </div>

        <!-- Glassmorphic User & Quick Toolbelt Card -->
        <div class="sidebar-user-card" id="sidebar-user-card">
          <div class="sidebar-user-main" id="sidebar-user-info-btn" role="button" tabindex="0" title="Buka profil engineer">
            <div class="user-avatar-wrap">
              <div class="user-avatar" id="sidebar-user-avatar">${userAvatarHtml}</div>
              <span class="avatar-status-beacon" title="Sesi Aktif"></span>
            </div>
            <div class="user-info">
              <div class="user-name" title="${session?.nama || 'Pengguna'}">${session?.nama || 'Pengguna'}</div>
              <div class="user-role-badge role-${role.toLowerCase()}">${getRoleLabel(role)}</div>
            </div>
          </div>
          <div class="sidebar-toolbelt">
            <button class="toolbelt-btn" id="sidebar-theme-toggle" type="button" title="${isLight ? 'Mode Gelap' : 'Mode Terang'}" aria-label="Ganti Tema">
              <span class="toolbelt-icon" id="sidebar-theme-icon">${isLight ? '🌙' : '☀️'}</span>
            </button>
            <button class="toolbelt-btn danger" id="sidebar-logout-btn" type="button" title="Keluar dari Sistem" aria-label="Keluar">
              <span class="toolbelt-icon">🚪</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
  `;
}

export function updateSidebarTelemetry() {
  const counts = getStatusCounts();
  const total = counts.total || 0;
  const online = counts.online || 0;
  const percent = total > 0 ? Math.round((online / total) * 100) : 0;
  const healthClass = percent >= 80 ? 'good' : percent >= 50 ? 'warning' : 'danger';

  const healthEl = document.getElementById('sidebar-telemetry-health');
  const barEl = document.getElementById('sidebar-telemetry-bar');
  const countEl = document.getElementById('sidebar-telemetry-count');
  const wsPill = document.getElementById('sidebar-ws-pill');

  if (healthEl) {
    healthEl.textContent = `${percent}%`;
    healthEl.className = `telemetry-health-badge ${healthClass}`;
  }
  if (barEl) {
    barEl.style.width = `${percent}%`;
    barEl.className = `telemetry-progress-fill ${healthClass}`;
  }
  if (countEl) {
    countEl.innerHTML = `<span class="stat-dot ${online === total && total > 0 ? 'good' : 'normal'}">●</span> ${online}/${total} Online`;
  }
  if (wsPill) {
    const wsActive = isWsConnected();
    wsPill.className = `telemetry-ws-pill ${wsActive ? 'connected' : 'connecting'}`;
    const wsLabel = wsPill.querySelector('.ws-label');
    if (wsLabel) wsLabel.textContent = wsActive ? 'WS Live' : 'Connecting';
  }

  // Update theme toggle icon
  const themeIcon = document.getElementById('sidebar-theme-icon');
  const themeBtn = document.getElementById('sidebar-theme-toggle');
  if (themeIcon) {
    const isLight = getEffectiveTheme() === 'light';
    themeIcon.textContent = isLight ? '🌙' : '☀️';
    if (themeBtn) {
      themeBtn.title = isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang';
    }
  }
}

async function showUserProfileModal(session, role, navigate) {
  const isPreview = session?.is_preview;
  const ipAkses = session?.ip_akses || '127.0.0.1';
  const email = session?.email || 'admin@devwatch.local';
  const roleLabel = getRoleLabel(role);
  const permissions = role === 'admin' 
    ? 'Akses Penuh (Monitoring, Tambah/Edit Device, Pengguna, Log, Pengaturan Global)'
    : role === 'teknisi'
    ? 'Operasional (Monitoring, Tambah/Edit Device, Log Sistem, Pemeliharaan)'
    : 'Pemantauan (Monitoring Dashboard & Laporan)';

  await Swal.fire({
    title: '👤 Profil NOC Engineer',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:14px; font-size:0.85rem;">
        <div style="display:flex; align-items:center; gap:14px; background:rgba(255,255,255,0.04); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
          <div class="user-avatar" style="width:48px; height:48px; font-size:1.2rem; flex-shrink:0;">
            ${session?.nama ? session.nama.substring(0, 2).toUpperCase() : 'U'}
          </div>
          <div style="overflow:hidden;">
            <div style="font-weight:700; font-size:1.05rem; color:var(--color-heading);">${session?.nama || 'Pengguna'}</div>
            <div style="color:var(--color-muted); font-size:0.8rem;">${email}</div>
            <span class="user-role-badge role-${role.toLowerCase()}" style="margin-top:4px; display:inline-block;">${roleLabel}</span>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.06); padding:10px 14px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div>
            <div style="font-size:0.7rem; color:var(--color-muted); text-transform:uppercase;">Alamat IP Akses</div>
            <div style="font-family:monospace; font-weight:600; color:var(--color-heading);">${ipAkses}</div>
          </div>
          <div>
            <div style="font-size:0.7rem; color:var(--color-muted); text-transform:uppercase;">Tipe Sesi</div>
            <div style="font-weight:600; color:${isPreview ? '#f59e0b' : '#10b981'};">${isPreview ? 'Preview Mode' : 'Live Database'}</div>
          </div>
        </div>

        <div style="background:rgba(99,102,241,0.08); border-left:3px solid #6366f1; padding:8px 12px; border-radius:4px;">
          <div style="font-size:0.72rem; color:var(--color-muted); font-weight:600;">Hak Otorisasi:</div>
          <div style="font-size:0.78rem; color:var(--color-text); margin-top:2px;">${permissions}</div>
        </div>
      </div>
    `,
    width: 480,
    background: '#1a1d2e',
    color: '#e2e8f0',
    showCancelButton: role === 'admin',
    confirmButtonText: 'Tutup',
    cancelButtonText: '⚙️ Buka Pengaturan',
    confirmButtonColor: '#6366f1',
    cancelButtonColor: '#374151',
  }).then((res) => {
    if (res.dismiss === Swal.DismissReason.cancel && role === 'admin') {
      navigate?.('settings');
    }
  });
}

export function initSidebarEvents(navigate) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger-btn');

  function bindNavClicks() {
    document.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
      btn.onclick = () => {
        const route = btn.getAttribute('data-route');
        navigate(route);
        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
      };
    });
  }

  bindNavClicks();

  // Re-render nav saat bahasa berubah
  window.addEventListener('devwatch:language_changed', () => {
    const navEl = document.getElementById('sidebar-nav');
    if (navEl) {
      const session = getSession();
      const role = session?.role || 'viewer';
      navEl.innerHTML = renderNavSectionsHtml(role);
      bindNavClicks();
      const activeHash = window.location.hash.replace('#/', '') || 'dashboard';
      setActiveNav(activeHash);
    }
  });

  // Profil Engineer modal
  document.getElementById('sidebar-user-info-btn')?.addEventListener('click', () => {
    const session = getSession();
    const role = session?.role || 'viewer';
    showUserProfileModal(session, role, navigate);
  });

  // Theme toggle shortcut
  document.getElementById('sidebar-theme-toggle')?.addEventListener('click', () => {
    toggleTheme();
    updateSidebarTelemetry();
  });

  // Logout shortcut
  document.getElementById('sidebar-logout-btn')?.addEventListener('click', async () => {
    const { isConfirmed } = await Swal.fire({
      title: t('topbar_confirm_logout', 'Keluar dari Sistem?'),
      text: t('topbar_logout_desc', 'Sesi Anda akan diakhiri.'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('topbar_logout', 'Keluar'),
      cancelButtonText: t('modal_cancel', 'Batal'),
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#374151',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
    if (isConfirmed) {
      try {
        await apiLogout();
      } catch {}
      logout();
    }
  });

  // Pantau update status real-time untuk memperbarui telemetry card
  window.addEventListener('devwatch:status_changed', updateSidebarTelemetry);
  window.addEventListener('devwatch:devices_updated', updateSidebarTelemetry);
  window.addEventListener('devwatch:ui_update', updateSidebarTelemetry);
  window.addEventListener('devwatch:ws_connected', updateSidebarTelemetry);
  window.addEventListener('devwatch:ws_disconnected', updateSidebarTelemetry);
  window.addEventListener('devwatch:theme_changed', updateSidebarTelemetry);

  // Inisialisasi awal telemetry
  updateSidebarTelemetry();

  // Hamburger toggle
  hamburger?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('show');
  });

  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
  });

  // Sidebar logo click
  document.querySelector('.sidebar-logo')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('dashboard');
  });
}

export function setActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-route') === route) {
      btn.classList.add('active');
    }
  });
}

function getRoleLabel(role) {
  const labels = { admin: 'Administrator', teknisi: 'Teknisi', viewer: 'Viewer' };
  return labels[role] || role;
}

