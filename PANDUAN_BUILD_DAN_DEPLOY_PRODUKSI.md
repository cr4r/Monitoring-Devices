# 🚀 Panduan Lengkap Build & Deployment Produksi DevWatch

Dokumentasi resmi prosedur kompilasi (*build*), instalasi, konfigurasi, dan pengoperasian sistem pemantauan perangkat **DevWatch** pada lingkungan server produksi (*on-premise* kantor, Windows Server, Linux VM, maupun Cloud VPS).

---

## 📑 Daftar Isi
1. [Arsitektur & Konsep Produksi](#1-arsitektur--konsep-produksi)
2. [Kebutuhan Sistem & Spesifikasi Server](#2-kebutuhan-sistem--spesifikasi-server)
3. [Alur Build & Setup Langkah demi Langkah](#3-alur-build--setup-langkah-demi-langkah)
4. [Menjalankan di Latar Belakang (Daemon / Service)](#4-menjalankan-di-latar-belakang-daemon--service)
   - [Opsi A: Windows Service (node-windows & NSSM)](#opsi-a-windows-service-otomatis-boot)
   - [Opsi B: Process Manager PM2 (Multi-Platform)](#opsi-b-process-manager-pm2-multi-platform)
   - [Opsi C: Linux systemd Service](#opsi-c-linux-systemd-service)
5. [Konfigurasi Keamanan & Enkripsi HTTPS](#5-konfigurasi-keamanan--enkripsi-https)
   - [Mode 1: Native Node.js HTTPS](#mode-1-native-nodejs-https-tanpa-reverse-proxy)
   - [Mode 2: Reverse Proxy Caddy (Otomatis Let's Encrypt)](#mode-2-reverse-proxy-caddy-otomatis-lets-encrypt)
   - [Mode 3: Reverse Proxy Nginx](#mode-3-reverse-proxy-nginx)
6. [SOP Pemeliharaan, Pencadangan & Pembaruan Versi](#6-sop-pemeliharaan-pencadangan--pembaruan-versi)
7. [Diagnostik, Pemecahan Masalah & FAQ](#7-diagnostik-pemecahan-masalah--faq)

---

## 1. Arsitektur & Konsep Produksi

DevWatch mengusung pola **Fullstack Monolithic Terpadu** yang efisien dan tanpa dependensi kompilasi C++ berat (*zero node-gyp*):

```
┌─────────────────────────────────────────────────────────────┐
│                 Klien Peramban (Browser)                   │
│         Desktop / Tablet / Ponsel Jaringan Kantor          │
└──────────────┬──────────────────────────────▲───────────────┘
               │ HTTP REST Request            │ WebSocket Telemetri
               │                              │ (/ws)
┌──────────────▼──────────────────────────────┴───────────────┐
│                 DevWatch Server (Port 3000)                 │
│                                                             │
│  ┌────────────────────────┐    ┌─────────────────────────┐  │
│  │ Express 5 Static Server│    │ REST API & Auth Router  │  │
│  │ Menyajikan /dist SPA   │    │ JWT, RBAC, Rate Limiter │  │
│  └────────────────────────┘    └─────────────────────────┘  │
│  ┌────────────────────────┐    ┌─────────────────────────┐  │
│  │ WebSocket Server (ws)  │    │ Background Worker Engine│  │
│  │ Live broadcast telemetry│   │ ICMP Ping & ISAPI Probe │  │
│  └────────────────────────┘    └────────────┬────────────┘  │
│                                             │               │
│  ┌──────────────────────────────────────────▼────────────┐  │
│  │ Basis Data SQLite Persisten (node:sqlite DatabaseSync) │  │
│  │ WAL Mode + Auto Checkpoint (data/devwatch.db)         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Keunggulan Arsitektur Produksi:
- **Port Tunggal**: Express melayani antarmuka web statis (`dist/`), REST API (`/api/*`), dan WebSocket (`/ws`) secara bersamaan di port yang sama (default `3000`).
- **Tanpa Database Eksternal**: Menggunakan SQLite modern berkinerja tinggi bawaan Node 22/24 (`node:sqlite`) dengan Write-Ahead Logging (WAL) sehingga tidak memerlukan instalasi MySQL atau PostgreSQL terpisah.
- **Portabilitas Tinggi**: Seluruh data tersimpan dalam direktori [data/](file:///d:/Projek/WEB/Monitoring-Devices/data), memudahkan migrasi antar-mesin dan backup snapshot.

---

## 2. Kebutuhan Sistem & Spesifikasi Server

### A. Persyaratan Perangkat Keras (Hardware)
| Parameter | Kebutuhan Minimum | Rekomendasi Produksi (≥100 Device) |
|---|---|---|
| **CPU / Prosesor** | 1 Core vCPU (1.5 GHz) | 2 Core vCPU atau lebih tinggi |
| **RAM / Memori** | 512 MB | 1 GB – 2 GB |
| **Penyimpanan (Disk)**| 200 MB (aplikasi + node_modules) | 2 GB+ (menampung log 1 tahun) |
| **Jaringan** | Kartu Jaringan 100 Mbps LAN | Gigabit Ethernet (1000 Mbps) LAN |

### B. Persyaratan Perangkat Lunak (Software)
1. **Node.js**: **Versi 22.x atau 24.x LTS (WAJIB)**.
   *Periksa versi Node.js di server:*
   ```bash
   node -v
   # Output harus v22.x.x atau v24.x.x
   ```
   > [!IMPORTANT]
   > Versi Node.js di bawah v22 tidak memiliki modul bawaan `node:sqlite` sehingga server tidak akan dapat berjalan.

2. **Git**: Versi 2.30+ untuk mengambil kode sumber.
3. **Sistem Operasi**:
   - **Windows**: Windows 10, Windows 11, Windows Server 2016, 2019, 2022, 2025.
   - **Linux**: Ubuntu 20.04/22.04/24.04 LTS, Debian 11/12, AlmaLinux/Rocky Linux 8/9.

### C. Konfigurasi Port & Firewall
Pastikan port berikut diizinkan masuk (*inbound rule*) pada Firewall server:
- **Port 3000 TCP** (HTTP & WebSocket DevWatch default)
- **Port 3443 TCP** (Jika menggunakan Native HTTPS)
- **Port 80 & 443 TCP** (Jika menggunakan Reverse Proxy Caddy / Nginx)
- **ICMP Echo Request / Reply** (Harus diizinkan di jaringan agar server bisa melakukan ping ke target)

---

## 3. Alur Build & Setup Langkah demi Langkah

Lakukan urutan berikut langsung di server produksi:

### Langkah 1: Clone Repositori
```bash
git clone <URL_REPOSITORY_ANDA>
cd Monitoring-Devices
```

### Langkah 2: Pasang Dependensi
Gunakan `npm install` atau `npm ci` (disarankan untuk lingkungan produksi yang identik dengan package-lock):
```bash
npm install
```

### Langkah 3: Konfigurasi Variabel Lingkungan (`.env`)
Salin berkas template [.env-example](file:///d:/Projek/WEB/Monitoring-Devices/.env-example) menjadi `.env`:

**Di Windows (PowerShell):**
```powershell
Copy-Item .env-example .env
```

**Di Linux / Mac:**
```bash
cp .env-example .env
```

Buka berkas `.env` menggunakan teks editor (misalnya `notepad .env` atau `nano .env`) dan sesuaikan nilainya:
```env
# ================================================================
# KONFIGURASI SERVER PRODUKSI DEVAWTCH
# ================================================================
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# KUNCI KEAMANAN JWT (Ganti dengan teks acak panjang & rahasia!)
JWT_SECRET=GantiDenganStringRahasiaSangatPanjangMinimal32Karakter_2026!
JWT_EXPIRES_IN=24h

# PENYIMPANAN BASIS DATA SQLITE
DB_PATH=./data/devwatch.db

# PARAMETER ENGINE PEMANTAUAN
PING_TIMEOUT_MS=2000
DEFAULT_INTERVAL_SECONDS=30
FAILURE_THRESHOLD=3

# NATIVE ENKRIPSI HTTPS (Bila tidak memakai reverse proxy Caddy/Nginx)
USE_HTTPS=false
SSL_KEY_PATH=./ssl/server.key
SSL_CERT_PATH=./ssl/server.crt
```

### Langkah 4: Kompilasi Antarmuka Frontend (Build Vite)
Jalankan perintah build untuk mengompilasi seluruh kode Single Page Application ke direktori `dist/`:
```bash
npm run build
```
*Hasil proses:* Direktori `dist/` tercipta dengan berkas `index.html` dan bundel aset JavaScript/CSS yang sudah diminifikasi dan dioptimalkan untuk kecepatan akses peramban.

### Langkah 5: Inisialisasi & Seeding Basis Data
Jalankan skrip seeder untuk membuat tabel SQLite dan akun admin pertama kali:
```bash
npm run seed
```
*Hasil:* Berkas basis data `data/devwatch.db` terbuat secara otomatis dengan akun awal:
- **Email**: `admin@devwatch.local`
- **Kata Sandi**: `admin123`

### Langkah 6: Uji Coba Server Lokal
Uji apakah aplikasi berjalan sempurna sebelum didaftarkan sebagai background service:
```bash
npm start
```
Buka peramban di komputer lokal server: `http://localhost:3000`. Jika halaman login muncul dan login berhasil, tekan `Ctrl + C` di terminal untuk mematikan sesi uji coba, lalu lanjut ke Bab 4 untuk menjalankannya sebagai service permanen.

---

## 4. Menjalankan di Latar Belakang (Daemon / Service)

Aplikasi produksi **tidak boleh** dijalankan di jendela terminal biasa karena akan mati saat jendela ditutup atau pengguna logout. Gunakan salah satu metode di bawah ini:

### Opsi A: Windows Service (Otomatis Boot)

Sangat ideal untuk server berbasis Windows Server / Windows 10/11 di lingkungan kantor.

#### Metode 1: Menggunakan Skrip Bawaan `install-service.js`
1. Buka **PowerShell** atau **Command Prompt** dengan mengklik kanan lalu pilih **"Run as Administrator"**.
2. Masuk ke direktori proyek:
   ```powershell
   cd D:\Projek\WEB\Monitoring-Devices
   ```
3. Pasang dependensi `node-windows` (jika belum terpasang):
   ```powershell
   npm install -g node-windows
   ```
4. Jalankan perintah instalasi:
   ```powershell
   npm run service:install
   ```
5. Layanan Windows bernama **"DevWatch Device Monitor"** akan terpasang dan berstatus **Running**.
6. Untuk mencabut (*uninstall*) layanan jika ingin menghapus:
   ```powershell
   npm run service:uninstall
   ```

#### Metode 2: Menggunakan NSSM (Non-Sucking Service Manager) - *Paling Stabil & Populer*
Jika `node-windows` mengalami kendala hak akses administrator, gunakan NSSM:
1. Unduh `nssm.exe` dari situs resmi [nssm.cc](https://nssm.cc/download) dan tempatkan di folder `C:\Windows\System32` (atau folder aplikasi).
2. Buka **PowerShell Administrator**, lalu jalankan:
   ```powershell
   # 1. Daftarkan service
   nssm install DevWatch "node.exe" "server/index.js"

   # 2. Atur direktori kerja aplikasi
   nssm set DevWatch AppDirectory "D:\Projek\WEB\Monitoring-Devices"

   # 3. Atur otomatis berjalan saat Windows booting
   nssm set DevWatch Start SERVICE_AUTO_START

   # 4. Atur restart otomatis jika aplikasi mengalami crash
   nssm set DevWatch AppRestartDelay 5000

   # 5. Mulai service saat ini juga
   nssm start DevWatch
   ```
3. Periksa status di aplikasi **Services** Windows (`services.msc`) -> cari "DevWatch".

---

### Opsi B: Process Manager PM2 (Multi-Platform)

PM2 adalah pengelola proses Node.js standar industri yang bekerja mulus di Linux, Windows Server, dan macOS.

1. **Pasang PM2 secara global**:
   ```bash
   npm install -g pm2
   ```

2. **Mulai DevWatch di latar belakang**:
   ```bash
   pm2 start server/index.js --name "devwatch"
   ```

3. **Periksa status dan log**:
   ```bash
   # Melihat status proses, penggunaan CPU & RAM:
   pm2 status

   # Memantau log real-time:
   pm2 logs devwatch

   # Me-restart aplikasi:
   pm2 restart devwatch
   ```

4. **Kunci agar otomatis hidup saat server reboot**:
   ```bash
   pm2 save
   pm2 startup
   ```
   *(Salin dan jalankan perintah yang dicetak oleh PM2 pada terminal untuk mengonfigurasi startup script OS).*

---

### Opsi C: Linux systemd Service

Jika menggunakan distribusi Linux murni (Ubuntu Server, Debian, RHEL):

1. **Buat berkas service unit**:
   ```bash
   sudo nano /etc/systemd/system/devwatch.service
   ```

2. **Isikan konfigurasi berikut** (sesuaikan *User* dan direktori `/var/www/Monitoring-Devices`):
   ```ini
   [Unit]
   Description=DevWatch Network Device Monitoring System
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/Monitoring-Devices
   ExecStart=/usr/bin/node /var/www/Monitoring-Devices/server/index.js
   Restart=always
   RestartSec=5
   Environment=NODE_ENV=production
   Environment=PORT=3000

   # Izinkan ICMP Ping tanpa hak akses root
   AmbientCapabilities=CAP_NET_RAW

   [Install]
   WantedBy=multi-user.target
   ```

3. **Aktifkan dan jalankan service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable devwatch
   sudo systemctl start devwatch
   ```

4. **Melihat status dan log systemd**:
   ```bash
   sudo systemctl status devwatch
   sudo journalctl -u devwatch -f
   ```

---

## 5. Konfigurasi Keamanan & Enkripsi HTTPS

### Mode 1: Native Node.js HTTPS (Tanpa Reverse Proxy)
Sangat praktis untuk jaringan intranet tertutup kantor tanpa memerlukan domain publik atau Nginx:
1. Buat sertifikat SSL/TLS mandiri (Self-Signed RSA 2048-bit, berlaku 365 hari):
   ```bash
   npm run cert:generate
   ```
   *Berkas kunci privat dan sertifikat akan dibuat otomatis di `ssl/server.key` dan `ssl/server.crt`.*
2. Buka berkas `.env`, ubah:
   ```env
   USE_HTTPS=true
   PORT=3443
   SSL_KEY_PATH=./ssl/server.key
   SSL_CERT_PATH=./ssl/server.crt
   ```
3. Restart service DevWatch.
4. Akses antarmuka melalui peramban: `https://<IP-SERVER>:3443`.

---

### Mode 2: Reverse Proxy Caddy (Otomatis Let's Encrypt)
Caddy adalah reverse proxy modern dengan fitur sertifikat SSL otomatis gratis dari Let's Encrypt.
1. Pasang Caddy di server ([caddyserver.com](https://caddyserver.com/docs/install)).
2. Gunakan berkas konfigurasi siap pakai di [deployment/Caddyfile](file:///d:/Projek/WEB/Monitoring-Devices/deployment/Caddyfile):
   ```caddy
   monitoring.kantor.com {
       reverse_proxy 127.0.0.1:3000
   }
   ```
3. Jalankan Caddy:
   ```bash
   caddy run --config deployment/Caddyfile
   ```

---

### Mode 3: Reverse Proxy Nginx
Nginx cocok untuk infrastruktur korporat dengan beban trafik tinggi dan sertifikat SSL internal instansi:
1. Pasang Nginx di server (`sudo apt install nginx` atau unduh Nginx for Windows).
2. Salin template konfigurasi dari [deployment/nginx.conf](file:///d:/Projek/WEB/Monitoring-Devices/deployment/nginx.conf) ke folder konfigurasi Nginx (`/etc/nginx/sites-available/devwatch`).
3. Konfigurasi telah mencakup:
   - Header proxy WebSocket: `Upgrade $http_upgrade` & `Connection "Upgrade"`
   - Header keamanan Helmet & HSTS
   - Pemetaan rute API dan SPA fallback
4. Uji dan muat ulang Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## 6. SOP Pemeliharaan, Pencadangan & Pembaruan Versi

### A. Prosedur Pencadangan (*Backup Database*)
DevWatch menyediakan 3 cara pencadangan:

1. **Melalui Antarmuka Pengaturan Web (Rekomendasi)**:
   - Masuk sebagai Admin -> Menu **Pengaturan** -> Tab **Sistem & Database**.
   - Klik tombol **"Cadangkan Database Sekarang"**. Sistem akan mengeksekusi `PRAGMA wal_checkpoint(TRUNCATE)` untuk memastikan seluruh transaksi di RAM tersimpan rapi, lalu membuat salinan bertanggal di folder `data/backups/devwatch-backup-<timestamp>.sqlite`.
   - Klik tombol **"Unduh Berkas SQLite"** untuk mengunduhnya ke laptop teknisi.

2. **Pencadangan Otomatis Terjadwal (Cron / Windows Task Scheduler)**:
   Cukup buat script harian yang menyalin berkas `data/devwatch.db` ke folder arsip eksternal atau storage backup NAS.

### B. Prosedur Pembaruan Aplikasi (*Update Code*)
Saat ada pembaruan kode versi baru dari Git, lakukan prosedur berikut secara berurutan:

```bash
# 1. Hentikan service sementara agar database tidak sedang terkunci
pm2 stop devwatch
# (atau: nssm stop DevWatch / sudo systemctl stop devwatch)

# 2. Ambil pembaruan kode terbaru dari Git
git pull origin main

# 3. Perbarui dependensi jika ada pustaka baru
npm install

# 4. Bangun ulang bundel frontend Vite
npm run build

# 5. Jalankan seeder / migrasi jika ada kolom baru (aman & idempotent)
npm run seed

# 6. Jalankan kembali service
pm2 start devwatch
# (atau: nssm start DevWatch / sudo systemctl start devwatch)
```

### C. Prosedur Rollback Cepat (Jika Pembaruan Gagal)
Jika terjadi kendala pada versi baru:
```bash
git checkout <commit_hash_versi_sebelumnya>
npm run build
pm2 restart devwatch
```

---

## 7. Diagnostik, Pemecahan Masalah & FAQ

### Q1: Muncul galat `Cannot find module 'node:sqlite'` saat server dijalankan?
**Penyebab**: Server menjalankan Node.js versi 18 atau 20 (belum mendukung modul bawaan `node:sqlite`).
**Solusi**: Perbarui Node.js server ke **versi 22.x atau 24.x LTS**. Unduh dari [nodejs.org](https://nodejs.org).

### Q2: Status semua perangkat OFFLINE padahal IP bisa di-ping di CMD/Terminal?
**Penyebab**:
1. Batas toleransi *Ping Timeout* terlalu rendah (misal latensi jaringan kantor 2500ms sedangkan batas timeout 2000ms).
   - **Solusi**: Masuk ke menu **Pengaturan -> Monitoring**, naikkan *Ping Timeout* menjadi `4000` ms.
2. Pada server Linux, proses Node.js tidak memiliki hak istimewa *Raw Socket* untuk mengirim paket ICMP.
   - **Solusi**: Berikan kemampuan jaringan ke biner node:
     ```bash
     sudo setcap cap_net_raw+ep $(which node)
     ```

### Q3: Galat `Port 3000 is already in use` (EADDRINUSE)?
**Penyebab**: Ada proses DevWatch lama atau aplikasi lain yang sudah memakai port 3000.
**Solusi**:
- Di Windows: Buka Task Manager -> Tab Details -> Matikan proses `node.exe` yang aktif, atau jalankan di CMD Administrator:
  ```cmd
  netstat -ano | findstr :3000
  taskkill /PID <PID_TERKAIT> /F
  ```
- Di Linux:
  ```bash
  sudo fuser -k 3000/tcp
  ```
- Atau ganti port ke `3001` atau `8080` di berkas `.env`.

### Q4: WebSocket sering terputus (*Disconnected / Reconnecting*) saat menggunakan Nginx?
**Penyebab**: Nginx belum dikonfigurasi untuk meneruskan protokol HTTP Upgrade WebSocket.
**Solusi**: Pastikan blok `location /ws` pada berkas Nginx Anda memiliki parameter:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "Upgrade";
proxy_read_timeout 86400s;
```

### Q5: Saat halaman di-refresh di peramban, muncul galat 404 Not Found?
**Penyebab**: Permintaan rute URL SPA (seperti `/devices` atau `/reports`) tidak dialihkan kembali ke `index.html`.
**Solusi**: Pastikan Anda telah menjalankan `npm run build` sehingga folder `dist/` terbentuk. [server/index.js](file:///d:/Projek/WEB/Monitoring-Devices/server/index.js#L73-L84) telah memiliki middleware penanganan rute fallback otomatis yang mengarahkan seluruh rute non-API kembali ke `dist/index.html`.

---

*Buku Panduan ini merupakan bagian dari repositori resmi DevWatch. Untuk panduan operasional penggunaan menu antarmuka oleh staf, silakan baca [DOKUMENTASI_PENGGUNAAN.md](file:///d:/Projek/WEB/Monitoring-Devices/DOKUMENTASI_PENGGUNAAN.md).*
