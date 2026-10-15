// ================================================================
// DevWatch — mock-devices.js
// 20 device mock: 10 PC Kantor + 10 CCTV Hikvision
// ================================================================

const now = new Date('2026-10-15T08:37:00+07:00');

function minsAgo(m) {
  return new Date(now.getTime() - m * 60000).toISOString();
}

export let mockDevices = [
  // ---- KOMPUTER KANTOR ----
  {
    id: 1,
    nama: 'PC Akuntansi 01',
    jenis: 'komputer',
    ip: '192.168.1.20',
    hostname: 'PC-AKUNTING-01',
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Lantai 1',
    lokasi: 'Ruang Akuntansi',
    deskripsi: 'Komputer milik staff akuntansi bagian laporan keuangan',
    status: 'online',
    responseTime: 4,
    lastChecked: minsAgo(0.5),
    lastOnline: minsAgo(0.5),
    uptime24h: 99.3,
    active: true,
    maintenanceInfo: null,
    credHikvision: null,
    mapPos: { x: 150, y: 120 },
  },
  {
    id: 2,
    nama: 'PC HRD Manager',
    jenis: 'komputer',
    ip: '192.168.1.21',
    hostname: 'PC-HRD-MGR',
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Lantai 1',
    lokasi: 'Ruang HRD',
    deskripsi: 'Komputer Manager HRD',
    status: 'online',
    responseTime: 7,
    lastChecked: minsAgo(0.8),
    lastOnline: minsAgo(0.8),
    uptime24h: 98.6,
    active: true,
    maintenanceInfo: null,
    credHikvision: null,
    mapPos: { x: 300, y: 100 },
  },
  {
    id: 3,
    nama: 'PC Server File',
    jenis: 'komputer',
    ip: '192.168.1.10',
    hostname: 'SERVER-FILE-01',
    metode: 'ping',
    port: null,
    interval: 30,
    grup: 'Server Room',
    lokasi: 'Server Room Lantai 2',
    deskripsi: 'File server utama kantor — tidak boleh offline',
    status: 'online',
    responseTime: 1,
    lastChecked: minsAgo(0.3),
    lastOnline: minsAgo(0.3),
    uptime24h: 100,
    active: true,
    maintenanceInfo: null,
    credHikvision: null,
    mapPos: { x: 450, y: 80 },
  },
  {
    id: 4,
    nama: 'PC Marketing 01',
    jenis: 'komputer',
    ip: '192.168.1.30',
    hostname: 'PC-MKTG-01',
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Lantai 2',
    lokasi: 'Ruang Marketing',
    deskripsi: 'Komputer staff marketing desain grafis',
    status: 'offline',
    responseTime: null,
    lastChecked: minsAgo(1),
    lastOnline: minsAgo(47),
    uptime24h: 96.7,
    active: true,
    maintenanceInfo: null,
    credHikvision: null,
    mapPos: { x: 600, y: 120 },
  },
  {
    id: 5,
    nama: 'PC Gudang',
    jenis: 'komputer',
    ip: '192.168.2.50',
    hostname: 'PC-GUDANG-01',
    metode: 'ping',
    port: null,
    interval: 120,
    grup: 'Gudang',
    lokasi: 'Gudang Lantai G',
    deskripsi: 'Komputer inventaris gudang',
    status: 'maintenance',
    responseTime: null,
    lastChecked: minsAgo(2),
    lastOnline: minsAgo(180),
    uptime24h: 88.5,
    active: true,
    maintenanceInfo: {
      alasan: 'Penggantian RAM dan SSD. Upgrade spesifikasi unit.',
      estimasiSelesai: new Date(now.getTime() + 2 * 60 * 60000).toISOString(),
      mulaiAt: minsAgo(120),
      oleh: 'Budi Santoso',
    },
    credHikvision: null,
    mapPos: { x: 150, y: 300 },
  },
  {
    id: 6,
    nama: 'PC Direktur',
    jenis: 'komputer',
    ip: '192.168.1.2',
    hostname: 'PC-DIREKTUR',
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Lantai 3',
    lokasi: 'Ruang Direktur',
    deskripsi: 'Komputer pribadi Direktur Utama',
    status: 'online',
    responseTime: 3,
    lastChecked: minsAgo(0.7),
    lastOnline: minsAgo(0.7),
    uptime24h: 99.8,
    active: true,
    maintenanceInfo: null,
    credHikvision: null,
    mapPos: { x: 300, y: 280 },
  },
  {
    id: 7,
    nama: 'PC Resepsionis',
    jenis: 'komputer',
    ip: '192.168.1.50',
    hostname: 'PC-RECEPTION',
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Lantai 1',
    lokasi: 'Meja Resepsionis',
    deskripsi: 'Komputer front desk untuk tamu dan absensi',
    status: 'online',
    responseTime: 12,
    lastChecked: minsAgo(0.9),
    lastOnline: minsAgo(0.9),
    uptime24h: 97.2,
    active: true,
    maintenanceInfo: null,
    credHikvision: null,
    mapPos: { x: 450, y: 300 },
  },
  {
    id: 8,
    nama: 'PC IT Support',
    jenis: 'komputer',
    ip: '192.168.1.9',
    hostname: 'PC-IT-SUPPORT',
    metode: 'ping',
    port: null,
    interval: 30,
    grup: 'IT Room',
    lokasi: 'Ruang IT Lantai 2',
    deskripsi: 'Komputer tim IT untuk monitoring dan support',
    status: 'online',
    responseTime: 2,
    lastChecked: minsAgo(0.4),
    lastOnline: minsAgo(0.4),
    uptime24h: 99.9,
    active: true,
    maintenanceInfo: null,
    credHikvision: null,
    mapPos: { x: 600, y: 280 },
  },
  {
    id: 9,
    nama: 'PC Keuangan 01',
    jenis: 'komputer',
    ip: '192.168.1.22',
    hostname: 'PC-FINANCE-01',
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Lantai 1',
    lokasi: 'Ruang Keuangan',
    deskripsi: 'Komputer staff keuangan payroll',
    status: 'offline',
    responseTime: null,
    lastChecked: minsAgo(1),
    lastOnline: minsAgo(125),
    uptime24h: 91.3,
    active: true,
    maintenanceInfo: null,
    credHikvision: null,
    mapPos: { x: 750, y: 100 },
  },
  {
    id: 10,
    nama: 'PC Marketing 02',
    jenis: 'komputer',
    ip: '192.168.1.31',
    hostname: 'PC-MKTG-02',
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Lantai 2',
    lokasi: 'Ruang Marketing',
    deskripsi: 'Komputer staff marketing digital campaign',
    status: 'online',
    responseTime: 9,
    lastChecked: minsAgo(0.6),
    lastOnline: minsAgo(0.6),
    uptime24h: 98.1,
    active: true,
    maintenanceInfo: null,
    credHikvision: null,
    mapPos: { x: 750, y: 300 },
  },

  // ---- CCTV HIKVISION ----
  {
    id: 11,
    nama: 'CCTV Lobby Lantai 1',
    jenis: 'cctv',
    ip: '192.168.1.101',
    hostname: null,
    metode: 'isapi',
    port: 80,
    interval: 60,
    grup: 'Lantai 1',
    lokasi: 'Lobby Utama',
    deskripsi: 'Kamera PTZ lobby utama, sudut pandang 360°',
    status: 'online',
    responseTime: 22,
    lastChecked: minsAgo(0.5),
    lastOnline: minsAgo(0.5),
    uptime24h: 99.5,
    active: true,
    maintenanceInfo: null,
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2DE4425IWG-E',
    mapPos: { x: 150, y: 450 },
  },
  {
    id: 12,
    nama: 'CCTV Parkiran Depan',
    jenis: 'cctv',
    ip: '192.168.1.102',
    hostname: null,
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Outdoor',
    lokasi: 'Parkiran Depan Gedung',
    deskripsi: 'Kamera outdoor area parkir kendaraan',
    status: 'online',
    responseTime: 18,
    lastChecked: minsAgo(0.8),
    lastOnline: minsAgo(0.8),
    uptime24h: 99.1,
    active: true,
    maintenanceInfo: null,
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2CD2143G2-I',
    mapPos: { x: 300, y: 450 },
  },
  {
    id: 13,
    nama: 'CCTV Gudang Barang',
    jenis: 'cctv',
    ip: '192.168.2.103',
    hostname: null,
    metode: 'isapi',
    port: 80,
    interval: 60,
    grup: 'Gudang',
    lokasi: 'Area Gudang Barang',
    deskripsi: 'Kamera pengawas gudang penyimpanan barang',
    status: 'offline',
    responseTime: null,
    lastChecked: minsAgo(1),
    lastOnline: minsAgo(65),
    uptime24h: 95.5,
    active: true,
    maintenanceInfo: null,
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2CD2143G2-I',
    mapPos: { x: 450, y: 450 },
  },
  {
    id: 14,
    nama: 'CCTV Koridor Lt.2',
    jenis: 'cctv',
    ip: '192.168.1.104',
    hostname: null,
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Lantai 2',
    lokasi: 'Koridor Lantai 2',
    deskripsi: 'Kamera fixed dome koridor utama lantai 2',
    status: 'online',
    responseTime: 14,
    lastChecked: minsAgo(0.6),
    lastOnline: minsAgo(0.6),
    uptime24h: 98.8,
    active: true,
    maintenanceInfo: null,
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2CD2125G0-IMS',
    mapPos: { x: 600, y: 450 },
  },
  {
    id: 15,
    nama: 'CCTV Ruang Server',
    jenis: 'cctv',
    ip: '192.168.1.105',
    hostname: null,
    metode: 'isapi',
    port: 80,
    interval: 30,
    grup: 'Server Room',
    lokasi: 'Server Room Lantai 2',
    deskripsi: 'Kamera keamanan ruang server — prioritas tinggi',
    status: 'online',
    responseTime: 8,
    lastChecked: minsAgo(0.4),
    lastOnline: minsAgo(0.4),
    uptime24h: 100,
    active: true,
    maintenanceInfo: null,
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2CD2143G2-I',
    mapPos: { x: 750, y: 450 },
  },
  {
    id: 16,
    nama: 'CCTV Parkiran Belakang',
    jenis: 'cctv',
    ip: '192.168.1.106',
    hostname: null,
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Outdoor',
    lokasi: 'Parkiran Belakang Gedung',
    deskripsi: 'Area parkiran belakang dan pintu service',
    status: 'maintenance',
    responseTime: null,
    lastChecked: minsAgo(1),
    lastOnline: minsAgo(200),
    uptime24h: 87.4,
    active: true,
    maintenanceInfo: {
      alasan: 'Pembersihan lensa dan kalibrasi sudut kamera.',
      estimasiSelesai: new Date(now.getTime() + 45 * 60000).toISOString(),
      mulaiAt: minsAgo(75),
      oleh: 'Budi Santoso',
    },
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2CD2T83G2-4I',
    mapPos: { x: 150, y: 580 },
  },
  {
    id: 17,
    nama: 'CCTV Ruang Rapat Besar',
    jenis: 'cctv',
    ip: '192.168.1.107',
    hostname: null,
    metode: 'isapi',
    port: 80,
    interval: 60,
    grup: 'Lantai 3',
    lokasi: 'Ruang Rapat Utama Lt.3',
    deskripsi: 'Kamera ruang rapat untuk rekaman meeting penting',
    status: 'online',
    responseTime: 25,
    lastChecked: minsAgo(0.7),
    lastOnline: minsAgo(0.7),
    uptime24h: 99.2,
    active: true,
    maintenanceInfo: null,
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2DE4225IWG-E',
    mapPos: { x: 300, y: 580 },
  },
  {
    id: 18,
    nama: 'CCTV Pintu Masuk Utama',
    jenis: 'cctv',
    ip: '192.168.1.108',
    hostname: null,
    metode: 'ping',
    port: null,
    interval: 30,
    grup: 'Lantai 1',
    lokasi: 'Pintu Masuk Utama',
    deskripsi: 'Kamera akses utama gedung, full HD',
    status: 'online',
    responseTime: 11,
    lastChecked: minsAgo(0.4),
    lastOnline: minsAgo(0.4),
    uptime24h: 99.7,
    active: true,
    maintenanceInfo: null,
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2CD2T47G2-L',
    mapPos: { x: 450, y: 580 },
  },
  {
    id: 19,
    nama: 'CCTV Lantai 3 Koridor',
    jenis: 'cctv',
    ip: '192.168.1.109',
    hostname: null,
    metode: 'ping',
    port: null,
    interval: 60,
    grup: 'Lantai 3',
    lokasi: 'Koridor Lantai 3',
    deskripsi: 'Kamera pengawas koridor lantai 3',
    status: 'online',
    responseTime: 16,
    lastChecked: minsAgo(0.9),
    lastOnline: minsAgo(0.9),
    uptime24h: 97.8,
    active: true,
    maintenanceInfo: null,
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2CD2125G0-IMS',
    mapPos: { x: 600, y: 580 },
  },
  {
    id: 20,
    nama: 'CCTV Area Produksi',
    jenis: 'cctv',
    ip: '192.168.3.200',
    hostname: null,
    metode: 'isapi',
    port: 80,
    interval: 60,
    grup: 'Produksi',
    lokasi: 'Lantai G Area Produksi',
    deskripsi: 'Kamera pengawas area produksi — shift 24 jam',
    status: 'online',
    responseTime: 33,
    lastChecked: minsAgo(0.8),
    lastOnline: minsAgo(0.8),
    uptime24h: 98.9,
    active: true,
    maintenanceInfo: null,
    credHikvision: { username: 'admin', password: '***' },
    hikModel: 'DS-2CD2143G2-I',
    mapPos: { x: 750, y: 580 },
  },
];

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
  return [...new Set(mockDevices.map((d) => d.grup))].sort();
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
  const maxId = Math.max(...mockDevices.map((d) => d.id));
  const newDev = {
    ...device,
    id: maxId + 1,
    status: 'offline',
    responseTime: null,
    lastChecked: null,
    lastOnline: null,
    uptime24h: 0,
    maintenanceInfo: null,
    mapPos: { x: 200 + Math.random() * 400, y: 200 + Math.random() * 300 },
  };
  mockDevices.push(newDev);
  return newDev;
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
 * Sinkronisasi data perangkat dari backend SQLite jika backend aktif
 */
export async function syncDevicesFromApi() {
  try {
    const token = localStorage.getItem('devwatch_token') || '';
    const res = await fetch('/api/devices', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        // Gabungkan data backend ke mockDevices
        json.data.forEach((dbDev) => {
          const idx = mockDevices.findIndex((d) => d.id === dbDev.id);
          const mapped = {
            id: dbDev.id,
            nama: dbDev.nama,
            jenis: dbDev.jenis?.toLowerCase()?.includes('cctv') ? 'cctv' : 'komputer',
            ip: dbDev.ip,
            hostname: dbDev.hostname,
            metode: dbDev.metode?.toLowerCase() || 'ping',
            port: dbDev.port,
            interval: dbDev.interval_detik || 60,
            grup: dbDev.grup || 'Umum',
            lokasi: dbDev.lokasi || 'Kantor',
            deskripsi: dbDev.deskripsi || '',
            status: dbDev.status || 'offline',
            responseTime: dbDev.response_time_ms || 0,
            lastChecked: dbDev.last_check || new Date().toISOString(),
            lastOnline: dbDev.last_seen_online || new Date().toISOString(),
            uptime24h: dbDev.target_sla || 99.0,
            active: dbDev.is_active === 1,
            maintenanceInfo: dbDev.maintenance_reason
              ? { alasan: dbDev.maintenance_reason, selesai: dbDev.maintenance_until }
              : null,
            mapPos: mockDevices[idx]?.mapPos || {
              x: 180 + Math.random() * 450,
              y: 120 + Math.random() * 320,
            },
          };

          if (idx >= 0) {
            mockDevices[idx] = { ...mockDevices[idx], ...mapped };
          } else {
            mockDevices.push(mapped);
          }
        });

        // Hapus perangkat yang sudah dihapus di backend
        const backendIds = new Set(json.data.map((d) => d.id));
        mockDevices = mockDevices.filter((d) => backendIds.has(d.id));
      }
    }
  } catch {
    // Mode offline: tetap gunakan data memori
  }
}

// Sinkronisasi otomatis saat berkas dimuat
syncDevicesFromApi();

// Dengar event real-time dari WebSocket
if (typeof window !== 'undefined') {
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

