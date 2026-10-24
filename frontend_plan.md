# Frontend Plan - DevWatch: Device Monitoring System

## Goal

Bangun frontend lengkap DevWatch sesuai PRD. Stack: **HTML5 + Vanilla CSS + Vanilla JS** + **Vite** sebagai build tool. UI dark mode premium, animasi smooth, Bahasa Indonesia, SweetAlert2 untuk semua notifikasi.

Scope: **pure frontend** dengan mock data (siap dihubungkan ke backend API Node.js + Express nantinya).

---

## User Review Required

> [!IMPORTANT]
> Frontend ini menggunakan **mock data (JSON)** - belum terhubung ke backend. Semua API call akan di-stub dengan data dummy supaya UI bisa berjalan dan didemonstrasikan sebelum backend selesai.

> [!IMPORTANT]
> Stack pilihan: **Vite + Vanilla JS** (bukan Vue/React). Lebih ringan, sesuai PRD. Kalau user mau Vue.js ringan, konfirmasi dulu.

> [!WARNING]
> **SweetAlert2** digunakan untuk semua popup/notifikasi sesuai instruksi di `Prompt.txt`. Ini termasuk konfirmasi hapus, set maintenance, error, dan success alert.

---

## Open Questions

> [!IMPORTANT]
> **Q1**: Apakah frontend ini harus berjalan via `vite dev server` (development) atau langsung `index.html` di browser (file-based, tanpa bundler)? Karena ada file `package.json` di workspace, kemungkinan user mau pakai Vite.

✅ **Confirmed:** pakai **Vite + Vanilla JS**. Network Map pakai **Canvas HTML5**. Semua halaman dibangun sekaligus.

---

## Proposed Changes

### 📁 Struktur Proyek

```
Monitoring-Devices/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js                  # Entry point, router init
│   ├── router.js                # Client-side SPA router
│   ├── styles/
│   │   ├── base.css             # Reset, variabel CSS, tipografi
│   │   ├── components.css       # Komponen reusable (card, badge, btn, table)
│   │   ├── layout.css           # Sidebar, topbar, layout grid
│   │   └── pages.css            # Style spesifik per halaman
│   ├── data/
│   │   ├── mock-devices.js      # Data mock device (PC + CCTV)
│   │   ├── mock-users.js        # Data mock user (3 role)
│   │   ├── mock-logs.js         # Data mock log status, aktivitas, konfigurasi
│   │   └── mock-reports.js      # Data mock laporan & uptime
│   ├── components/
│   │   ├── sidebar.js           # Komponen sidebar navigasi
│   │   ├── topbar.js            # Header + notifikasi + user info
│   │   ├── device-card.js       # Kartu device (status, actions)
│   │   ├── status-badge.js      # Badge Online/Offline/Maintenance
│   │   ├── modal.js             # Modal generic wrapper
│   │   └── charts.js            # Wrapper Chart.js (timeline, uptime)
│   └── pages/
│       ├── login.js             # Halaman login
│       ├── dashboard.js         # Dashboard utama (card + map + grafik)
│       ├── devices.js           # Daftar & CRUD device
│       ├── device-detail.js     # Detail 1 device + riwayat insiden
│       ├── logs.js              # Log sistem (3 tab)
│       ├── reports.js           # Laporan & SLA
│       ├── users.js             # Manajemen user (Admin only)
│       └── settings.js          # Pengaturan sistem
```

---

### 🎨 Design System (`base.css`)

Palet warna sesuai PRD:

```css
:root {
  --bg-primary: #0f1117;
  --bg-card: #1a1d2e;
  --bg-sidebar: #13151f;
  --color-online: #22c55e;
  --color-offline: #ef4444;
  --color-maintenance: #eab308;
  --color-accent: #6366f1;
  --color-text: #e2e8f0;
  --color-muted: #64748b;
  --font: 'Inter', sans-serif;
}
```

Animasi:
- **Pulse** pada indikator status (CSS keyframes)
- **Fade-in slide-up** saat page load
- **Hover glow** pada card device
- **Smooth sidebar transition**

---

### 🔐 Halaman Login (`login.js`)

- Form: Email + Password
- Validasi client-side + SweetAlert2 error
- Mock auth: cek email/password dari `mock-users.js`
- Simpan session ke `localStorage` (role, nama, token dummy)
- Rate limit simulasi: 5x gagal → SweetAlert warning "Akun terkunci 15 menit"

---

### 📊 Dashboard Utama (`dashboard.js`)

**Header Stats (4 card):**
| Card | Data |
|------|------|
| Total Device | `mock-devices.length` |
| Online | count status === 'online' |
| Offline | count status === 'offline' |
| Maintenance | count status === 'maintenance' |

**Tab view:**
1. **Kartu Device** - grid responsive, filter, search
2. **Peta Visual** - **Canvas HTML5** diagram node + garis koneksi (zoom/pan via mouse drag + scroll wheel)
3. **Grafik Timeline** - Chart.js bar chart 24 jam per device

**Filter:** Kategori (PC/CCTV), Status, Grup/Lokasi  
**Search:** Nama / IP address (live filter)

**Fitur kartu device:**
- Status indicator (pulse animasi)
- Nama, IP, Kategori, Last checked, Last seen online
- Tombol: 🔍 Detail | 📡 Ping Manual | 🔧 Set Maintenance
- Ping manual → SweetAlert loading → result (mock)
- Set Maintenance → SweetAlert form (alasan + estimasi)

---

### 🖥️ Manajemen Device (`devices.js`)

**Tabel device** dengan kolom: Nama, IP, Jenis, Metode, Interval, Grup, Status, Aksi

**CRUD:**
- **Tambah:** Modal form lengkap (semua field PRD) + "Test Koneksi" (mock ping)
- **Edit:** Pre-fill form
- **Hapus:** SweetAlert konfirmasi merah
- **Duplikat:** Copy device + rename

**Bulk:**
- Import CSV → parse + preview → konfirmasi
- Export CSV → generate + download

---

### 📋 Log Sistem (`logs.js`)

**3 Tab:**
1. Log Status Device
2. Log Aktivitas User
3. Log Perubahan Konfigurasi

**Filter:**
- Jenis log, device, user, status, rentang tanggal (date picker)
- Search teks

**Tampilan tabel:**
- Color coding: merah muda (offline), hijau muda (online), kuning muda (maintenance)
- Pesan natural Bahasa Indonesia
- Pagination: 25/50/100 per halaman

**Export:** Filter dulu → Export PDF (pakai `jsPDF`)

---

### 📈 Laporan (`reports.js`)

**Tab:**
1. Laporan Mingguan - tabel ringkasan + chart uptime
2. Uptime/SLA - per device, pilih periode, badge warna
3. Laporan Insiden - daftar offline events + durasi

**Export PDF** per laporan (header logo, tabel, grafik, footer halaman)

---

### 👥 Manajemen User (`users.js`)

Admin only. Tabel user: Nama, Email, Role, Status, Aksi.  
CRUD user + assign role (Admin/Teknisi/Viewer).

---

### ⚙️ Pengaturan (`settings.js`)

6 tab sesuai PRD:
- Umum, Monitoring, Notifikasi, Keamanan, Log & Backup, Laporan Terjadwal

Setiap section: form field + tombol Simpan → SweetAlert success.

---

### 🔧 Maintenance Mode Flow

1. Klik "Set Maintenance" di card → SweetAlert2 form (alasan + datetime picker)
2. Simpan → card berubah status kuning + badge "MAINTENANCE"
3. Countdown timer real-time di card (misal: "Selesai dalam 2j 15m")
4. Ketika timer habis → SweetAlert notification ke user
5. Klik "Selesai Maintenance" → SweetAlert konfirmasi → kembali monitoring

---

### 📦 Dependencies

```json
{
  "dependencies": {
    "chart.js": "^4.x",
    "sweetalert2": "^11.x"
  },
  "devDependencies": {
    "vite": "^5.x"
  }
}
```

- **Chart.js** - grafik uptime & timeline
- **SweetAlert2** - semua popup/notifikasi
- **jsPDF + html2canvas** - export PDF
- **Papa Parse** - parse CSV import

---

### 🗂️ File-by-File Summary

#### [NEW] `package.json`
Setup Vite project dengan semua dependencies di atas.

#### [NEW] `vite.config.js`
Config Vite minimal, base path `/`.

#### [NEW] `index.html`
Shell SPA: load Inter font, link CSS, `<div id="app">`, `<script src="/src/main.js">`.

#### [NEW] `src/main.js`
Init router, check auth session, render halaman awal.

#### [NEW] `src/router.js`
Hash-based router (`/#/dashboard`, `/#/devices`, dll). Guard: redirect ke login jika belum auth.

#### [NEW] `src/styles/base.css`
Design tokens, reset, tipografi Inter, animasi pulse.

#### [NEW] `src/styles/components.css`
Card, badge, button, input, table, modal, tabs, pagination.

#### [NEW] `src/styles/layout.css`
Sidebar fixed, topbar sticky, main content area, responsive breakpoints.

#### [NEW] `src/styles/pages.css`
Style khusus tiap halaman (login centered, dashboard grid, dll).

#### [NEW] `src/data/mock-devices.js`
~20 device mock (10 PC + 10 CCTV), berbagai status, grup/lokasi berbeda.

#### [NEW] `src/data/mock-users.js`
3 user: 1 Admin, 1 Teknisi, 1 Viewer, lengkap dengan password mock.

#### [NEW] `src/data/mock-logs.js`
50+ log entry mix 3 jenis log, dalam kalimat Bahasa Indonesia natural.

#### [NEW] `src/data/mock-reports.js`
Data uptime % per device, riwayat insiden, data mingguan.

#### [NEW] `src/components/sidebar.js`
Menu navigasi sesuai struktur PRD, highlight active, role-based menu (Users hanya Admin).

#### [NEW] `src/components/topbar.js`
Nama user, role badge, tombol notifikasi, dropdown logout.

#### [NEW] `src/components/device-card.js`
Render satu kartu device, status pulse, tombol aksi.

#### [NEW] `src/components/charts.js`
Wrapper Chart.js untuk timeline 24jam dan bar uptime.

#### [NEW] `src/pages/login.js`
Halaman login animated, mock auth, SweetAlert error.

#### [NEW] `src/pages/dashboard.js`
Header stats, 3 tab view (Card/Map/Timeline), filter, search.

#### [NEW] `src/pages/devices.js`
Tabel CRUD + bulk import/export.

#### [NEW] `src/pages/device-detail.js`
Detail satu device, grafik uptime, riwayat insiden, maintenance history.

#### [NEW] `src/pages/logs.js`
3 tab log, filter lengkap, color coded, pagination, export PDF.

#### [NEW] `src/pages/reports.js`
3 jenis laporan, chart, export PDF.

#### [NEW] `src/pages/users.js`
CRUD user, Admin only guard.

#### [NEW] `src/pages/settings.js`
6 tab pengaturan, form save dengan SweetAlert.

---

## Verification Plan

### Build Check
```bash
cd d:\Projek\WEB\Monitoring-Devices
npm install
npm run dev
```
Pastikan Vite server jalan di `http://localhost:5173`.

### Manual Verification

1. **Login**: Coba login dengan credential Admin → masuk dashboard
2. **Dashboard**: Kartu device muncul, filter berfungsi, search live
3. **Ping Manual**: Klik ping → SweetAlert loading → result
4. **Maintenance Mode**: Set maintenance → card berubah kuning → countdown muncul
5. **CRUD Device**: Tambah, edit, hapus device dengan SweetAlert konfirmasi
6. **Log**: Filter log + color coding + pagination
7. **Export PDF**: Klik export → file PDF di-download
8. **Import CSV**: Upload CSV device → preview → simpan
9. **Settings**: Simpan setting → SweetAlert success
10. **Role Guard**: Login sebagai Viewer → menu Users tidak muncul

### Responsive Check
Test di 1920px, 1366px, tablet (768px).
