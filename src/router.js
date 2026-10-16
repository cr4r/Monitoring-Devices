// ================================================================
// DevWatch — router.js
// Hash-based SPA router dengan auth guard
// ================================================================

import { getSession } from './main.js';

const routes = {
  setup: { page: 'setup', auth: false },
  login: { page: 'login', auth: false },
  dashboard: { page: 'dashboard', auth: true, roles: ['admin', 'teknisi', 'viewer'] },
  devices: { page: 'devices', auth: true, roles: ['admin', 'teknisi'] },
  'device-detail': { page: 'device-detail', auth: true, roles: ['admin', 'teknisi', 'viewer'] },
  logs: { page: 'logs', auth: true, roles: ['admin', 'teknisi'] },
  reports: { page: 'reports', auth: true, roles: ['admin', 'teknisi', 'viewer'] },
  users: { page: 'users', auth: true, roles: ['admin'] },
  settings: { page: 'settings', auth: true, roles: ['admin'] },
  about: { page: 'about', auth: true, roles: ['admin', 'teknisi', 'viewer'] },
};

export function parseHash() {
  const hash = location.hash.replace('#/', '').split('?');
  const route = hash[0] || 'dashboard';
  const params = {};
  if (hash[1]) {
    hash[1].split('&').forEach((p) => {
      const [k, v] = p.split('=');
      params[k] = decodeURIComponent(v);
    });
  }
  return { route, params };
}

export function navigate(route, params = {}) {
  const query = Object.keys(params).length
    ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    : '';
  location.hash = `/${route}${query}`;
}

export function canAccess(route) {
  const def = routes[route];
  if (!def) return false;
  if (!def.auth) return true;

  const session = getSession();
  if (!session) return false;
  if (!def.roles.includes(session.role)) return false;
  return true;
}

export function getRouteDef(route) {
  return routes[route] || null;
}
