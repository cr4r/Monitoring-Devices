// ================================================================
// DevWatch — api.js
// Client API terpusat untuk komunikasi dengan Backend Express & WebSocket
// ================================================================

const TOKEN_KEY = 'devwatch_token';
const SESSION_KEY = 'devwatch_session';
let wsInstance = null;

// Deteksi apakah sesi saat ini adalah Mode Preview
function _isCurrentSessionPreview() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.is_preview);
  } catch {
    return false;
  }
}

// Bersihkan sesi lokal tanpa import circular (main.js)
function _clearLocalSession() {
  if (_isCurrentSessionPreview()) return; // Jangan hapus sesi mode preview
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

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
    if (_isCurrentSessionPreview()) {
      return { success: false, message: 'Preview session active' };
    }
    // Sesi kedaluwarsa — bersihkan sesi lokal & arahkan ke login
    _clearLocalSession();
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
export async function apiLogin(identifier, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: identifier,
      email: identifier,
      password,
    }),
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
  if (_isCurrentSessionPreview()) {
    const { mockDevices } = await import('./data/mock-devices.js');
    return { success: true, data: mockDevices };
  }
  const query = new URLSearchParams(params).toString();
  return request(`/devices${query ? `?${query}` : ''}`);
}

export async function apiGetDevice(id) {
  if (_isCurrentSessionPreview()) {
    const { mockDevices } = await import('./data/mock-devices.js');
    const dev = mockDevices.find((d) => d.id === Number(id));
    if (!dev) {
      throw new Error('Perangkat demo tidak ditemukan');
    }
    const isOnline = dev.status === 'online';
    const latency = dev.responseTime || (isOnline ? 18 : 0);
    const timeline24h = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      status: dev.status,
      latency: isOnline ? Math.max(1, latency + ((i * 7) % 5) - 2) : 0,
    }));
    return {
      success: true,
      data: {
        ...dev,
        timeline24h,
      },
    };
  }
  return request(`/devices/${id}`);
}

export async function apiCreateDevice(payload) {
  if (_isCurrentSessionPreview()) {
    const { addDevice } = await import('./data/mock-devices.js');
    const newDev = addDevice(payload);
    window.dispatchEvent(new CustomEvent('devwatch:ui_update'));
    return { success: true, data: newDev };
  }
  return request('/devices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateDevice(id, payload) {
  if (_isCurrentSessionPreview()) {
    const { mockDevices } = await import('./data/mock-devices.js');
    const dev = mockDevices.find((d) => d.id === Number(id));
    if (dev) {
      Object.assign(dev, payload);
    }
    window.dispatchEvent(new CustomEvent('devwatch:ui_update'));
    return { success: true, data: dev || payload };
  }
  return request(`/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteDevice(id) {
  if (_isCurrentSessionPreview()) {
    const { deleteDevice } = await import('./data/mock-devices.js');
    deleteDevice(Number(id));
    window.dispatchEvent(new CustomEvent('devwatch:ui_update'));
    return { success: true };
  }
  return request(`/devices/${id}`, {
    method: 'DELETE',
  });
}

export async function apiBulkDeleteDevices(ids) {
  if (_isCurrentSessionPreview()) {
    const { deleteDevice } = await import('./data/mock-devices.js');
    ids.forEach((id) => deleteDevice(Number(id)));
    window.dispatchEvent(new CustomEvent('devwatch:ui_update'));
    return { success: true };
  }
  return request('/devices/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function apiPingAllDevices() {
  if (_isCurrentSessionPreview()) {
    const { mockDevices } = await import('./data/mock-devices.js');
    const results = mockDevices.map((d) => {
      const isOnline = d.status === 'online';
      const timeMs = d.responseTime || (isOnline ? 18 : 0);
      return {
        id: d.id,
        nama: d.nama,
        ip: d.ip,
        alive: isOnline,
        status: d.status,
        time: timeMs,
        responseTime: timeMs,
        statusText: isOnline ? `${timeMs} ms` : 'Request Timeout (Simulasi)',
        method: (d.metode || 'PING').toUpperCase(),
      };
    });
    return {
      success: true,
      total: results.length,
      online: results.filter((r) => r.status === 'online').length,
      offline: results.filter((r) => r.status === 'offline').length,
      maintenance: results.filter((r) => r.status === 'maintenance').length,
      results,
    };
  }
  return request('/devices/ping-all', {
    method: 'POST',
  });
}

export async function apiPingDevice(id) {
  if (_isCurrentSessionPreview()) {
    const { mockDevices } = await import('./data/mock-devices.js');
    const dev = mockDevices.find((d) => d.id === Number(id));
    const isOnline = dev ? dev.status === 'online' : true;
    const latency = dev?.responseTime && Number(dev.responseTime) > 0 ? Number(dev.responseTime) : (isOnline ? 18 : 0);
    return {
      success: true,
      data: {
        id: Number(id),
        nama: dev?.nama || 'Perangkat Demo',
        ip: dev?.ip || '192.168.1.1',
        alive: isOnline,
        status: isOnline ? 'online' : 'offline',
        time: latency,
        responseTime: latency,
        statusText: isOnline ? `${latency} ms` : 'Request Timeout (Simulasi)',
        method: (dev?.metode || 'PING').toUpperCase(),
      },
      alive: isOnline,
      status: isOnline ? 'online' : 'offline',
      time: latency,
      responseTime: latency,
      statusText: isOnline ? `${latency} ms` : 'Request Timeout (Simulasi)',
      method: (dev?.metode || 'PING').toUpperCase(),
    };
  }
  return request(`/devices/${id}/ping`, {
    method: 'POST',
  });
}

export async function apiTestConnection(payload) {
  if (_isCurrentSessionPreview()) {
    return {
      success: true,
      alive: true,
      time: 16,
      responseTime: 16,
      statusText: '16 ms (Uji Koneksi Mode Preview Berhasil)',
      protocol: payload.metode || 'PING',
    };
  }
  return request('/devices/test-connection', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiSetMaintenance(id, reason, durationMinutes = 120) {
  if (_isCurrentSessionPreview()) {
    const { updateDeviceStatus } = await import('./data/mock-devices.js');
    const until = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    updateDeviceStatus(Number(id), 'maintenance', { alasan: reason, selesai: until });
    window.dispatchEvent(new CustomEvent('devwatch:ui_update'));
    return { success: true };
  }
  return request(`/devices/${id}/maintenance`, {
    method: 'POST',
    body: JSON.stringify({ action: 'start', reason, durationMinutes }),
  });
}

export async function apiFinishMaintenance(id) {
  if (_isCurrentSessionPreview()) {
    const { updateDeviceStatus } = await import('./data/mock-devices.js');
    updateDeviceStatus(Number(id), 'online', null);
    window.dispatchEvent(new CustomEvent('devwatch:ui_update'));
    return { success: true };
  }
  return request(`/devices/${id}/maintenance`, {
    method: 'POST',
    body: JSON.stringify({ action: 'finish' }),
  });
}

export async function apiImportCsv(devices, mode = 'replace') {
  if (_isCurrentSessionPreview()) {
    const { mockDevices, addDevice } = await import('./data/mock-devices.js');

    // Buat peta perangkat yang sudah ada untuk pencocokan parent
    const ipMap = new Map();
    const nameMap = new Map();
    mockDevices.forEach((d) => {
      if (d.ip) ipMap.set(String(d.ip).trim(), d.id);
      if (d.nama) nameMap.set(String(d.nama).trim().toLowerCase(), d.id);
    });

    const pending = [];
    devices.forEach((d) => {
      const added = addDevice(d);
      if (added.ip) ipMap.set(String(added.ip).trim(), added.id);
      if (added.nama) nameMap.set(String(added.nama).trim().toLowerCase(), added.id);
      const parentRef = d.terhubung_ke || d.terhubungKe || d.parent_ip || d.parent || d.parent_id || d.parentId;
      if (parentRef) {
        pending.push({ item: added, parentRef: String(parentRef).trim() });
      }
    });

    // Pass 2: Hubungkan parent_id berdasarkan IP, Nama, atau ID
    pending.forEach(({ item, parentRef }) => {
      let resolvedParentId = null;
      const ipMatch = parentRef.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
      if (ipMatch && ipMap.has(ipMatch[0])) {
        resolvedParentId = ipMap.get(ipMatch[0]);
      } else if (nameMap.has(parentRef.toLowerCase())) {
        resolvedParentId = nameMap.get(parentRef.toLowerCase());
      } else {
        const cleanName = parentRef.replace(/\s*[\[\(].*?[\]\)]/g, '').trim().toLowerCase();
        if (cleanName && nameMap.has(cleanName)) {
          resolvedParentId = nameMap.get(cleanName);
        } else if (!isNaN(parseInt(parentRef, 10))) {
          const numId = parseInt(parentRef, 10);
          if (mockDevices.some((m) => m.id === numId)) {
            resolvedParentId = numId;
          }
        }
      }

      if (resolvedParentId && resolvedParentId !== item.id) {
        item.parent_id = resolvedParentId;
      }
    });

    window.dispatchEvent(new CustomEvent('devwatch:devices_updated', { detail: { action: 'import_csv', count: devices.length } }));
    window.dispatchEvent(new CustomEvent('devwatch:ui_update'));
    return { success: true, count: devices.length, imported: devices.length };
  }
  return request('/devices/import-csv', {
    method: 'POST',
    body: JSON.stringify({ devices, mode }),
  });
}

// ---- LOGS ----
export async function apiGetLogs(params = {}) {
  // Hapus key undefined/null/empty agar tidak terkirim sebagai string "undefined" ke server
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const query = new URLSearchParams(clean).toString();
  return request(`/logs${query ? `?${query}` : ''}`);
}

export async function apiGetLogDevices() {
  return request('/logs/devices');
}

export async function apiGetIsapiInfo(id) {
  if (_isCurrentSessionPreview()) {
    return {
      success: true,
      data: {
        supported: true,
        message: 'Endpoint ISAPI v2.0 (Simulasi Preview)',
        metadata: {
          model: 'DS-2CD2143G0-IS (Preview)',
          firmwareVersion: 'V5.6.80 build 210609',
          serialNumber: 'DS2CD2143G02026PREVIEW',
        },
      },
    };
  }
  return request(`/devices/${id}/isapi`);
}

export async function apiGetRtspStreamInfo(id) {
  if (_isCurrentSessionPreview()) {
    const { mockDevices } = await import('./data/mock-devices.js');
    const dev = mockDevices.find((d) => d.id === Number(id));
    const isOnline = dev ? dev.status === 'online' : true;
    return {
      success: true,
      data: {
        id: Number(id),
        nama: dev?.nama || 'CCTV RTSP Preview',
        ip: dev?.ip || 'rtsp://admin:adminWLptpn511@10.10.38.192:554/cam/realmonitor?channel=1&subtype=1',
        fullRtspUrl: dev?.ip || 'rtsp://admin:adminWLptpn511@10.10.38.192:554/cam/realmonitor?channel=1&subtype=1',
        currentLatencyMs: dev?.responseTime || 18,
        isOnline,
        profiles: [
          { name: 'Main Stream (1080p)', resolution: '1920x1080', fps: 30, bitrate: '4.1 Mbps', codec: 'H.264' },
          { name: 'Sub Stream (720p)', resolution: '1280x720', fps: 25, bitrate: '1.8 Mbps', codec: 'H.264' },
          { name: 'Mobile Stream (480p)', resolution: '640x480', fps: 15, bitrate: '600 Kbps', codec: 'H.264' },
        ],
      },
    };
  }
  return request(`/devices/${id}/rtsp-stream-info`);
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

// ---- USERS ----
export async function apiUpdateProfileAvatar(avatar) {
  return request('/users/profile/avatar', {
    method: 'PUT',
    body: JSON.stringify({ avatar }),
  });
}

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

export async function apiTriggerBackup(type = 'full') {
  return request(`/settings/backup?type=${encodeURIComponent(type)}`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}

export async function apiRestoreBackup(payload) {
  return request('/settings/restore', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiGetLogsStats() {
  if (_isCurrentSessionPreview()) {
    return {
      success: true,
      stats: {
        total: 20,
        oldestAll: new Date(Date.now() - 14400000).toISOString(),
        status: { count: 16, oldest: new Date(Date.now() - 14400000).toISOString() },
        activity: { count: 2, oldest: new Date(Date.now() - 3600000).toISOString() },
        config: { count: 2, oldest: new Date(Date.now() - 7200000).toISOString() },
      },
    };
  }
  return request('/settings/logs-stat');
}

export async function apiCleanLogs(retentionDays = 90) {
  if (_isCurrentSessionPreview()) {
    window.dispatchEvent(new CustomEvent('devwatch:logs_updated', { detail: { action: 'clean_logs', days: retentionDays } }));
    return {
      success: true,
      message: retentionDays === 0
        ? 'Seluruh riwayat log demo simulasi berhasil dibersihkan (20 baris dihapus).'
        : `Pembersihan log lama demo simulasi (> ${retentionDays} hari) selesai.`,
      deleted: {
        statusLogs: retentionDays === 0 ? 16 : 0,
        activityLogs: retentionDays === 0 ? 2 : 0,
        configLogs: retentionDays === 0 ? 2 : 0,
        total: retentionDays === 0 ? 20 : 0,
      },
    };
  }

  const payload = typeof retentionDays === 'object' && retentionDays !== null
    ? retentionDays
    : { retentionDays };

  return request('/settings/clean-logs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiPreviewCleanLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/settings/clean-logs/preview?${query}`, { method: 'GET' });
}

// ---- WEBSOCKET REAL-TIME LISTENER ----
export function isWsConnected() {
  return !!(wsInstance && wsInstance.readyState === WebSocket.OPEN);
}

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
      window.dispatchEvent(new CustomEvent('devwatch:ws_disconnected'));
      setTimeout(connectWebSocket, 3000);
    };

    wsInstance.onerror = () => {
      wsInstance = null;
      window.dispatchEvent(new CustomEvent('devwatch:ws_disconnected'));
    };
  } catch {
    wsInstance = null;
    window.dispatchEvent(new CustomEvent('devwatch:ws_disconnected'));
  }

  return wsInstance;
}
