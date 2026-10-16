// ================================================================
// DevWatch — api.js
// Client API terpusat untuk komunikasi dengan Backend Express & WebSocket
// ================================================================

const TOKEN_KEY = 'devwatch_token';
let wsInstance = null;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Helper dasar untuk HTTP request dengan JWT Bearer
 */
export async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401 && !endpoint.includes('/auth/login')) {
    // Sesi kedaluwarsa -> bersihkan sesi & arahkan ke login
    localStorage.removeItem('devwatch_session');
    setToken(null);
    if (!window.location.hash.includes('login')) {
      window.location.hash = '#/login';
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Permintaan gagal dengan status ${res.status}`);
  }

  return data;
}

// ---- AUTENTIKASI ----
export async function apiLogin(email, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (res.token) {
    setToken(res.token);
  }
  return res;
}

export async function apiLogout() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    // Abaikan error saat logout
  } finally {
    setToken(null);
  }
}

export async function apiGetMe() {
  return request('/auth/me');
}

// ---- DEVICES ----
export async function apiGetDevices(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/devices${query ? `?${query}` : ''}`);
}

export async function apiGetDevice(id) {
  return request(`/devices/${id}`);
}

export async function apiCreateDevice(payload) {
  return request('/devices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateDevice(id, payload) {
  return request(`/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteDevice(id) {
  return request(`/devices/${id}`, {
    method: 'DELETE',
  });
}

export async function apiBulkDeleteDevices(ids) {
  return request('/devices/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function apiPingDevice(id) {
  return request(`/devices/${id}/ping`, {
    method: 'POST',
  });
}

export async function apiTestConnection(payload) {
  return request('/devices/test-connection', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiSetMaintenance(id, reason, durationMinutes = 120) {
  return request(`/devices/${id}/maintenance`, {
    method: 'POST',
    body: JSON.stringify({ action: 'start', reason, durationMinutes }),
  });
}

export async function apiFinishMaintenance(id) {
  return request(`/devices/${id}/maintenance`, {
    method: 'POST',
    body: JSON.stringify({ action: 'finish' }),
  });
}

export async function apiImportCsv(devices) {
  return request('/devices/import-csv', {
    method: 'POST',
    body: JSON.stringify({ devices }),
  });
}

// ---- LOGS ----
export async function apiGetLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/logs${query ? `?${query}` : ''}`);
}

export async function apiGetIsapiInfo(id) {
  return request(`/devices/${id}/isapi`);
}

// ---- REPORTS ----
export async function apiGetWeeklyReport(archiveId = null) {
  return request(`/reports/weekly${archiveId ? `?id=${archiveId}` : ''}`);
}

export async function apiGetWeeklyArchives() {
  return request('/reports/weekly/archives');
}

export async function apiSaveWeeklySnapshot() {
  return request('/reports/weekly/snapshot', { method: 'POST' });
}

export async function apiGetSlaReport() {
  return request('/reports/sla');
}

export async function apiGetIncidentReport() {
  return request('/reports/incidents');
}

// ---- USERS (ADMIN) ----
export async function apiGetUsers() {
  return request('/users');
}

export async function apiCreateUser(payload) {
  return request('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateUser(id, payload) {
  return request(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteUser(id) {
  return request(`/users/${id}`, {
    method: 'DELETE',
  });
}

export async function apiResetPassword(id, newPassword) {
  return request(`/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

// ---- SETTINGS ----
export async function apiGetSettings() {
  return request('/settings');
}

export async function apiUpdateSettings(payload) {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function apiTriggerBackup() {
  return request('/settings/backup', {
    method: 'POST',
  });
}

export async function apiCleanLogs(retentionDays = 90) {
  return request('/settings/clean-logs', {
    method: 'POST',
    body: JSON.stringify({ retentionDays }),
  });
}

// ---- WEBSOCKET REAL-TIME LISTENER ----
export function connectWebSocket() {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) return wsInstance;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // otomatis ikut port dev 5173 via proxy atau port 3000
  const wsUrl = `${protocol}//${host}/ws`;

  try {
    wsInstance = new WebSocket(wsUrl);

    wsInstance.onopen = () => {
      console.log('[DevWatch WS]: Terhubung ke siaran real-time.');
      window.dispatchEvent(new CustomEvent('devwatch:ws_connected'));
    };

    wsInstance.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event) {
          window.dispatchEvent(new CustomEvent(`devwatch:${payload.event}`, { detail: payload.data }));
        }
      } catch {
        // Abaikan
      }
    };

    wsInstance.onclose = () => {
      console.log('[DevWatch WS]: Terputus. Menghubungkan kembali dalam 3 detik...');
      wsInstance = null;
      setTimeout(connectWebSocket, 3000);
    };

    wsInstance.onerror = () => {
      wsInstance = null;
    };
  } catch {
    wsInstance = null;
  }

  return wsInstance;
}
