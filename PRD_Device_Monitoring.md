# 📋 Product Requirements Document (PRD)
## DevWatch — Sistem Monitoring Device Jaringan
**Versi:** 1.0  
**Tanggal:** 14 Oktober 2026  
**Status:** Draft  
**Penulis:** Antigravity AI (berdasarkan sesi requirement gathering)

---

## 1. Ringkasan Eksekutif

**DevWatch** adalah aplikasi web monitoring device jaringan yang berjalan sebagai **Windows Service** di lingkungan kantor. Sistem ini memungkinkan tim IT untuk memantau status online/offline dari Komputer Kantor dan CCTV Hikvision secara real-time, baik melalui jaringan lokal maupun akses internet publik.

---

## 2. Tujuan Produk

| Tujuan | Deskripsi |
|--------|-----------|
| **Visibilitas** | Memberikan tampilan terpusat status seluruh device jaringan secara real-time |
| **Respons Cepat** | Mendeteksi dan memberitahu tim IT ketika device mengalami gangguan |
| **Akuntabilitas** | Menyediakan log lengkap yang bisa diaudit dan dipahami non-teknis |
| **Evaluasi** | Mengukur performa infrastruktur melalui laporan uptime & SLA |

---

## 3. Ruang Lingkup (Scope)

### ✅ Dalam Scope
- Monitoring 20–100 device (Komputer Kantor + CCTV Hikvision)
- Akses lokal dan publik (via domain/IP publik)
- Dashboard monitoring real-time
- Admin CMS lengkap
- Sistem log & laporan
- Notifikasi browser push
- Sweet alert

### ❌ Di Luar Scope (versi pertama)
- Integrasi cloud storage untuk rekaman CCTV
- Mobile app native (Android/iOS)
- Monitoring server Linux/Unix
- Pembayaran/billing system

---

## 4. Pengguna & Role

| Role | Deskripsi | Hak Akses |
|------|-----------|-----------|
| **Admin** | IT Manager / Kepala IT | Akses penuh: kelola device, user, konfigurasi sistem, lihat semua log |
| **Teknisi** | Staff IT / Network Engineer | Lihat semua, edit device terbatas, bisa set Maintenance Mode, lihat log |
| **Viewer** | Manager / Staf non-IT | Hanya bisa melihat dashboard dan laporan ringkasan |

---

## 5. Spesifikasi Teknis

### 5.1 Stack Teknologi

| Komponen | Teknologi |
|----------|-----------|
| **Backend** | Node.js + Express.js |
| **Frontend** | HTML5 + Vanilla CSS + JavaScript (Vanilla atau Vue.js ringan) |
| **Database** | SQLite (file-based, tanpa instalasi DB server) |
| **Runtime** | Windows Service (via `node-windows` atau `nssm`) |
| **Bahasa UI** | Bahasa Indonesia |

### 5.2 Metode Monitoring

#### Komputer Kantor
| Metode | Keterangan |
|--------|-----------|
| **ICMP Ping** | Cek sederhana apakah host merespons. Tidak perlu install software di target. |

#### CCTV Hikvision (Fleksibel/Bertingkat)
| Metode | Keterangan | Prioritas |
|--------|-----------|-----------|
| **ICMP Ping** | Pengecekan dasar online/offline | Utama |
| **Hikvision ISAPI** | REST API resmi Hikvision — ambil info device (model, status, storage) | Sekunder |
| **RTSP Stream Check** | Verifikasi apakah stream video aktif | Opsional |
| **ONVIF** | Protokol standar, kompatibilitas luas dengan brand lain | Opsional |

> **Catatan:** Sistem dirancang modular. Setiap device bisa dikonfigurasi metode pengecekannya masing-masing.

### 5.3 Interval Polling
- Default: **setiap 1 menit** per device
- Dapat dikonfigurasi per-device oleh Admin (30 detik – 10 menit)

### 5.4 Arsitektur Deployment

```
[Browser User]
      │
      ▼
[Reverse Proxy: Nginx / Caddy]
      │
      ▼
[Node.js Express App — Windows Service]
      │         │
      │         ▼
      │    [SQLite Database]
      │
      ▼
[Ping Engine / ISAPI Client / RTSP Checker]
      │
      ▼
[Network: LAN → Komputer Kantor + CCTV Hikvision]
```

**Akses Remote:** Via domain/IP publik yang sudah tersedia, dengan HTTPS (SSL/TLS wajib).

---

## 6. Fitur Utama

### 6.1 Dashboard Utama (Monitoring Real-Time)

**Tampilan Kombinasi Lengkap:**

- **Header Statistics:**
  - Total device terdaftar
  - Device online (jumlah & persentase)
  - Device offline
  - Device dalam Maintenance Mode

- **Tampilan Kartu (Card View):**
  - Setiap device ditampilkan sebagai kartu besar
  - Indikator status: 🟢 Online / 🔴 Offline / 🟡 Maintenance
  - Nama device, IP Address, kategori (PC / CCTV)
  - Terakhir dicek & last seen online
  - Tombol aksi cepat: Detail, Ping Manual, Set Maintenance

- **Tampilan Peta Visual (Network Map):**
  - Ikon device tersusun dalam diagram visual
  - Warna ikon sesuai status real-time
  - Garis koneksi antar node
  - Dapat di-zoom dan dipan

- **Grafik Timeline:**
  - Grafik per device: kapan online, kapan offline (24 jam terakhir)
  - Grafik agregat semua device (global uptime trend)

- **Filter & Pencarian:**
  - Filter berdasarkan: kategori (PC/CCTV), status, lokasi/grup
  - Pencarian by nama / IP address

---

### 6.2 Manajemen Device (Admin CMS)

**Halaman: Kelola Device**

| Field | Keterangan |
|-------|-----------|
| Nama Device | Nama deskriptif (contoh: "CCTV Lobby Lantai 1") |
| Jenis Device | Komputer / CCTV Hikvision |
| IP Address / Hostname | Alamat target monitoring |
| Metode Pengecekan | Ping / ISAPI / RTSP / ONVIF |
| Port (jika perlu) | Port untuk ISAPI/RTSP |
| Kredensial Hikvision | Username & Password (dienkripsi di DB) |
| Interval Polling | Per device, default 1 menit |
| Grup / Lokasi | Pengelompokan (misal: "Lantai 1", "Gudang") |
| Deskripsi | Catatan tambahan |
| Aktif / Nonaktif | Toggle monitoring |

**Fitur CRUD:** Tambah, Edit, Hapus, Duplikat device.

**Bulk Operations:** 
- Import device dari CSV
- Export daftar device ke CSV

---

### 6.3 Maintenance Mode 🔧

> **Fitur Rekomendasi #1 yang Dipilih**

**Alur Penggunaan:**
1. Teknisi/Admin klik tombol "Set Maintenance" pada device
2. Isi form: Alasan maintenance, estimasi selesai (tanggal & jam)
3. Device masuk status 🟡 Maintenance — tidak memicu alert meski offline
4. Setelah estimasi waktu lewat → notifikasi ke Teknisi untuk konfirmasi selesai
5. Teknisi klik "Selesai Maintenance" → device kembali ke monitoring normal
6. Semua aktivitas maintenance tercatat di log

**Tampilan di Dashboard:**
- Badge kuning "MAINTENANCE" pada kartu device
- Tooltip menampilkan alasan & estimasi selesai
- Countdown timer sampai estimasi selesai

---

### 6.4 Uptime Score & SLA Tracker 📊

> **Fitur Rekomendasi #2 yang Dipilih**

**Perhitungan Uptime:**
```
Uptime (%) = (Total waktu Online / Total waktu Monitoring) × 100
```
*Catatan: Waktu Maintenance tidak dihitung sebagai downtime*

**Tampilan per Device:**
- Uptime harian, mingguan, bulanan, custom range
- Badge warna: 🟢 > 99% | 🟡 95–99% | 🔴 < 95%
- Riwayat insiden (kapan offline, berapa lama)

**Laporan SLA:**
- Target SLA bisa dikonfigurasi per device atau per grup
- Laporan otomatis mingguan menampilkan pencapaian vs target SLA
- Export ke PDF

---

### 6.5 Sistem Notifikasi

**Push Notification Browser:**
- Izin push notification diminta saat login pertama
- Notifikasi muncul meski tab browser di-minimize
- Isi notifikasi: "⚠️ [Nama Device] OFFLINE sejak [jam]"
- Klik notifikasi → langsung ke halaman detail device

**Pengaturan Notifikasi (per user):**
- Pilih device mana yang dinotifikasi
- Jam kerja notifikasi (contoh: hanya jam 08.00–17.00)
- Frekuensi reminder (tidak spam: max 1 notif per event)

---

### 6.6 Log Sistem

#### Jenis Log yang Dicatat

**1. Log Status Device**
| Field | Contoh |
|-------|--------|
| Waktu | 14 Okt 2026 09:32:15 |
| Device | CCTV Lobby Lt.1 (192.168.1.101) |
| Status Sebelumnya | Online |
| Status Baru | Offline |
| Metode Cek | Ping |
| Response Time | Timeout |

**2. Log Aktivitas User**
| Field | Contoh |
|-------|--------|
| Waktu | 14 Okt 2026 08:00:03 |
| User | admin@kantor.com |
| Aksi | Login berhasil |
| IP Akses | 192.168.1.5 |

**3. Log Perubahan Konfigurasi**
| Field | Contoh |
|-------|--------|
| Waktu | 14 Okt 2026 10:15:22 |
| User | teknisi@kantor.com |
| Aksi | Edit Device |
| Detail | Interval polling diubah dari 1 menit → 30 detik |
| Device | Server File (192.168.1.10) |

#### Fitur Tampilan Log

- **Filter Fleksibel:** Berdasarkan jenis log, device, user, status, rentang tanggal
- **Pencarian teks** dalam log
- **Pagination** dengan pilihan 25/50/100 baris per halaman
- **Export:** Filter dulu, lalu export hasil filter ke PDF
- **Bahasa manusia:** Log ditulis dalam kalimat natural Bahasa Indonesia, bukan kode teknis
  - ❌ Bukan: `ICMP_TIMEOUT ERR:408`
  - ✅ Tapi: `Komputer Accounting (192.168.1.20) tidak merespons ping. Status berubah menjadi Offline.`
- **Color coding:** Entry offline → merah muda, online → hijau muda, maintenance → kuning muda

---

### 6.7 Pengaturan Sistem (Settings)

**Kategori Pengaturan:**

| Kategori | Item |
|----------|------|
| **Umum** | Nama aplikasi, logo, zona waktu, bahasa |
| **Monitoring** | Interval polling global default, timeout, retry count |
| **Notifikasi** | Konfigurasi push notification, jam kerja |
| **Keamanan** | Session timeout, kebijakan password, whitelist IP akses |
| **Log** | Retensi log (misal: simpan log 90 hari), auto-delete log lama |
| **Backup** | Jadwal backup database SQLite otomatis, lokasi backup |
| **Laporan** | Jadwal laporan mingguan otomatis, penerima laporan |
| **Tentang** | Versi aplikasi, lisensi |

---

### 6.8 Laporan (Reporting)

| Jenis Laporan | Deskripsi |
|---------------|-----------|
| **Laporan Mingguan Otomatis** | Digenerate setiap Senin pagi, tersedia di dashboard & bisa di-download PDF |
| **Laporan Uptime/SLA** | Per device atau semua device, pilih periode custom |
| **Laporan Insiden** | Daftar semua kejadian offline beserta durasi dan frekuensi |
| **Export Log Terfilter** | Filter log → Export ke PDF |

**Format Laporan PDF mencakup:**
- Header: Logo, nama laporan, periode, tanggal cetak
- Ringkasan eksekutif (total device, uptime rata-rata, insiden terbanyak)
- Tabel detail per device
- Grafik uptime visual
- Footer: Halaman & versi sistem

---

## 7. Alur Pengguna (User Flow)

### 7.1 Alur Login
```
Buka URL → Halaman Login → Input Email + Password
    → Autentikasi → (Berhasil) → Dashboard Utama
                  → (Gagal) → Pesan error + log gagal login
```

### 7.2 Alur Tambah Device Baru
```
Admin Login → Menu Kelola Device → Klik "Tambah Device"
    → Isi Form (nama, IP, jenis, metode cek)
    → Klik "Test Koneksi" → (berhasil) → Simpan
    → Device muncul di Dashboard → Monitoring dimulai otomatis
```

### 7.3 Alur Maintenance Mode
```
Teknisi melihat device akan dimatikan untuk maintenance
    → Klik "Set Maintenance" pada device
    → Isi: Alasan, estimasi selesai
    → Device status = Maintenance (tidak trigger alert)
    → Setelah estimasi lewat → notif reminder ke Teknisi
    → Teknisi klik "Selesai" → kembali normal
```

---

## 8. Keamanan

| Aspek | Implementasi |
|-------|-------------|
| **Autentikasi** | Email + Password dengan hashing bcrypt |
| **Sesi** | JWT Token dengan expiry configurable |
| **HTTPS** | Wajib untuk akses publik (SSL/TLS) |
| **Enkripsi Kredensial** | Password CCTV Hikvision disimpan terenkripsi (AES-256) |
| **Rate Limiting** | Batasi percobaan login (max 5x, lalu lockout 15 menit) |
| **Audit Log** | Semua aksi user dicatat (tidak bisa dihapus oleh non-admin) |
| **Whitelist IP** | Opsional: batasi akses admin hanya dari IP tertentu |

---

## 9. Tampilan & UX

### Tema Desain
- **Mode:** Dark mode sebagai default (lebih cocok untuk ruang monitoring)
- **Palet Warna:**
  - Background: `#0f1117` (sangat gelap)
  - Card: `#1a1d2e` (gelap lebih terang)
  - Online: `#22c55e` (hijau vibran)
  - Offline: `#ef4444` (merah terang)
  - Maintenance: `#eab308` (kuning amber)
  - Aksen: `#6366f1` (indigo/ungu)
- **Font:** Inter (Google Fonts)
- **Animasi:** Pulse pada indikator status, transisi smooth antar halaman

### Responsivitas
- Desktop (primary): 1920×1080 dan 1366×768
- Tablet: fungsi penuh (view only lebih diutamakan)
- Mobile: dashboard bisa dilihat, pengelolaan via desktop

---

## 10. Struktur Menu

```
📊 Dashboard
├── Tampilan Kartu
├── Peta Visual
└── Grafik Timeline

🖥️ Devices
├── Daftar Semua Device
├── Tambah Device
└── Grup & Lokasi

📋 Log
├── Log Status Device
├── Log Aktivitas User
└── Log Perubahan Konfigurasi

📈 Laporan
├── Laporan Mingguan
├── Laporan Uptime/SLA
└── Laporan Insiden

👥 Pengguna (Admin only)
├── Daftar User
├── Tambah User
└── Pengaturan Role

⚙️ Pengaturan
├── Umum
├── Monitoring
├── Notifikasi
├── Keamanan
├── Log & Backup
└── Laporan Terjadwal

ℹ️ Tentang
```

---

## 11. Milestone & Fase Pengembangan

### Fase 1 — Core Foundation (Minggu 1–3)
- [x] Setup project Node.js + Express + SQLite
- [x] Setup Windows Service (node-windows / nssm)
- [x] Sistem autentikasi (login, sesi, role)
- [x] Engine monitoring: ICMP Ping
- [x] API endpoint status device
- [x] Dashboard dasar (card view + status real-time)

### Fase 2 — Fitur Utama (Minggu 4–6)
- [x] CRUD manajemen device di CMS
- [x] Sistem log lengkap (3 jenis log)
- [x] Push notification browser
- [x] Maintenance Mode
- [x] Filter & pencarian log

### Fase 3 — Protokol Lanjutan (Minggu 7–8)
- [x] Integrasi ISAPI Hikvision
- [x] RTSP stream check
- [x] ONVIF support
- [x] Import device dari CSV

### Fase 4 — Laporan & Analytics (Minggu 9–10)
- [x] Uptime Score & SLA Tracker
- [x] Laporan mingguan otomatis
- [x] Export PDF (laporan + log)
- [x] Grafik timeline status

### Fase 5 — Polish & Pengujian (Minggu 11–12)
- [x] Network topology map visual
- [x] Pengaturan sistem lengkap
- [x] Pengujian beban (load testing)
- [x] Dokumentasi penggunaan
- [x] Deployment production dengan HTTPS

---

## 12. Risiko & Mitigasi

| Risiko | Kemungkinan | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| ICMP Ping diblokir firewall target | Sedang | Tinggi | Gunakan metode alternatif (port scan) sebagai fallback |
| ISAPI Hikvision versi tidak kompatibel | Sedang | Sedang | Uji dengan beberapa versi firmware, dokumentasikan versi yang didukung |
| SQLite terlalu lambat untuk 100 device × log 1 menit | Rendah | Sedang | Implementasi log rotation, arsip log lama ke file |
| Windows Service crash tanpa recovery | Rendah | Tinggi | Konfigurasi auto-restart, health check endpoint, monitoring uptime service itu sendiri |
| Akses publik disalahgunakan | Rendah | Tinggi | HTTPS wajib, rate limiting, opsional whitelist IP |

---

## 13. Glosarium

| Istilah | Penjelasan |
|---------|-----------|
| **ICMP Ping** | Cara sederhana mengirim sinyal ke device untuk cek apakah merespons |
| **ISAPI** | Antarmuka pemrograman kamera Hikvision untuk mengambil data melalui internet |
| **RTSP** | Protokol streaming video dari kamera IP |
| **ONVIF** | Standar industri untuk kamera IP agar kompatibel lintas merek |
| **SQLite** | Database ringan yang disimpan dalam satu file, tidak perlu server database terpisah |
| **Windows Service** | Program yang berjalan otomatis di background Windows sejak PC dinyalakan |
| **SLA** | Service Level Agreement — target persentase uptime yang disepakati |
| **JWT** | Metode autentikasi berbasis token untuk sesi pengguna |
| **Push Notification** | Notifikasi yang muncul di browser meski halaman web tidak aktif |
| **Maintenance Mode** | Status khusus device yang sedang dalam pemeliharaan, tidak memicu alert |

---

*Dokumen ini merupakan living document dan akan diperbarui seiring progress pengembangan.*

**Dibuat dengan:** Antigravity AI  
**Proyek:** DevWatch — Device Monitoring System  
**Lokasi Proyek:** `D:\Projek\WEB\Monitoring-Devices`
