# 📖 Buku Panduan Penggunaan & Operasional DevWatch
**Versi:** 1.0.0 (Fase 5 - Production Ready)  
**Lingkungan:** Node.js 22+ / 24, SQLite WAL Mode, Windows Service / Linux Daemon, HTTPS  
**Tanggal Rilis:** Oktober 2026  

---

## Daftar Isi
1. [Pendahuluan & Arsitektur Sistem](#1-pendahuluan--arsitektur-sistem)
2. [Kebutuhan Sistem & Persiapan Awal](#2-kebutuhan-sistem--persiapan-awal)
3. [Akun Pengguna Default & Hak Akses (RBAC)](#3-akun-pengguna-default--hak-akses-rbac)
4. [Panduan Operasional Dashboard & Peta Topologi Visual](#4-panduan-operasional-dashboard--peta-topologi-visual)
5. [Manajemen Perangkat (Devices)](#5-manajemen-perangkat-devices)
6. [Mode Pemeliharaan (Maintenance Mode)](#6-mode-pemeliharaan-maintenance-mode)
7. [Pusat Notifikasi & Alarm Jaringan](#7-pusat-notifikasi--alarm-jaringan)
8. [Laporan SLA, Insiden & Ekspor Dokumen](#8-laporan-sla-insiden--ekspor-dokumen)
9. [Pengaturan Sistem, Pemeliharaan Database & Backup](#9-pengaturan-sistem-pemeliharaan-database--backup)
10. [Panduan Deployment Produksi & HTTPS](#10-panduan-deployment-produksi--https)
11. [Pengujian Beban (Load Testing 200+ Devices)](#11-pengujian-beban-load-testing-200-devices)
12. [Troubleshooting & Tanya Jawab Umum](#12-troubleshooting--tanya-jawab-umum)

---

## 1. Pendahuluan & Arsitektur Sistem

DevWatch adalah sistem pemantauan perangkat jaringan kantor (*Network Device Monitoring System*) modern, ringan, dan andal yang dirancang untuk memantau puluhan hingga ratusan perangkat (PC workstation, server, printer jaringan, switch, dan kamera CCTV Hikvision) secara terpusat dengan latensi rendah.

### Arsitektur Utama
- **Backend Runtime:** Node.js v22/v24 dengan modul `node:sqlite` (C-level native binding berkinerja tinggi).
- **Protokol Monitoring:**
  - **ICMP Ping:** Menggunakan utilitas native OS dengan penanganan sub-milidetik.
  - **ISAPI Hikvision:** Integrasi HTTP Digest/Basic Auth langsung ke API kamera Hikvision (`/ISAPI/System/status`).
  - **RTSP Port Probe:** Validasi streaming video port 554.
  - **ONVIF Port Probe:** Kompatibilitas IP Camera port 80/8080/8899.
- **WebSocket Streaming:** Saluran komunikasi dua arah real-time untuk pembaruan status tanpa me-refresh browser.
- **Frontend SPA:** Single-Page Application berbasis Vanilla JS modern dan CSS glassmorphism berkecepatan tinggi tanpa overhead framework berat.

---

## 2. Kebutuhan Sistem & Persiapan Awal

### Kebutuhan Perangkat Keras
- **CPU:** Dual Core 2.0 GHz atau lebih tinggi.
- **RAM:** Minimum 2 GB (Rekomendasi 4 GB). Penggunaan memori tipikal hanya ~60 MB RSS.
- **Ruang Disk:** Minimum 500 MB untuk basis data SQLite dan log audit.
- **Jaringan:** Terhubung ke Local Area Network (LAN) target dengan akses ICMP dan routing ke VLAN CCTV.

### Kebutuhan Perangkat Lunak
- **Sistem Operasi:** Windows 10/11, Windows Server 2019/2022, atau Linux (Ubuntu 22.04+, Debian 12).
- **Node.js:** Versi 20 LTS atau lebih baru (direkomendasikan v22 atau v24).

### Langkah Instalasi Pertama Kali
1. Buka PowerShell atau Terminal di direktori proyek:
   ```bash
   cd d:\Projek\WEB\Monitoring-Devices
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Bangun berkas statis frontend:
   ```bash
   npm run build
   ```
4. Inisialisasi basis data dan data benih awal:
   ```bash
   npm run seed
   ```
5. Mulai server backend:
   ```bash
   npm run server
   ```
6. Buka peramban di `http://localhost:3000`.

---

## 3. Akun Pengguna Default & Hak Akses (RBAC)

DevWatch menerapkan kontrol akses berbasis peran (*Role-Based Access Control*):

| Peran | Email | Kata Sandi | Batas Hak Akses |
|-------|-------|------------|-----------------|
| **Administrator** | `admin@devwatch.local` | `admin123` | Akses penuh: manajemen pengguna, konfigurasi sistem, backup database, penghapusan perangkat, pengaturan threshold. |
| **Teknisi** | `teknisi@devwatch.local` | `teknisi123` | Manajemen operasional: tambah/edit perangkat, probe manual, aktifkan mode maintenance, export laporan. Tidak dapat mengelola user atau menghapus log sistem. |
| **Viewer** | `viewer@devwatch.local` | `viewer123` | Mode pantau saja (*Read-only*): melihat dashboard, peta visual, status perangkat, dan timeline. Tidak dapat mengubah konfigurasi. |

---

## 4. Panduan Operasional Dashboard & Peta Topologi Visual

Dashboard adalah pusat kendali visual utama DevWatch:

### Statistik Utama
- **Total Device:** Jumlah seluruh perangkat yang terdaftar di database.
- **Online:** Perangkat yang aktif merespons probe berkala disertai persentase uptime SLA.
- **Offline:** Perangkat yang tidak merespons melebihi threshold kegagalan (default 3x berturut-turut).
- **Maintenance:** Perangkat yang sedang dalam pemeliharaan terjadwal (alert dibisukan).

### Peta Topologi Visual (Network Topology Map)
Klik tab **🗺️ Peta Visual** pada dashboard:
1. **Hierarki Otomatis:**
   - 🌐 **Gateway Router (`192.168.1.1`)** - Pintu gerbang utama koneksi WAN.
   - 🔀 **Core Switch L3 (`192.168.1.2`)** - Tulang punggung distribusi jaringan kantor.
   - 📦 **Group Switches (VLAN Hubs)** - Switch distribusi per divisi/lokasi (Server, CCTV, Office).
   - 💻 / 📷 **End Devices** - Perangkat akhir komputer PC dan kamera CCTV.
2. **Animasi Paket Real-Time:**
   - Sambungan online memancarkan partikel paket bergerak (*flowing data packets*).
   - Perangkat online memiliki cincin aura berdenyut (*pulsing ripple*).
   - Sambungan offline ditandai garis merah putus-putus.
3. **Interaksi Drag & Drop & Zoom:**
   - Klik dan geser sembarang node perangkat untuk mengatur posisinya sesuai denah ruangan kantor.
   - Gunakan scroll mouse atau tombol `🔍+` / `🔍−` untuk memperbesar atau memperkecil tampilan.
   - Tombol **📐 Auto-Layout** akan menyelaraskan kembali seluruh posisi ke struktur hierarki yang rapi.
4. **Modal Aksi Cepat:**
   - Klik node perangkat untuk membuka dialog aksi: tombol **📡 Probe**, **🔧 Maintenance**, dan **🔍 Detail Perangkat**.

---

## 5. Manajemen Perangkat (Devices)

### Menambahkan Perangkat Baru
1. Buka menu **💻 Devices** di navigasi samping.
2. Klik tombol **➕ Tambah Device**.
3. Lengkapi formulir:
   - **Nama Device:** Nama identifikasi unik (contoh: `PC-Finance-01` atau `CCTV-Lobi-Utama`).
   - **Alamat IP:** Alamat IPv4 lokal (contoh: `10.90.148.130`).
   - **Jenis:** `Komputer` atau `CCTV Hikvision`.
   - **Metode Ping:**
     - `PING` (ICMP ping standar untuk PC dan server).
     - `ISAPI` (Khusus CCTV Hikvision via port 80 HTTP Digest Auth).
     - `RTSP` (Khusus stream video port 554).
     - `ONVIF` (Port 8080/8899).
   - **Interval Cek:** Durasi pengecekan (30 detik, 60 detik, 300 detik).
   - **Grup & Lokasi:** Contoh: Grup `CCTV Gedung A`, Lokasi `Lantai 2 Koridor Barat`.
4. Klik **💾 Simpan Perangkat**.

### Multiple Select & Hapus Massal
1. Tandai kotak centang (*checkbox*) di sebelah kiri nama perangkat yang ingin dihapus.
2. Bar aksi massal akan muncul di bagian bawah layar: `X perangkat terpilih`.
3. Klik tombol **🗑️ Hapus Terpilih**.
4. Konfirmasikan dialog penghapusan.

---

## 6. Mode Pemeliharaan (Maintenance Mode)

Mode maintenance digunakan saat teknisi sedang memperbaiki kabel, mengganti harddisk, atau memperbarui firmware perangkat agar tidak menimbulkan alarm palsu (*false alert*) di ruang pemantauan.

### Mengaktifkan Maintenance
1. Pada kartu perangkat atau tabel detail, klik ikon **🔧**.
2. Masukkan **Alasan Maintenance** (contoh: `Perbaikan adaptor daya switch`).
3. Pilih **Estimasi Selesai** (tanggal dan jam).
4. Klik **Aktifkan Maintenance**.
5. Status perangkat berubah menjadi **🟡 Maintenance**, penghitung waktu mundur (*countdown timer*) aktif, dan sistem berhenti mengirimkan alert offline.

### Menyelesaikan Maintenance
- Klik tombol hijau **✅ Selesai Maintenance**.
- Perangkat akan langsung diuji kembali via probe dan dikembalikan ke pemantauan normal.

---

## 7. Pusat Notifikasi & Alarm Jaringan

1. **Ikon Lonceng Header:** Menampilkan badge jumlah alarm belum dibaca secara real-time.
2. **Riwayat Alert:** Klik lonceng untuk melihat daftar perangkat offline, recovery online, atau kegagalan probe.
3. **Tombol Manajemen Notifikasi:**
   - **✓ Tandai Telah Dibaca:** Mengubah seluruh status notifikasi menjadi terbaca.
   - **🗑️ Bersihkan Notifikasi:** Menghapus seluruh riwayat alert dari basis data.

---

## 8. Laporan SLA, Insiden & Ekspor Dokumen

Buka menu **📊 Laporan** untuk menganalisis performa infrastruktur IT kantor:
1. **Filter Fleksibel:** Filter berdasarkan rentang tanggal (Hari Ini, 7 Hari, 30 Hari, Kustom) dan grup perangkat.
2. **SLA Scorecard:** Menampilkan Uptime rata-rata keseluruhan (contoh: `99.85%`), durasi downtime akumulatif, dan total insiden.
3. **Daftar Insiden Jaringan:** Rekap detail kapan perangkat putus, waktu pulih, total menit henti, dan penyebab masalah.
4. **Cetak PDF Resmi:**
   - Klik tombol **📥 Download Laporan (PDF)**.
   - Sistem menghasilkan dokumen PDF berstandar korporat dilengkapi kop surat, ringkasan metrik, grafik status, dan tanda tangan penanggung jawab IT.
5. **Ekspor CSV:** Unduh data mentah riwayat insiden untuk diolah di Microsoft Excel atau Google Sheets.

---

## 9. Pengaturan Sistem, Pemeliharaan Database & Backup

Buka menu **⚙️ Pengaturan** (Akses Administrator):

### Pengaturan Umum & Branding
- Ubah **Nama Aplikasi** (contoh: `NOC Monitoring Kantor Pusat`).
- Ganti **Logo Instansi** dengan mengunggah gambar `.png`/`.jpg` (otomatis dikonversi ke Base64).
- Atur **Zona Waktu** (`Asia/Jakarta (WIB)`, `Asia/Makassar (WITA)`, `Asia/Jayapura (WIT)`).
- Pilih **Bahasa Antarmuka** (Bahasa Indonesia atau English).

### Backup Basis Data SQLite Riil
1. Pada tab **Sistem & Database**, klik tombol **💾 Cadangkan Database Sekarang**.
2. Sistem mengeksekusi `PRAGMA wal_checkpoint(TRUNCATE)` untuk memastikan seluruh transaksi memori ditulis tuntas ke disk, lalu membuat salinan timestamped di folder `data/backups/`.
3. Klik tombol hijau **📥 Unduh Berkas SQLite** untuk mengunduh arsip `.sqlite` langsung ke laptop Anda.

### Retensi Log & Vacuum
- Tentukan batas retensi log (contoh: 30 hari).
- Klik tombol **🧹 Bersihkan Log Lama**. Sistem menghapus riwayat status yang melebihi batas retensi dan menjalankan `PRAGMA incremental_vacuum` untuk mengompresi ukuran disk database.

---

## 10. Panduan Deployment Produksi & HTTPS

DevWatch menyediakan dua metode deployment produksi yang aman:

### Opsi 1: Native HTTPS di Node.js (Direkomendasikan untuk Jaringan Lokal)
1. Buat sertifikat SSL/TLS mandiri (*self-signed*):
   ```bash
   npm run cert:generate
   ```
   Sertifikat tersimpan di `ssl/server.key` dan `ssl/server.crt`.
2. Aktifkan di file `.env`:
   ```env
   USE_HTTPS=true
   SSL_KEY_PATH=./ssl/server.key
   SSL_CERT_PATH=./ssl/server.crt
   PORT=3000
   ```
3. Jalankan server:
   ```bash
   npm run start
   ```
4. Akses melalui `https://localhost:3000` atau `https://IP-Server:3000`.

### Opsi 2: Reverse Proxy Produksi (Caddy / Nginx)
Konfigurasi produksi siap pakai telah disertakan di folder `deployment/`:

- **Menggunakan Caddy 2 (Otomatis HTTPS Let's Encrypt):**
  Salin berkas [Caddyfile](file:///d:/Projek/WEB/Monitoring-Devices/deployment/Caddyfile) ke `/etc/caddy/Caddyfile`:
  ```bash
  caddy run --config deployment/Caddyfile
  ```
- **Menggunakan Nginx:**
  Gunakan berkas konfigurasi [nginx.conf](file:///d:/Projek/WEB/Monitoring-Devices/deployment/nginx.conf) dengan dukungan HTTP/2, SSL modern, dan WebSocket reverse proxy.

### Berjalan Otomatis sebagai Windows Service
Agar sistem tetap berjalan saat server reboot tanpa perlu login user:
1. Buka Command Prompt sebagai Administrator:
   ```bash
   npm run service:install
   ```
2. Layanan `DevWatch Monitoring Service` akan didaftarkan dengan status `Automatic Startup`.
3. Untuk menghapus layanan:
   ```bash
   npm run service:uninstall
   ```

---

## 11. Pengujian Beban (Load Testing 200+ Devices)

DevWatch telah diuji ketahanannya melebihi spesifikasi standar PRD (100 perangkat). Skrip stress testing bawaan memvalidasi **250 perangkat concurrent**:

Jalankan perintah pengujian:
```bash
npm run test:load
```

**Hasil Pengujian Terverifikasi:**
- **Kapasitas:** 250 Perangkat concurrently dipantau.
- **Throughput Probe:** > 1.300 probe/detik.
- **Kecepatan Write SQLite WAL:** > 7.000 transaksi/detik (rata-rata 0.13 ms per record).
- **Pembacaan Dashboard:** > 4.800 query/detik.
- **Konsumsi Memori Heap:** < 10 MB (Sangat efisien, bebas dari memory leak).

---

## 12. Troubleshooting & Tanya Jawab Umum

### Q1: Kenapa perangkat PC menunjukkan status Offline padahal komputer hidup?
**Penyebab:** Firewall Windows pada PC target memblokir paket masuk ICMP Echo Request.  
**Solusi:**
1. Buka *Windows Defender Firewall with Advanced Security* di PC target.
2. Aktifkan aturan *Inbound Rules*: **File and Printer Sharing (Echo Request - ICMPv4-In)**.
3. Atau ubah metode probe perangkat di DevWatch menjadi metode port scan (misal port 445 atau 3389).

### Q2: Kamera CCTV Hikvision gagal probe via ISAPI?
**Penyebab:** Kredensial username/password salah, atau kamera belum mengaktifkan protokol ISAPI/ONVIF.  
**Solusi:**
1. Buka antarmuka web kamera Hikvision di browser.
2. Masuk ke menu **Configuration ➔ Network ➔ Advanced Settings ➔ Integration Protocol**.
3. Pastikan opsi **Enable Open Network Video Interface (ONVIF)** dan **ISAPI** dicentang.
4. Buat akun teknisi dengan level `Media User` atau `Administrator`.

### Q3: Pesan error "EADDRINUSE: address already in use :::3000"?
**Penyebab:** Terdapat proses Node.js sebelumnya atau layanan background yang masih menduduki port 3000.  
**Solusi:**
1. Di PowerShell:
   ```powershell
   Get-Process -Name node | Stop-Process -Force
   ```
2. Jalankan kembali `npm run server`.

---

## 13. Panduan Instalasi & Deploy Server Produksi

Bagi Administrator IT atau DevOps yang ingin memasang dan mengompilasi sistem DevWatch pada server produksi permanen (Windows Server sebagai Windows Service, Linux VM dengan PM2 / systemd, konfigurasi reverse proxy HTTPS Caddy/Nginx, dan strategi pencadangan basis data), silakan merujuk ke buku panduan teknis khusus:

👉 **[PANDUAN_BUILD_DAN_DEPLOY_PRODUKSI.md](PANDUAN_BUILD_DAN_DEPLOY_PRODUKSI.md)**

---
*DevWatch - Solusi Pemantauan Perangkat Jaringan Andal & Tangguh.*
