// ================================================================
// DevWatch - main.js
// Entry point: session management, router, page rendering
// ================================================================

import 'sweetalert2/dist/sweetalert2.min.css';
import { parseHash, navigate, canAccess } from './router.js';
import { renderSidebar, initSidebarEvents, setActiveNav } from './components/sidebar.js';
import { renderTopbar, initTopbarEvents } from './components/topbar.js';
import { renderLogin, initLoginEvents } from './pages/login.js';
import { renderSetup, initSetupEvents } from './pages/setup.js';
import { renderDashboard, initDashboardEvents } from './pages/dashboard.js';
import { renderDevices, initDevicesEvents } from './pages/devices.js';
import { renderDeviceDetail, initDeviceDetailEvents } from './pages/device-detail.js';
import { renderLogs, initLogsEvents } from './pages/logs.js';
import { renderReports, initReportsEvents } from './pages/reports.js';
import { renderUsers, initUsersEvents } from './pages/users.js';
import { renderSettings, initSettingsEvents } from './pages/settings.js';
import { renderAbout, initAboutEvents } from './pages/about.js';
import { destroyAllCharts } from './components/charts.js';
import { connectWebSocket } from './api.js';
import { initSettingsManager } from './settingsManager.js';
import { initBrowserNotificationService } from './services/browserNotification.js';
import { initThemeManager } from './themeManager.js';

// Inisialisasi tema, pengaturan dinamis, WebSocket, dan Push Notifications
initThemeManager();
initSettingsManager();
connectWebSocket();
initBrowserNotificationService();

// ---- SETUP STATUS CACHE & CHECKER ----
let setupStatusCache = null;

export async function checkSetupStatus(forceRefresh = false) {
  if (setupStatusCache !== null && !forceRefresh) {
    return setupStatusCache;
  }
  try {
    const res = await fetch('/api/setup/status');
    if (res.ok) {
      const data = await res.json();
      setupStatusCache = data.needsSetup === true;
      return setupStatusCache;
    }
  } catch (err) {
    console.warn('[Setup Guard]: Gagal cek status setup:', err);
  }
  return false;
}

export function invalidateSetupStatus() {
  setupStatusCache = null;
}

// ---- SESSION MANAGEMENT ----
const SESSION_KEY = 'devwatch_session';

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  invalidateSetupStatus();
  window.dispatchEvent(new CustomEvent('devwatch:session_change', { detail: data }));
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('devwatch_token');
  window.dispatchEvent(new CustomEvent('devwatch:session_change', { detail: null }));
}

// ---- PROACTIVE SESSION VALIDATOR ----
let _sessionCheckInterval = null;

/**
 * Validasi token ke server. Jika 401/gagal, logout dan redirect ke login.
 * Dipanggil saat boot dan secara berkala.
 */
export async function validateServerSession() {
  const session = getSession();
  if (!session) return; // Tidak login, tidak perlu cek
  if (session.is_preview) return; // Mode Preview menggunakan sesi demo lokal, bypass validasi server

  try {
    const token = localStorage.getItem('devwatch_token');
    if (!token) {
      logout();
      navigate('login');
      return;
    }

    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 || res.status === 403) {
      // Token expired atau invalid di server
      logout();
      // Tampilkan notifikasi sesi berakhir
      if (!window.location.hash.includes('login')) {
        window.location.hash = '#/login';
        // Toast notifikasi (jika Swal tersedia)
        try {
          const { default: Swal } = await import('sweetalert2');
          Swal.fire({
            toast: true,
            icon: 'warning',
            title: 'Sesi Berakhir',
            text: 'Silakan login kembali.',
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            background: '#1a1d2e',
            color: '#e2e8f0',
          });
        } catch { /* Swal belum ready */ }
      }
    }
  } catch {
    // Jaringan error - jangan logout, mungkin server sedang restart
  }
}

/**
 * Mulai periodic session check tiap N menit.
 * Berhenti otomatis jika user logout.
 */
export function startSessionWatcher(intervalMinutes = 5) {
  if (_sessionCheckInterval) clearInterval(_sessionCheckInterval);
  _sessionCheckInterval = setInterval(() => {
    validateServerSession();
  }, intervalMinutes * 60 * 1000);
}

export function stopSessionWatcher() {
  if (_sessionCheckInterval) {
    clearInterval(_sessionCheckInterval);
    _sessionCheckInterval = null;
  }
}

// ---- PAGE REGISTRY ----
const pages = {
  setup: { render: renderSetup, init: initSetupEvents },
  login: { render: renderLogin, init: initLoginEvents },
  dashboard: { render: renderDashboard, init: initDashboardEvents },
  devices: { render: renderDevices, init: initDevicesEvents },
  'device-detail': { render: renderDeviceDetail, init: initDeviceDetailEvents },
  logs: { render: renderLogs, init: initLogsEvents },
  reports: { render: renderReports, init: initReportsEvents },
  users: { render: renderUsers, init: initUsersEvents },
  settings: { render: renderSettings, init: initSettingsEvents },
  about: { render: renderAbout, init: initAboutEvents },
};

// ---- ROUTER ----
function navigateWrapper(route, params = {}) {
  navigate(route, params);
}

async function handleRoute() {
  const { route, params } = parseHash();
  const app = document.getElementById('app');
  if (!app) return;

  // Clear clock interval if exists
  if (window._clockInterval) {
    clearInterval(window._clockInterval);
    delete window._clockInterval;
  }

  // Destroy chart instances on navigation
  destroyAllCharts();

  // Setup security guards
  const needsSetup = await checkSetupStatus();
  if (needsSetup) {
    // Database has 0 users -> force redirect to setup
    if (route !== 'setup') {
      navigate('setup');
      return;
    }
    renderPage('setup', params);
    return;
  }

  // Setup already completed -> prevent replay/accessing setup page
  if (!needsSetup && route === 'setup') {
    const currentSession = getSession();
    navigate(currentSession ? 'dashboard' : 'login');
    return;
  }

  const session = getSession();
  const isLoggedIn = !!session;

  // Redirect logic
  if (!isLoggedIn && route !== 'login') {
    renderPage('login', {});
    return;
  }
  if (isLoggedIn && route === 'login') {
    renderPage('dashboard', {});
    return;
  }
  if (isLoggedIn && !canAccess(route)) {
    // No access → redirect to dashboard
    renderPage('dashboard', {});
    return;
  }

  // Validasi token ke server sebelum render halaman protected
  // Mencegah user berada di halaman protected dengan sesi expired
  if (isLoggedIn && route !== 'login') {
    await validateServerSession();
    // Cek ulang setelah validasi - mungkin sudah di-logout oleh validateServerSession
    if (!getSession()) return;
  }

  renderPage(route, params);
}

function renderPage(route, params) {
  const app = document.getElementById('app');
  const session = getSession();
  const isLoggedIn = !!session;
  const pageDef = pages[route];
  if (!pageDef) return;

  if (!isLoggedIn || route === 'login' || route === 'setup') {
    // Login or Setup page: no shell
    app.innerHTML = pageDef.render(params);
    pageDef.init?.(navigateWrapper);
    return;
  }

  // Authenticated: render shell
  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <div style="flex:1; min-width:0;">
        ${renderTopbar(route)}
        <main class="main-content" id="main-content">
          ${pageDef.render(params)}
        </main>
      </div>
    </div>
  `;

  // Init components
  initSidebarEvents(navigateWrapper);
  initTopbarEvents(navigateWrapper);
  setActiveNav(route);
  pageDef.init?.(navigateWrapper);
}

// ---- BOOT ----
window.addEventListener('hashchange', handleRoute);
window.addEventListener('load', handleRoute);

// Stop session watcher saat user logout
window.addEventListener('devwatch:session_change', (e) => {
  if (!e.detail) {
    // User logged out
    stopSessionWatcher();
  } else {
    // User logged in - mulai periodic session check tiap 5 menit
    startSessionWatcher(5);
  }
});

// Handle initial empty hash
if (!location.hash || location.hash === '#' || location.hash === '#/') {
  const session = getSession();
  location.hash = session ? '#/dashboard' : '#/login';
}

// Mulai session watcher jika sudah login saat app pertama kali dibuka
if (getSession()) {
  startSessionWatcher(5);
}
