// ================================================================
// DevWatch — sidebar.js
// Komponen sidebar navigasi dengan role-based menu & i18n
// ================================================================

import { getSession } from '../main.js';
import { getAppSetting } from '../settingsManager.js';
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

  const appName = getAppSetting('app_name', 'DevWatch');
  const appLogo = getAppSetting('app_logo', '');

  return `
    <aside class="sidebar" id="sidebar">
      <a class="sidebar-logo" href="#/dashboard">
        <div class="sidebar-logo-icon">
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
        <div class="sidebar-user" id="sidebar-user-btn">
          <div class="user-avatar" title="${session?.nama || 'Pengguna'}">${initials}</div>
          <div class="user-info">
            <div class="user-name">${session?.nama || 'Pengguna'}</div>
            <div class="user-role">${getRoleLabel(role)}</div>
          </div>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
  `;
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
