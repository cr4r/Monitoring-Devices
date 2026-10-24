// ================================================================
// DevWatch - mock-users.js
// Data mock pengguna sistem (3 role)
// ================================================================

export const mockUsers = [
  {
    id: 1,
    nama: 'Ahmad Rizky',
    email: 'admin@kantor.com',
    password: 'admin123',
    role: 'admin',
    avatar: 'AR',
    status: 'aktif',
    lastLogin: '2026-10-15T08:00:03+07:00',
    ipAkses: '192.168.1.5',
    createdAt: '2026-01-01T00:00:00+07:00',
    notifSettings: {
      devices: 'all',
      jamKerja: { mulai: '07:00', selesai: '17:00' },
      enabled: true,
    },
  },
  {
    id: 2,
    nama: 'Budi Santoso',
    email: 'teknisi@kantor.com',
    password: 'teknisi123',
    role: 'teknisi',
    avatar: 'BS',
    status: 'aktif',
    lastLogin: '2026-10-15T07:45:11+07:00',
    ipAkses: '192.168.1.8',
    createdAt: '2026-02-10T00:00:00+07:00',
    notifSettings: {
      devices: 'all',
      jamKerja: { mulai: '08:00', selesai: '17:00' },
      enabled: true,
    },
  },
  {
    id: 3,
    nama: 'Citra Dewi',
    email: 'viewer@kantor.com',
    password: 'viewer123',
    role: 'viewer',
    avatar: 'CD',
    status: 'aktif',
    lastLogin: '2026-10-14T16:30:00+07:00',
    ipAkses: '192.168.1.15',
    createdAt: '2026-03-20T00:00:00+07:00',
    notifSettings: {
      devices: [],
      jamKerja: { mulai: '08:00', selesai: '17:00' },
      enabled: false,
    },
  },
  {
    id: 4,
    nama: 'Dian Pratama',
    email: 'dian@kantor.com',
    password: 'dian123',
    role: 'teknisi',
    avatar: 'DP',
    status: 'nonaktif',
    lastLogin: '2026-09-30T10:15:00+07:00',
    ipAkses: '192.168.1.20',
    createdAt: '2026-04-01T00:00:00+07:00',
    notifSettings: {
      devices: 'all',
      jamKerja: { mulai: '08:00', selesai: '17:00' },
      enabled: true,
    },
  },
];

export function getUserByEmail(email) {
  return mockUsers.find((u) => u.email === email) || null;
}

export function getRoleLabel(role) {
  const labels = { admin: 'Administrator', teknisi: 'Teknisi', viewer: 'Viewer' };
  return labels[role] || role;
}
