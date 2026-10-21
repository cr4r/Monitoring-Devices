// ================================================================
// DevWatch — about.js
// Halaman tentang aplikasi & Pusat Buku Panduan Interaktif Lengkap
// ================================================================
import Swal from 'sweetalert2';

export function renderAbout() {
  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">ℹ️ Tentang Aplikasi & Panduan</h1>
          <p class="page-subtitle">Informasi sistem, teknologi, dan buku panduan operasional MonDev</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--spacing-lg);">
        <!-- Main about card -->
        <div class="card about-card">
          <div class="about-logo">📡</div>
          <h2 class="gradient-text" style="font-size:2rem; font-weight:800;">MonDev</h2>
          <p style="font-size:1rem; color:var(--color-text-secondary);">Device Network Monitoring System</p>
          <div class="about-version">v1.0.0</div>
          <div class="about-version" style="margin-top:4px;">Build: Oktober 2026</div>
          <div style="margin-top:10px; display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:20px; font-size:0.82rem; font-weight:700; background:rgba(99,102,241,0.15); color:#818cf8; border:1px solid rgba(99,102,241,0.3);">
            ✨ Pembuat Projek: Fatur
          </div>
          <p style="margin-top:16px; font-size:0.88rem; color:var(--color-muted); max-width:380px;">
            Sistem monitoring device jaringan kantor secara real-time. 
            Pantau status online/offline komputer, router, switch, dan CCTV RTSP/ISAPI dari satu dashboard terpusat.
          </p>
          <div class="about-stack">
            <span class="chip">Node.js</span>
            <span class="chip">Express.js</span>
            <span class="chip">SQLite (Native)</span>
            <span class="chip">Vite</span>
            <span class="chip">Vanilla JS</span>
            <span class="chip">Chart.js</span>
            <span class="chip">WebSocket Live</span>
            <span class="chip">Windows Service</span>
          </div>
        </div>

        <!-- Info cards -->
        <div style="display:flex; flex-direction:column; gap:var(--spacing-md);">
          <div class="card">
            <div class="section-title" style="margin-bottom:12px;">🚀 Kemampuan Sistem</div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:0.85rem; color:var(--color-text-secondary);">
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Monitoring 20–200+ device (PC, Server, Router, Switch, CCTV)</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Multi-protokol: ICMP Ping, RTSP Stream Port 554, ISAPI, ONVIF</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Peta Visual Topologi Otomatis (Hierarki L2/L3) dengan Drag & Drop</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Mode Pemeliharaan (Maintenance) dengan Countdown Timer</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Uptime Score harian & Pelacak Target SLA 99%</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Audit Log 3 Kategori (Status, Aktivitas, Konfigurasi) + Ekspor PDF</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Cadangan Database SQLite 1-Klik & Pemulihan Instan</div>
            </div>
          </div>

          <div class="card">
            <div class="section-title" style="margin-bottom:12px;">👨‍💻 Informasi Teknis</div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:0.85rem;">
              ${[
                ['Pembuat Projek', 'Fatur'],
                ['Runtime', 'Node.js v22/v24 + Windows Service'],
                ['Database', 'SQLite WAL Mode (data/devwatch.db)'],
                ['Streaming', 'WebSocket Real-Time (/ws)'],
                ['Autentikasi', 'JWT Token + bcrypt + Proactive Session Guard'],
                ['Frontend', 'Vite 5 + Vanilla JS + CSS Tokens'],
              ].map(([k, v]) => `
                <div style="display:flex; gap:12px; padding:6px 0; border-bottom:1px solid var(--border-color);">
                  <span style="color:var(--color-muted); min-width:110px;">${k}</span>
                  <span style="color:var(--color-text); font-weight:600;">${v}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card" style="border:1px solid rgba(99,102,241,0.3); background:rgba(99,102,241,0.03);">
            <div class="section-title" style="margin-bottom:8px; color:#818cf8;">📖 Buku Panduan Penggunaan Lengkap</div>
            <p style="font-size:0.82rem; color:var(--color-muted); margin-bottom:12px; line-height:1.5;">
              Pelajari cara mengoperasikan MonDev, mendaftarkan CCTV RTSP, mengatur topologi visual, membaca log sistem, mengekspor laporan, hingga mencadangkan database dengan mudah disertai screenshot visual.
            </p>
            <button class="btn btn-primary btn-sm" id="about-docs-btn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700;">
              <span>📚</span>
              <span>Buka Buku Panduan Interaktif Lengkap</span>
            </button>
          </div>

          <div class="card">
            <div class="section-title" style="margin-bottom:8px;">📜 Lisensi & Penggunaan</div>
            <p style="font-size:0.82rem; color:var(--color-muted); line-height:1.5;">
              MonDev adalah perangkat lunak internal untuk pemantauan infrastruktur kantor. Seluruh hak cipta dilindungi.
            </p>
            <p style="font-size:0.78rem; color:var(--color-muted); margin-top:6px;">
              © 2026 MonDev Network System — Dibuat oleh Fatur
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Data Modul Panduan Lengkap beserta Screenshot Riil
const guideModules = [
  {
    id: 'dashboard',
    icon: '📊',
    title: '1. Dashboard & Status Jaringan',
    content: `
      <div class="guide-section-title">📊 Dashboard Pemantauan Terpusat</div>
      <p class="guide-text">
        Dashboard adalah halaman beranda utama MonDev yang menyajikan ringkasan visual kesehatan jaringan secara <b>real-time tanpa perlu me-refresh halaman browser</b>.
      </p>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/02-dashboard-cards.png', 'Gambar 1: Tampilan Dashboard Mode Gelap dengan kartu metrik real-time & indikator LIVE')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/02-dashboard-cards.png" class="guide-screenshot-img" alt="Dashboard MonDev" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 1: Tampilan Dashboard Mode Gelap dengan kartu metrik real-time & indikator LIVE</div>
      </div>

      <div class="guide-card-box">
        <div style="font-weight:700; color:var(--color-heading); font-size:0.88rem;">📌 Komponen Utama Dashboard:</div>
        <ul style="margin:0; padding-left:18px; font-size:0.84rem; color:var(--color-text-secondary); line-height:1.7;">
          <li><b>Kartu Statistik Ringkasan:</b> Memperlihatkan Total Device, perangkat Online (hijau), perangkat Offline (merah), dan perangkat Maintenance (kuning).</li>
          <li><b>Indikator LIVE:</b> Menandakan koneksi WebSocket dua arah aktif. Setiap perubahan status perangkat di lapangan akan langsung mengubah warna kartu seketika.</li>
          <li><b>Tab Navigasi Dashboard:</b> Beralih cepat antara <i>🃏 Tampilan Kartu</i>, <i>🗺️ Peta Visual</i>, dan <i>📉 Grafik Respons & Timeline</i>.</li>
          <li><b>Pencarian & Filter Cepat:</b> Saring perangkat berdasarkan kata kunci IP/nama, status operasional, kategori jenis, atau grup departemen.</li>
        </ul>
      </div>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/14-light-theme-dashboard.png', 'Gambar 2: Tampilan Dashboard dalam Mode Terang Lembut')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/14-light-theme-dashboard.png" class="guide-screenshot-img" alt="Dashboard Mode Terang" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 2: Tampilan Dashboard dalam Mode Terang Lembut (tersedia tombol mode tema di Topbar)</div>
      </div>

      <div class="guide-tip-box">
        💡 <b>Tips Penggunaan:</b> Anda dapat mengklik tombol <b>🔄 Refresh</b> untuk memaksa sinkronisasi manual ke database jika baru saja menambahkan banyak perangkat dari komputer lain.
      </div>
    `,
  },
  {
    id: 'devices',
    icon: '🖥️',
    title: '2. Manajemen Perangkat & RTSP',
    content: `
      <div class="guide-section-title">🖥️ Manajemen Perangkat & CCTV</div>
      <p class="guide-text">
        Menu <b>Manajemen Device</b> memungkinkan Administrator dan Teknisi untuk mendaftarkan, mengedit, menguji koneksi (probe), serta menghapus unit perangkat jaringan.
      </p>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/03-device-management.png', 'Gambar 3: Tabel Manajemen Perangkat dengan pencarian cepat, filter jenis, dan aksi per baris')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/03-device-management.png" class="guide-screenshot-img" alt="Manajemen Perangkat" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 3: Tabel Manajemen Perangkat dengan pencarian cepat, filter jenis, dan aksi per baris</div>
      </div>

      <div class="guide-card-box">
        <div style="font-weight:700; color:var(--color-heading); font-size:0.88rem;">➕ Cara Menambahkan Perangkat Baru:</div>
        <ol style="margin:0; padding-left:18px; font-size:0.84rem; color:var(--color-text-secondary); line-height:1.7;">
          <li>Klik tombol <b>➕ Tambah Device</b> di pojok kanan atas.</li>
          <li>Isi <b>Nama Perangkat</b> (contoh: <code>CCTV Gerbang Masuk</code> atau <code>PC Akuntansi 01</code>).</li>
          <li>Pilih <b>Jenis Perangkat</b>: Komputer, CCTV Hikvision, Router, Switch, Server, atau Access Point.</li>
          <li>Tentukan <b>Metode Monitoring</b>:
            <ul style="margin-top:4px;">
              <li><b>PING (ICMP):</b> Untuk PC, Switch, Printer, dan Server umum.</li>
              <li><b>RTSP:</b> Khusus kamera CCTV stream. Anda dapat memasukkan URL RTSP lengkap (contoh: <code>rtsp://admin:pass@10.10.38.192:554/cam/realmonitor?channel=1&subtype=1</code>). Sistem otomatis mengekstrak IP host dan kredensial secara cerdas!</li>
              <li><b>ISAPI:</b> Khusus kamera Hikvision melalui Web API Port 80/8000.</li>
              <li><b>ONVIF:</b> Untuk IP camera standar industri port 80/8080/8899.</li>
            </ul>
          </li>
          <li>Masukkan <b>Interval Polling</b> (default 60 detik) dan <b>Grup / Lokasi</b>.</li>
          <li>Klik tombol <b>🔍 Test Koneksi Langsung</b> untuk memastikan perangkat dapat dijangkau sebelum disimpan.</li>
          <li>Klik <b>Simpan Perangkat</b>.</li>
        </ol>
      </div>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/06-sweetalert-ping.png', 'Gambar 4: Pop-up hasil pengujian koneksi langsung dengan informasi latensi milidetik akurat')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/06-sweetalert-ping.png" class="guide-screenshot-img" alt="Uji Koneksi Langsung" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 4: Pop-up hasil pengujian koneksi langsung dengan informasi latensi milidetik akurat</div>
      </div>

      <div class="guide-tip-box">
        📁 <b>Impor Massal (CSV):</b> Ingin mendaftarkan 50+ komputer sekaligus? Gunakan tombol <b>📂 Import CSV</b> untuk mengunggah spreadsheet daftar IP kantor secara instan.
      </div>
    `,
  },
  {
    id: 'topology',
    icon: '🗺️',
    title: '3. Peta Topologi Visual Jaringan',
    content: `
      <div class="guide-section-title">🗺️ Peta Topologi Visual Interaktif</div>
      <p class="guide-text">
        Peta Topologi Visual secara otomatis memetakan hubungan hierarki jaringan dari <b>Gateway Router ➔ Core Distribution Switch ➔ Switch Grup / VLAN ➔ Endpoint Devices</b> (PC, CCTV, Server).
      </p>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/07-peta-visual.png', 'Gambar 5: Peta Topologi Jaringan dengan hierarki bertingkat dan deteksi status live')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/07-peta-visual.png" class="guide-screenshot-img" alt="Peta Visual Jaringan" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 5: Peta Topologi Jaringan dengan hierarki bertingkat dan deteksi status live</div>
      </div>

      <div class="guide-card-box">
        <div style="font-weight:700; color:var(--color-heading); font-size:0.88rem;">✨ Fitur Unggulan Peta Visual:</div>
        <ul style="margin:0; padding-left:18px; font-size:0.84rem; color:var(--color-text-secondary); line-height:1.7;">
          <li><b>Drag & Drop Bebas:</b> Setiap node perangkat dapat digeser dengan mouse untuk menyesuaikan denah ruangan kantor. Posisi tersimpan otomatis di browser Anda.</li>
          <li><b>Deteksi Otomatis L3 Inter-VLAN Routing:</b> Jika perangkat memiliki subnet IP yang berbeda dari induknya (contoh: PC <code>192.168.38.x</code> terhubung ke router <code>192.168.1.x</code>), garis koneksi akan otomatis berwarna oranye dengan badge <code>⚡ L3</code>.</li>
          <li><b>Indikator Latensi Riil:</b> Router dan Switch menampilkan badge latensi (ms) langsung pada node peta.</li>
          <li><b>Tooltip Informasi Cerdas:</b> Arahkan kursor ke perangkat mana pun untuk melihat nama, IP bersih, status respon, dan informasi uplink.</li>
        </ul>
      </div>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/10-topology-map.png', 'Gambar 6: Detail koneksi uplink antar switch dan deteksi rute lintas VLAN')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/10-topology-map.png" class="guide-screenshot-img" alt="Detail Topologi" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 6: Detail koneksi uplink antar switch dan deteksi rute lintas VLAN</div>
      </div>
    `,
  },
  {
    id: 'timeline',
    icon: '📈',
    title: '4. Grafik Respons & Deteksi 24 Jam',
    content: `
      <div class="guide-section-title">📈 Grafik Respons & Riwayat 24 Jam</div>
      <p class="guide-text">
        Fitur ini menyajikan visualisasi grafik batang dan garis mengenai performa respon perangkat selama 24 jam terakhir secara per jam.
      </p>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/11-timeline-chart.png', 'Gambar 7: Grafik Respons & Status 24 Jam dengan pemilih dropdown perangkat')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/11-timeline-chart.png" class="guide-screenshot-img" alt="Grafik Timeline Respons" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 7: Grafik Respons & Status 24 Jam dengan pemilih dropdown perangkat</div>
      </div>

      <div class="guide-card-box">
        <div style="font-weight:700; color:var(--color-heading); font-size:0.88rem;">📊 Cara Membaca Grafik 24 Jam:</div>
        <ul style="margin:0; padding-left:18px; font-size:0.84rem; color:var(--color-text-secondary); line-height:1.7;">
          <li><span style="color:var(--color-online); font-weight:700;">🟢 Balok Hijau:</span> Perangkat online dan merespons normal. Tinggi balok menggambarkan waktu respon (latency) dalam milidetik (ms). Semakin pendek balok, semakin cepat respon perangkat.</li>
          <li><span style="color:var(--color-offline); font-weight:700;">🔴 Balok Merah:</span> Perangkat mengalami gangguan / Request Timeout pada jam tersebut.</li>
          <li><span style="color:var(--color-maintenance); font-weight:700;">🟡 Balok Kuning:</span> Perangkat sedang dalam mode pemeliharaan (maintenance) terencana.</li>
          <li><span style="color:var(--color-muted); font-weight:700;">⚪ Balok Abu-abu:</span> Perangkat belum didaftarkan ke sistem pada jam tersebut.</li>
        </ul>
      </div>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/05-device-detail.png', 'Gambar 8: Halaman Detail Perangkat dengan metrik SLA 24 jam, 7 hari, 30 hari, dan riwayat insiden')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/05-device-detail.png" class="guide-screenshot-img" alt="Halaman Detail Perangkat" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 8: Halaman Detail Perangkat dengan metrik SLA 24 jam, 7 hari, 30 hari, dan riwayat insiden</div>
      </div>
    `,
  },
  {
    id: 'logs',
    icon: '📜',
    title: '5. Log Sistem & Audit Perubahan',
    content: `
      <div class="guide-section-title">📜 Log Sistem & Rekam Audit Lengkap</div>
      <p class="guide-text">
        MonDev mencatat setiap peristiwa jaringan dan aktivitas operator ke dalam basis data SQLite secara permanen untuk keperluan audit dan troubleshooting.
      </p>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/04-system-logs.png', 'Gambar 9: Log Sistem dengan 3 tab kategori, filter rentang tanggal, dan ekspor berkas PDF')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/04-system-logs.png" class="guide-screenshot-img" alt="Log Sistem" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 9: Log Sistem dengan 3 tab kategori, filter rentang tanggal, dan ekspor berkas PDF</div>
      </div>

      <div class="guide-card-box">
        <div style="font-weight:700; color:var(--color-heading); font-size:0.88rem;">📑 Tiga Kategori Log Sistem:</div>
        <ol style="margin:0; padding-left:18px; font-size:0.84rem; color:var(--color-text-secondary); line-height:1.7;">
          <li><b>🖥️ Log Status Device:</b> Rekaman setiap perubahan status perangkat (Online ➔ Offline, atau Offline ➔ Online), lengkap dengan metode probe, waktu respon riil, dan stempel waktu UTC+7.</li>
          <li><b>👤 Log Aktivitas User:</b> Catatan login, logout, dan tindakan administratif pengguna disertai alamat IP akses untuk mendeteksi upaya akses tidak sah.</li>
          <li><b>⚙️ Log Perubahan Konfigurasi:</b> Catatan pengubahan konfigurasi sistem, penambahan/penghapusan perangkat, atau penggantian pengaturan. <b>Klik pada pesan log konfigurasi</b> untuk membuka jendela pop-up rincian detail perubahan!</li>
        </ol>
      </div>

      <div class="guide-tip-box">
        📄 <b>Ekspor Dokumen PDF:</b> Klik tombol <b>📄 Ekspor PDF</b> untuk mengunduh laporan log resmi berformat siap cetak dengan kop dokumen dan tanda tangan laporan.
      </div>
    `,
  },
  {
    id: 'sla',
    icon: '📉',
    title: '6. Laporan Mingguan & SLA Tracker',
    content: `
      <div class="guide-section-title">📉 Laporan Mingguan & Pelacak SLA 99%</div>
      <p class="guide-text">
        Menu <b>Laporan</b> mengagregasi data uptime seluruh perangkat untuk memantau pemenuhan target Service Level Agreement (SLA) bulanan kantor.
      </p>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/08-laporan-sla.png', 'Gambar 10: Ringkasan performa uptime mingguan, rata-rata tren hari, dan pelacak SLA 30 hari')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/08-laporan-sla.png" class="guide-screenshot-img" alt="Laporan SLA" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 10: Ringkasan performa uptime mingguan, rata-rata tren hari, dan pelacak SLA 30 hari</div>
      </div>

      <div class="guide-card-box">
        <div style="font-weight:700; color:var(--color-heading); font-size:0.88rem;">📊 Formula Perhitungan Uptime SLA:</div>
        <p style="font-size:0.82rem; color:var(--color-muted); margin:0;">
          Uptime dihitung dengan rumus standar industri telekomunikasi:
        </p>
        <div style="padding:8px 12px; background:rgba(0,0,0,0.3); border-radius:6px; font-family:monospace; font-size:0.82rem; color:#4ade80;">
          Uptime (%) = [(Total Waktu Monitoring - Total Durasi Gangguan) / Total Waktu Monitoring] × 100%
        </div>
        <p style="font-size:0.8rem; color:var(--color-muted); margin:0;">
          *Catatan penting: Masa pemeliharaan terjadwal (<b>Maintenance Mode</b>) tidak dihitung sebagai downtime gangguan sehingga tidak menurunkan skor SLA perangkat.
        </p>
      </div>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/13-laporan-sla-export.png', 'Gambar 11: Riwayat arsip laporan pekanan otomatis dan tabel ringkasan kepatuhan SLA')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/13-laporan-sla-export.png" class="guide-screenshot-img" alt="Ekspor Laporan SLA" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 11: Riwayat arsip laporan pekanan otomatis dan tabel ringkasan kepatuhan SLA</div>
      </div>
    `,
  },
  {
    id: 'settings',
    icon: '⚙️',
    title: '7. Pengaturan & Cadangan Database',
    content: `
      <div class="guide-section-title">⚙️ Pengaturan Sistem & Backup Database</div>
      <p class="guide-text">
        Menu <b>Pengaturan</b> (khusus Administrator) memberikan kontrol penuh terhadap parameter operasional engine pemantauan, zona waktu, dan pencadangan data.
      </p>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/09-pengaturan.png', 'Gambar 12: Halaman Pengaturan Sistem dengan tabs Umum, Monitoring, Keamanan, dan Pemeliharaan')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/09-pengaturan.png" class="guide-screenshot-img" alt="Pengaturan Sistem" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 12: Halaman Pengaturan Sistem dengan tabs Umum, Monitoring, Keamanan, dan Pemeliharaan</div>
      </div>

      <div class="guide-card-box">
        <div style="font-weight:700; color:var(--color-heading); font-size:0.88rem;">🔐 Parameter Keamanan & Monitoring:</div>
        <ul style="margin:0; padding-left:18px; font-size:0.84rem; color:var(--color-text-secondary); line-height:1.7;">
          <li><b>Interval Polling Default:</b> Menentukan frekuensi pengecekan perangkat (rekomendasi 60 detik).</li>
          <li><b>Threshold Kegagalan:</b> Jumlah percobaan gagal berturut-turut sebelum sistem menetapkan status Offline (default 3x) untuk menghindari false-alarm akibat lonjakan sesaat.</li>
          <li><b>Zona Waktu:</b> Menyelaraskan seluruh stempel waktu aplikasi ke WIB (Asia/Jakarta UTC+7).</li>
          <li><b>IP Whitelist:</b> Batasi akses login dashboard hanya dari subnet kantor tertentu.</li>
        </ul>
      </div>

      <div class="guide-screenshot-wrapper" onclick="window.openGuideLightbox('/images/12-backup-system.png', 'Gambar 13: Fitur pencadangan SQLite 1-klik dan pengunduhan berkas cadangan database')">
        <div class="guide-screenshot-badge">🔍 Klik untuk Full HD</div>
        <img src="/images/12-backup-system.png" class="guide-screenshot-img" alt="Backup Database" loading="lazy" />
        <div class="guide-screenshot-caption">📸 Gambar 13: Fitur pencadangan SQLite 1-klik dan pengunduhan berkas cadangan database</div>
      </div>

      <div class="guide-tip-box">
        💾 <b>Pencadangan Database 1-Klik:</b> Buka Pengaturan ➔ Tab Pemeliharaan ➔ Klik <b>💾 Cadangkan Database Sekarang</b> untuk membuat snapshot instan file database SQLite dan mengunduhnya ke laptop Anda.
      </div>
    `,
  },
];

let activeGuideModuleId = 'dashboard';
let guideSearchQuery = '';

function renderGuideModalContent() {
  const q = guideSearchQuery.trim().toLowerCase();
  const visibleModules = q
    ? guideModules.filter((m) => m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q))
    : guideModules;

  let mod = guideModules.find((m) => m.id === activeGuideModuleId);
  if (!mod || (visibleModules.length > 0 && !visibleModules.some((m) => m.id === mod.id))) {
    mod = visibleModules[0] || guideModules[0];
    if (mod) activeGuideModuleId = mod.id;
  }

  const currentIndex = guideModules.findIndex((m) => m.id === activeGuideModuleId);
  const prevMod = currentIndex > 0 ? guideModules[currentIndex - 1] : null;
  const nextMod = currentIndex < guideModules.length - 1 ? guideModules[currentIndex + 1] : null;

  return `
    <div class="guide-container">
      <div class="guide-sidebar">
        <div class="guide-search-wrapper">
          <span class="guide-search-icon">🔍</span>
          <input 
            type="text" 
            class="guide-search-input" 
            id="guide-search-input" 
            placeholder="Cari topik panduan..." 
            value="${guideSearchQuery}" 
            oninput="window.filterGuideModules(this.value)"
          />
        </div>
        ${visibleModules.length === 0 ? `
          <div style="font-size:0.78rem; color:var(--color-muted); padding:12px 6px; text-align:center;">
            Tidak ditemukan topik yang cocok.
          </div>
        ` : visibleModules.map((m) => `
          <button class="guide-tab-item ${m.id === activeGuideModuleId ? 'active' : ''}" onclick="window.switchGuideModule('${m.id}')">
            <span>${m.icon}</span>
            <span class="truncate">${m.title.split('. ')[1] || m.title}</span>
          </button>
        `).join('')}
      </div>

      <div class="guide-content-area" id="guide-active-content">
        ${mod ? mod.content : '<div style="color:var(--color-muted);">Pilih topik di sidebar.</div>'}

        <!-- Footer Navigasi Antar Modul -->
        <div class="guide-footer-nav">
          <button class="guide-nav-btn" ${!prevMod ? 'disabled' : ''} onclick="${prevMod ? `window.switchGuideModule('${prevMod.id}')` : ''}">
            ⬅️ ${prevMod ? prevMod.title.split('. ')[1] : 'Mulai'}
          </button>
          <span class="guide-progress-pill">Modul ${currentIndex + 1} dari ${guideModules.length}</span>
          <button class="guide-nav-btn" ${!nextMod ? 'disabled' : ''} onclick="${nextMod ? `window.switchGuideModule('${nextMod.id}')` : ''}">
            ${nextMod ? nextMod.title.split('. ')[1] : 'Selesai'} ➡️
          </button>
        </div>
      </div>
    </div>
  `;
}

// Inisialisasi Custom Lightbox HD Mandiri (Non-Swal)
function ensureLightboxExists() {
  if (document.getElementById('guide-lightbox-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'guide-lightbox-overlay';
  overlay.innerHTML = `
    <div class="guide-lightbox-topbar">
      <div class="guide-lightbox-title" id="guide-lightbox-caption">📸 Screenshot Panduan HD</div>
      <div class="guide-lightbox-controls">
        <button class="guide-lightbox-btn" id="guide-zoom-out" title="Perkecil (-25%)">➖</button>
        <button class="guide-lightbox-btn" id="guide-zoom-reset" title="Ukuran Semula (100%)" style="font-size:0.75rem; font-weight:700;">100%</button>
        <button class="guide-lightbox-btn" id="guide-zoom-in" title="Perbesar (+25%)">➕</button>
        <button class="guide-lightbox-btn guide-lightbox-btn-close" id="guide-lightbox-close" title="Tutup Gambar (Esc)">✕</button>
      </div>
    </div>
    <div class="guide-lightbox-viewport" id="guide-lightbox-viewport">
      <img id="guide-lightbox-img" src="" alt="Screenshot Full HD" />
    </div>
  `;
  document.body.appendChild(overlay);

  let currentZoom = 1;
  const img = overlay.querySelector('#guide-lightbox-img');
  const resetBtn = overlay.querySelector('#guide-zoom-reset');

  const updateZoom = (z) => {
    currentZoom = Math.min(Math.max(0.5, z), 3);
    if (img) img.style.transform = `scale(${currentZoom})`;
    if (resetBtn) resetBtn.textContent = `${Math.round(currentZoom * 100)}%`;
  };

  overlay.querySelector('#guide-zoom-in')?.addEventListener('click', (e) => {
    e.stopPropagation();
    updateZoom(currentZoom + 0.25);
  });

  overlay.querySelector('#guide-zoom-out')?.addEventListener('click', (e) => {
    e.stopPropagation();
    updateZoom(currentZoom - 0.25);
  });

  overlay.querySelector('#guide-zoom-reset')?.addEventListener('click', (e) => {
    e.stopPropagation();
    updateZoom(1);
  });

  const closeLightbox = () => {
    overlay.classList.remove('active');
    updateZoom(1);
  };

  overlay.querySelector('#guide-lightbox-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeLightbox();
  });

  // Klik di latar belakang luar gambar menutup lightbox
  overlay.querySelector('#guide-lightbox-viewport')?.addEventListener('click', (e) => {
    if (e.target === overlay.querySelector('#guide-lightbox-viewport')) {
      closeLightbox();
    }
  });

  // Keyboard Escape menutup lightbox
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      e.stopPropagation();
      closeLightbox();
    }
  });
}

export function initAboutEvents() {
  ensureLightboxExists();

  // Buka Modal Buku Panduan Interaktif
  document.getElementById('about-docs-btn')?.addEventListener('click', () => {
    activeGuideModuleId = 'dashboard';
    guideSearchQuery = '';

    Swal.fire({
      title: '📖 Buku Panduan Operasional MonDev',
      html: `<div id="guide-modal-wrapper">${renderGuideModalContent()}</div>`,
      showConfirmButton: true,
      confirmButtonText: 'Tutup Panduan',
      confirmButtonColor: '#6366f1',
      background: '#1a1d2e',
      color: '#e2e8f0',
      width: 'min(1180px, 96vw)',
      customClass: {
        popup: 'guide-custom-swal-popup',
      },
    });
  });

  // Ganti tab modul di dalam modal panduan
  window.switchGuideModule = (modId) => {
    activeGuideModuleId = modId;
    const wrapper = document.getElementById('guide-modal-wrapper');
    if (wrapper) {
      wrapper.innerHTML = renderGuideModalContent();
      const contentEl = document.getElementById('guide-active-content');
      if (contentEl) contentEl.scrollTop = 0;
    }
  };

  // Filter modul via pencarian
  window.filterGuideModules = (query) => {
    guideSearchQuery = query;
    const wrapper = document.getElementById('guide-modal-wrapper');
    if (wrapper) {
      wrapper.innerHTML = renderGuideModalContent();
      const input = document.getElementById('guide-search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  };

  // Buka Lightbox Mandiri HD (Gambar tidak menutup modal panduan)
  window.openGuideLightbox = (src, caption) => {
    ensureLightboxExists();
    const overlay = document.getElementById('guide-lightbox-overlay');
    const img = document.getElementById('guide-lightbox-img');
    const captionEl = document.getElementById('guide-lightbox-caption');
    if (img) img.src = src;
    if (captionEl) captionEl.innerHTML = `📸 ${caption || 'Screenshot Panduan HD'}`;
    if (overlay) overlay.classList.add('active');
  };

  // Kompatibilitas fungsi zoom lama
  window.zoomGuideImage = (src) => {
    window.openGuideLightbox(src, 'Screenshot Panduan');
  };
}

