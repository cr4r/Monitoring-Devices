import { getSession } from '../main.js';
import { getDemoDevices } from './demoDevices.js';

export let mockDevices = [];

// Inisialisasi awal berdasarkan status sesi
const initialSession = getSession();
if (initialSession?.is_preview) {
  mockDevices = getDemoDevices();
}

// Helpers
export function getDeviceById(id) {
  return mockDevices.find((d) => d.id === id) || null;
}

export function getStatusCounts() {
  const online = mockDevices.filter((d) => d.status === 'online').length;
  const offline = mockDevices.filter((d) => d.status === 'offline').length;
  const maintenance = mockDevices.filter((d) => d.status === 'maintenance').length;
  return { total: mockDevices.length, online, offline, maintenance };
}

export function getGroups() {
  const list = [...new Set(mockDevices.map((d) => d.grup).filter(Boolean))].sort();
  return list.length > 0 ? list : ['Umum', 'Server Room', 'Lantai 1', 'Lantai 2'];
}

export function updateDeviceStatus(id, status, maintenanceInfo = null) {
  const dev = mockDevices.find((d) => d.id === id);
  if (dev) {
    dev.status = status;
    dev.maintenanceInfo = maintenanceInfo;
    if (status === 'online') {
      dev.lastOnline = new Date().toISOString();
    }
  }
}

export function addDevice(device) {
  const maxId = mockDevices.length > 0 ? Math.max(...mockDevices.map((d) => d.id)) : 0;
  const newDev = {
    ...device,
    id: device.id || maxId + 1,
    status: (device.status || 'offline').toLowerCase(),
    responseTime: device.responseTime || null,
    lastChecked: device.lastChecked || new Date().toISOString(),
    lastOnline: device.lastOnline || null,
    uptime24h: device.uptime24h || 99.0,
    maintenanceInfo: device.maintenanceInfo || null,
    mapPos: device.mapPos || { x: 200 + Math.random() * 400, y: 150 + Math.random() * 250 },
  };
  mockDevices.push(newDev);
  return newDev;
}

export function cleanDeviceIp(rawIp) {
  if (!rawIp) return '';
  const s = String(rawIp).trim();
  if (s.includes('://') || s.includes('@')) {
    const ipMatch = s.match(/@([a-zA-Z0-9.\-_]+)(?::\d+)?/);
    if (ipMatch) return ipMatch[1];
    try {
      const u = new URL(s.startsWith('rtsp://') ? s.replace('rtsp://', 'http://') : s);
      return u.hostname || s;
    } catch {}
  }
  return s;
}

export function deleteDevice(id) {
  mockDevices = mockDevices.filter((d) => d.id !== id);
}

export function duplicateDevice(id) {
  const src = mockDevices.find((d) => d.id === id);
  if (!src) return null;
  return addDevice({
    ...src,
    nama: `${src.nama} (Copy)`,
    ip: src.ip,
    id: undefined,
  });
}

/**
 * Sinkronisasi data perangkat:
 * - Mode Preview: Gunakan data demo lokal (tanpa kontak ke database)
 * - Mode Login Biasa: Sinkronisasi 100% dengan database SQLite melalui /api/devices
 */
export async function syncDevicesFromApi() {
  const session = getSession();

  // Mode Preview: Pertahankan atau muat data demo in-memory
  if (session?.is_preview) {
    if (mockDevices.length === 0) {
      mockDevices = getDemoDevices();
    }
    return;
  }

  try {
    const token = localStorage.getItem('devwatch_token') || '';
    const res = await fetch('/api/devices', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        const oldMap = new Map(mockDevices.map((d) => [d.id, d]));
        mockDevices = json.data.map((dbDev, i) => {
          const old = oldMap.get(dbDev.id);
          const rawStatus = (dbDev.status || 'offline').toLowerCase();
          const rawJenis = (dbDev.jenis || 'Komputer').toLowerCase();
          let jenis = 'komputer';
          if (rawJenis.includes('cctv')) jenis = 'cctv';
          else if (rawJenis.includes('router') || rawJenis.includes('gateway')) jenis = 'router';
          else if (rawJenis.includes('switch') || rawJenis.includes('hub')) jenis = 'switch';
          else if (rawJenis.includes('server')) jenis = 'server';
          else if (rawJenis.includes('access point') || rawJenis.includes('ap') || rawJenis.includes('wifi')) jenis = 'access point';

          return {
            id: dbDev.id,
            nama: dbDev.nama,
            jenis,
            jenisRaw: dbDev.jenis || 'Komputer',
            parent_id: dbDev.parent_id || null,
            ip: dbDev.ip,
            hostname: dbDev.hostname,
            metode: dbDev.metode?.toLowerCase() || 'ping',
            port: dbDev.port,
            interval: dbDev.interval_detik || 60,
            grup: dbDev.grup || 'Umum',
            lokasi: dbDev.lokasi || 'Kantor',
            deskripsi: dbDev.deskripsi || '',
            status: rawStatus === 'online' ? 'online' : (rawStatus === 'maintenance' ? 'maintenance' : 'offline'),
            responseTime: dbDev.response_time_ms || 0,
            lastChecked: dbDev.last_check || new Date().toISOString(),
            lastOnline: dbDev.last_seen_online || new Date().toISOString(),
            uptime24h: dbDev.target_sla || 99.0,
            active: dbDev.is_active === 1,
            created_at: dbDev.created_at || new Date().toISOString(),
            maintenanceInfo: dbDev.maintenance_reason
              ? { alasan: dbDev.maintenance_reason, selesai: dbDev.maintenance_until }
              : null,
            mapPos: old?.mapPos || {
              x: 120 + ((i * 140) % 720),
              y: 80 + (Math.floor(i / 5) * 110),
            },
          };
        });
      } else {
        mockDevices = [];
      }
    }
  } catch {
    // Mode offline / server tidak merespons
  }
}

// Sinkronisasi otomatis saat berkas dimuat jika bukan mode preview
if (!initialSession?.is_preview) {
  syncDevicesFromApi();
}

// Dengar event real-time dari WebSocket & perubahan sesi
if (typeof window !== 'undefined') {
  window.addEventListener('devwatch:session_change', (e) => {
    const sess = e.detail || getSession();
    if (sess?.is_preview) {
      mockDevices = getDemoDevices();
    } else {
      mockDevices = [];
      syncDevicesFromApi();
    }
    window.dispatchEvent(new CustomEvent('devwatch:ui_update'));
  });

  window.addEventListener('devwatch:status_change', (e) => {
    if (e.detail && e.detail.id) {
      updateDeviceStatus(e.detail.id, e.detail.status);
      window.dispatchEvent(new CustomEvent('devwatch:ui_update'));
    }
  });

  window.addEventListener('devwatch:telemetry', (e) => {
    if (e.detail && e.detail.id) {
      const dev = mockDevices.find((d) => d.id === e.detail.id);
      if (dev) {
        dev.responseTime = e.detail.responseTime;
        dev.status = e.detail.status;
      }
    }
  });

  window.addEventListener('devwatch:device_created', () => syncDevicesFromApi());
  window.addEventListener('devwatch:device_deleted', () => syncDevicesFromApi());
  window.addEventListener('devwatch:device_updated', () => syncDevicesFromApi());
}
