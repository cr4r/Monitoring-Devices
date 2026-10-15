// ================================================================
// DevWatch — main.js
// Entry point: session management, router, page rendering
// ================================================================

import 'sweetalert2/dist/sweetalert2.min.css';
import { parseHash, navigate, canAccess } from './router.js';
import { renderSidebar, initSidebarEvents, setActiveNav } from './components/sidebar.js';
import { renderTopbar, initTopbarEvents } from './components/topbar.js';
import { renderLogin, initLoginEvents } from './pages/login.js';
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

// Inisialisasi pengaturan dinamis, WebSocket, dan Push Notifications
initSettingsManager();
connectWebSocket();
initBrowserNotificationService();

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
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

// ---- PAGE REGISTRY ----
const pages = {
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

  renderPage(route, params);
}

function renderPage(route, params) {
  const app = document.getElementById('app');
  const session = getSession();
  const isLoggedIn = !!session;
  const pageDef = pages[route];
  if (!pageDef) return;

  if (!isLoggedIn || route === 'login') {
    // Login page: no shell
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

// Handle initial empty hash
if (!location.hash || location.hash === '#' || location.hash === '#/') {
  const session = getSession();
  location.hash = session ? '#/dashboard' : '#/login';
}
