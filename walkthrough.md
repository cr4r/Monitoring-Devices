# 🚀 Walkthrough: Implementasi Backend & Fullstack DevWatch Selesai

Backend mandiri untuk **DevWatch** telah selesai dibangun, terintegrasi penuh dengan frontend Vanilla JS, dan terverifikasi secara *end-to-end* sesuai spesifikasi [PRD_Device_Monitoring.md](file:///d:/Projek/WEB/Monitoring-Devices/PRD_Device_Monitoring.md).

---

## 🛠️ Ringkasan Pekerjaan & Arsitektur

### 1. Database SQLite Persisten Murni (`node:sqlite`)
- Menggunakan modul bawaan **Node.js v24 LTS** (`node:sqlite` / `DatabaseSync`) tanpa ketergantungan *native compilation* `node-gyp` maupun C++ compiler eksternal di Windows.
- Lokasi berkas database: [`data/devwatch.db`](file:///d:/Projek/WEB/Monitoring-Devices/data/devwatch.db).
- DDL 7 tabel relasional dibuat di [`server/database/schema.sql`](file:///d:/Projek/WEB/Monitoring-Devices/server/database/schema.sql):
  - `users` (Akun, peran, hash bcrypt)
  - `devices` (Perangkat, IP, port, interval, target SLA)
  - `device_status_logs` (Riwayat transisi status berbahasa Indonesia)
  - `user_activity_logs` (Audit trail pengguna)
  - `config_logs` (Log perubahan konfigurasi)
  - `incidents` (Rekap downtime dan durasi perbaikan)
  - `system_settings` (Konfigurasi umum & monitoring)
- Seeder otomatis di [`server/database/seed.js`](file:///d:/Projek/WEB/Monitoring-Devices/server/database/seed.js): 3 pengguna bawaan, 20 perangkat awal (10 PC + 10 CCTV Hikvision), serta riwayat log.

### 2. Engine Probe Jaringan Nyata Murni (No Mock Fallback)
- **Komputer / Server ([`server/services/pingService.js`](file:///d:/Projek/WEB/Monitoring-Devices/server/services/pingService.js))**:
  - Menjalankan native ICMP Ping via OS Windows `ping.exe -n 1 -w <timeout> <ip>`.
  - Mengurai latensi milidetik (*round-trip time*) dan status *timeout/unreachable*.
- **CCTV HIKVision ([`server/services/hikvisionService.js`](file:///d:/Projek/WEB/Monitoring-Devices/server/services/hikvisionService.js))**:
  - Melakukan probe HTTP ISAPI digest challenge (`/ISAPI/System/status` atau `/ISAPI/Streaming/channels`).
  - Melakukan probe TCP socket ke port RTSP (default 554).
  - Fallback ke ICMP ping jika HTTP/RTSP tidak merespons.
- **Worker & Anti-Flapping ([`server/services/monitoringWorker.js`](file:///d:/Projek/WEB/Monitoring-Devices/server/services/monitoringWorker.js))**:
  - Polling loop berjalan terus di latar belakang (evaluasi per 5 detik untuk perangkat yang jatuh tempo).
  - Toleransi kegagalan 3x berturut-turut (*debounce*) sebelum status diubah menjadi **OFFLINE**.
  - Otomatis mencatat transisi status ke `device_status_logs` dan membuka/menutup tiket `incidents`.

### 3. Komunikasi Real-Time WebSocket ([`server/services/websocketService.js`](file:///d:/Projek/WEB/Monitoring-Devices/server/services/websocketService.js))
- Server WebSocket mandiri di `/ws` (berbagi port HTTP 3000).
- Menyiarkan event `status_change` dan `telemetry` (latensi & waktu respons) ke seluruh peramban yang terhubung secara instan.

### 4. REST API & Middleware Keamanan
- Autentikasi JWT Bearer Token ([`server/middleware/auth.js`](file:///d:/Projek/WEB/Monitoring-Devices/server/middleware/auth.js)).
- Role-Based Access Control (Admin, Teknisi, Viewer).
- Proteksi Brute-Force Login ([`server/middleware/rateLimiter.js`](file:///d:/Projek/WEB/Monitoring-Devices/server/middleware/rateLimiter.js)): 5x kegagalan berturut-turut mengunci akun selama 15 menit.
- Seluruh rute CRUD, logs, reports, users, dan settings terdaftar di [`server/routes/`](file:///d:/Projek/WEB/Monitoring-Devices/server/routes/).

### 5. Windows Service Auto-Start
- [`server/scripts/install-service.js`](file:///d:/Projek/WEB/Monitoring-Devices/server/scripts/install-service.js): Daftarkan aplikasi ke Windows Service (`DevWatch Device Monitoring`).
- [`server/scripts/uninstall-service.js`](file:///d:/Projek/WEB/Monitoring-Devices/server/scripts/uninstall-service.js): Lepas instalasi service.

---

## 🔍 Hasil Pengujian & Verifikasi

### 1. Uji Login & Keamanan Token
- Endpoint: `POST /api/auth/login`
- Kredensial demo: `admin@kantor.com` / `admin123`
- Hasil: `200 OK`, JWT token berhasil diterbitkan dan divalidasi.

### 2. Uji Probe Jaringan Langsung
- Perangkat `127.0.0.1`: Respons latensi `1 ms` (Online ✅).
- Perangkat `192.168.1.30`: Respons `Timeout` (Offline ❌).

### 3. Uji Verifikasi Peramban (Browser Subagent E2E)
- **Halaman Login**: Formulir menerima input, auto-lockout aktif, pengalihan berhasil ke dashboard.
- **Dashboard**: Menampilkan metrik hidup (*Live*), kartu perangkat terhubung ke WebSocket, peta visual interaktif canvas, dan grafik timeline respons.
- **Manajemen Device**: Tabel 20 perangkat termuat, dialog tambah/edit/duplikat/hapus berfungsi, tombol **"Ping Langsung"** mengirim probe jaringan nyata ke server.
- **Log Sistem**: 3 tab (Status Device, Aktivitas User, Konfigurasi) menyajikan riwayat log persisten dari database.
- **Laporan & SLA**: Laporan mingguan dan persentase SLA termuat dengan grafik tren harian.
- **Manajemen Pengguna**: CRUD akun admin/teknisi/viewer dan reset password terintegrasi ke SQLite.
- **Pengaturan**: 6 tab pengaturan terhubung ke tabel `system_settings`.

---

## 🚀 Perintah Menjalankan Proyek

| Perintah | Deskripsi |
|---|---|
| `npm start` | **Mode Produksi**: Menjalankan server backend Express di `http://localhost:3000` (melayani API, WebSocket, dan frontend `dist/` sekaligus). |
| `npm run server` | Menjalankan server backend Express saja di port 3000. |
| `npm run dev` | Menjalankan Vite dev server di port 5173 dengan proxy otomatis ke port 3000. |
| `npm run build` | Membangun ulang bundle statis produksi ke folder `dist/`. |
| `npm run seed` | Mengisi ulang data demo awal ke database SQLite. |
| `npm run service:install` | Memasang DevWatch sebagai Windows Background Service (Administrator). |
| `npm run service:uninstall` | Menghapus DevWatch dari daftar Windows Service. |
