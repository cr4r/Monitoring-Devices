// ================================================================
// DevWatch - mock-reports.js
// Data uptime, SLA, insiden, laporan mingguan
// ================================================================

import { mockDevices } from './mock-devices.js';

export const uptimePerDevice = [
  { deviceId: 1, nama: 'PC Akuntansi 01', uptime24h: 99.3, uptime7d: 98.8, uptime30d: 97.5, slaTarget: 99, grup: 'Lantai 1' },
  { deviceId: 2, nama: 'PC HRD Manager', uptime24h: 98.6, uptime7d: 97.9, uptime30d: 96.8, slaTarget: 99, grup: 'Lantai 1' },
  { deviceId: 3, nama: 'PC Server File', uptime24h: 100, uptime7d: 99.8, uptime30d: 99.5, slaTarget: 99.9, grup: 'Server Room' },
  { deviceId: 4, nama: 'PC Marketing 01', uptime24h: 96.7, uptime7d: 95.1, uptime30d: 94.3, slaTarget: 95, grup: 'Lantai 2' },
  { deviceId: 5, nama: 'PC Gudang', uptime24h: 88.5, uptime7d: 90.2, uptime30d: 92.1, slaTarget: 95, grup: 'Gudang' },
  { deviceId: 6, nama: 'PC Direktur', uptime24h: 99.8, uptime7d: 99.5, uptime30d: 99.2, slaTarget: 99, grup: 'Lantai 3' },
  { deviceId: 7, nama: 'PC Resepsionis', uptime24h: 97.2, uptime7d: 96.8, uptime30d: 96.3, slaTarget: 95, grup: 'Lantai 1' },
  { deviceId: 8, nama: 'PC IT Support', uptime24h: 99.9, uptime7d: 99.7, uptime30d: 99.6, slaTarget: 99, grup: 'IT Room' },
  { deviceId: 9, nama: 'PC Keuangan 01', uptime24h: 91.3, uptime7d: 93.5, uptime30d: 95.8, slaTarget: 99, grup: 'Lantai 1' },
  { deviceId: 10, nama: 'PC Marketing 02', uptime24h: 98.1, uptime7d: 97.4, uptime30d: 96.9, slaTarget: 95, grup: 'Lantai 2' },
  { deviceId: 11, nama: 'CCTV Lobby Lantai 1', uptime24h: 99.5, uptime7d: 98.9, uptime30d: 98.5, slaTarget: 99, grup: 'Lantai 1' },
  { deviceId: 12, nama: 'CCTV Parkiran Depan', uptime24h: 99.1, uptime7d: 98.6, uptime30d: 97.9, slaTarget: 99, grup: 'Outdoor' },
  { deviceId: 13, nama: 'CCTV Gudang Barang', uptime24h: 95.5, uptime7d: 94.8, uptime30d: 96.2, slaTarget: 95, grup: 'Gudang' },
  { deviceId: 14, nama: 'CCTV Koridor Lt.2', uptime24h: 98.8, uptime7d: 98.3, uptime30d: 97.7, slaTarget: 99, grup: 'Lantai 2' },
  { deviceId: 15, nama: 'CCTV Ruang Server', uptime24h: 100, uptime7d: 99.9, uptime30d: 99.7, slaTarget: 99.9, grup: 'Server Room' },
  { deviceId: 16, nama: 'CCTV Parkiran Belakang', uptime24h: 87.4, uptime7d: 89.1, uptime30d: 91.5, slaTarget: 95, grup: 'Outdoor' },
  { deviceId: 17, nama: 'CCTV Ruang Rapat Besar', uptime24h: 99.2, uptime7d: 98.8, uptime30d: 98.2, slaTarget: 99, grup: 'Lantai 3' },
  { deviceId: 18, nama: 'CCTV Pintu Masuk Utama', uptime24h: 99.7, uptime7d: 99.4, uptime30d: 99.1, slaTarget: 99.9, grup: 'Lantai 1' },
  { deviceId: 19, nama: 'CCTV Lantai 3 Koridor', uptime24h: 97.8, uptime7d: 97.2, uptime30d: 96.8, slaTarget: 95, grup: 'Lantai 3' },
  { deviceId: 20, nama: 'CCTV Area Produksi', uptime24h: 98.9, uptime7d: 98.1, uptime30d: 97.6, slaTarget: 99, grup: 'Produksi' },
];

export const insiden = [
  {
    id: 1,
    deviceId: 4,
    device: 'PC Marketing 01',
    ip: '192.168.1.30',
    mulai: '2026-10-15T06:50:00+07:00',
    selesai: null,
    durasi: null,
    status: 'Sedang berlangsung',
    penyebab: 'Tidak merespons ping. Kemungkinan mati atau jaringan terputus.',
    tipe: 'offline',
  },
  {
    id: 2,
    deviceId: 9,
    device: 'PC Keuangan 01',
    ip: '192.168.1.22',
    mulai: '2026-10-15T06:32:00+07:00',
    selesai: null,
    durasi: null,
    status: 'Sedang berlangsung',
    penyebab: 'Tidak merespons ping.',
    tipe: 'offline',
  },
  {
    id: 3,
    deviceId: 13,
    device: 'CCTV Gudang Barang',
    ip: '192.168.2.103',
    mulai: '2026-10-15T07:32:00+07:00',
    selesai: null,
    durasi: null,
    status: 'Sedang berlangsung',
    penyebab: 'ISAPI Connection Refused. Kamera mungkin restart atau power issue.',
    tipe: 'offline',
  },
  {
    id: 4,
    deviceId: 3,
    device: 'PC Server File',
    ip: '192.168.1.10',
    mulai: '2026-10-15T02:27:00+07:00',
    selesai: '2026-10-15T02:30:00+07:00',
    durasi: '3 menit',
    status: 'Selesai',
    penyebab: 'Restart otomatis akibat Windows Update. Pulih sendiri tanpa intervensi.',
    tipe: 'offline',
  },
  {
    id: 5,
    deviceId: 11,
    device: 'CCTV Lobby Lantai 1',
    ip: '192.168.1.101',
    mulai: '2026-10-14T08:17:00+07:00',
    selesai: '2026-10-14T08:37:00+07:00',
    durasi: '20 menit',
    status: 'Selesai',
    penyebab: 'Kamera tidak merespons ISAPI. Teknisi melakukan restart kamera dari tempat.',
    tipe: 'offline',
  },
  {
    id: 6,
    deviceId: 4,
    device: 'PC Marketing 01',
    ip: '192.168.1.30',
    mulai: '2026-10-14T14:00:00+07:00',
    selesai: '2026-10-14T19:05:00+07:00',
    durasi: '5 jam 5 menit',
    status: 'Selesai',
    penyebab: 'User sengaja mematikan komputer sebelum pulang. Tidak ada intervensi diperlukan.',
    tipe: 'offline',
  },
  {
    id: 7,
    deviceId: 9,
    device: 'PC Keuangan 01',
    ip: '192.168.1.22',
    mulai: '2026-10-14T12:45:00+07:00',
    selesai: '2026-10-14T13:30:00+07:00',
    durasi: '45 menit',
    status: 'Selesai',
    penyebab: 'Komputer dimatikan saat jam istirahat makan siang.',
    tipe: 'offline',
  },
  {
    id: 8,
    deviceId: 20,
    device: 'CCTV Area Produksi',
    ip: '192.168.3.200',
    mulai: '2026-10-14T22:10:00+07:00',
    selesai: '2026-10-14T23:50:00+07:00',
    durasi: '1 jam 40 menit',
    status: 'Selesai',
    penyebab: 'Listrik area produksi mati sementara. UPS tidak mencukupi.',
    tipe: 'offline',
  },
];

export const weeklyReport = {
  periode: '7 – 13 Oktober 2026',
  generatedAt: '2026-10-14T07:00:00+07:00',
  ringkasan: {
    totalDevice: 20,
    rataUptimeOnline: 97.8,
    totalInsiden: 12,
    insidenKritis: 2,
    deviceTerbaikUptime: 'PC Server File',
    deviceTerburuUptime: 'CCTV Parkiran Belakang',
    totalDowntimeJam: 18.5,
  },
  harian: [
    { hari: 'Senin 7 Okt', avgUptime: 98.2, insiden: 1 },
    { hari: 'Selasa 8 Okt', avgUptime: 97.5, insiden: 2 },
    { hari: 'Rabu 9 Okt', avgUptime: 99.1, insiden: 0 },
    { hari: 'Kamis 10 Okt', avgUptime: 96.8, insiden: 3 },
    { hari: 'Jumat 11 Okt', avgUptime: 98.5, insiden: 1 },
    { hari: 'Sabtu 12 Okt', avgUptime: 99.3, insiden: 0 },
    { hari: 'Minggu 13 Okt', avgUptime: 99.0, insiden: 1 },
  ],
};

// Generate timeline data 24 jam untuk 1 device
export function getTimeline24h(deviceId) {
  const dev = mockDevices.find((d) => d.id === deviceId);
  const now = new Date();
  let createdAt = new Date(0);
  if (dev && dev.created_at) {
    const raw = String(dev.created_at).trim();
    createdAt = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
    if (isNaN(createdAt.getTime())) createdAt = new Date(raw);
  } else if (!dev) {
    createdAt = now;
  }

  const hours = [];
  for (let i = 23; i >= 0; i--) {
    const hTime = new Date(now.getTime() - i * 3600000);
    const label = `${hTime.getHours().toString().padStart(2, '0')}:00`;
    if (hTime.getTime() + 3600000 < createdAt.getTime()) {
      hours.push({
        jam: label,
        status: 'nodata',
        responseTime: null,
      });
    } else {
      const isOnline = dev ? dev.status === 'online' : true;
      hours.push({
        jam: label,
        status: dev ? dev.status : 'online',
        responseTime: isOnline ? (dev?.responseTime || 4) : null,
      });
    }
  }
  return hours;
}
