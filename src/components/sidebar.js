// ================================================================
// DevWatch — sidebar.js
// Komponen sidebar navigasi dengan role-based menu
// ================================================================

import { getSession } from '../main.js';

const menuItems = [
  {
    section: 'Monitoring',
    items: [
      { id: 'nav-dashboard', icon: '📊', label: 'Dashboard', route: 'dashboard', roles: ['admin', 'teknisi', 'viewer'] },
    ],
  },
  {
    section: 'Manajemen',
    items: [
      { id: 'nav-devices', icon: '🖥️', label: 'Devices', route: 'devices', roles: ['admin', 'teknisi'] },
      { id: 'nav-logs', icon: '📋', label: 'Log Sistem', route: 'logs', roles: ['admin', 'teknisi'] },
      { id: 'nav-reports', icon: '📈', label: 'Laporan', route: 'reports', roles: ['admin', 'teknisi', 'viewer'] },
    ],
  },
  {
    section: 'Administrasi',
    items: [
      { id: 'nav-users', icon: '👥', label: 'Pengguna', route: 'users', roles: ['admin'] },
      { id: 'nav-settings', icon: '⚙️', label: 'Pengaturan', route: 'settings', roles: ['admin'] },
      { id: 'nav-about', icon: 'ℹ️', label: 'Tentang', route: 'about', roles: ['admin', 'teknisi', 'viewer'] },
    ],
  },
];

export function renderSidebar() {
  const session = getSession();
  const role = session?.role || 'viewer';

  const navSections = menuItems.map((section) => {
    const items = section.items
      .filter((item) => item.roles.includes(role))
      .map(
        (item) => `
        <button
          id="${item.id}"
          class="nav-item"
          data-route="${item.route}"
          aria-label="${item.label}"
        >
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </button>
      `
      )
      .join('');

    if (!items) return '';

    return `
      <div class="nav-section">
        <div class="nav-section-label">${section.section}</div>
        ${items}
      </div>
    `;
  }).join('');

  const initials = session?.nama
    ? session.nama.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return `
    <aside class="sidebar" id="sidebar">
      <a class="sidebar-logo" href="#/dashboard">
        <div class="sidebar-logo-icon">📡</div>
        <div class="sidebar-logo-text">
          <span class="sidebar-logo-name">DevWatch</span>
          <span class="sidebar-logo-sub">Network Monitor</span>
        </div>
      </a>

      <nav class="sidebar-nav" aria-label="Navigasi utama">
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

  // Nav item click
  document.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.getAttribute('data-route');
      navigate(route);
      // Close sidebar on mobile
      sidebar?.classList.remove('open');
      overlay?.classList.remove('show');
    });
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

  // Sidebar logo
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
