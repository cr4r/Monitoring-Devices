// ================================================================
// DevWatch — settings.js
// Pengaturan sistem: 6 kategori, form save dengan SweetAlert
// ================================================================

import Swal from 'sweetalert2';

let activeSection = 'umum';

const sections = [
  { id: 'umum', icon: '🔧', label: 'Umum' },
  { id: 'monitoring', icon: '📡', label: 'Monitoring' },
  { id: 'notifikasi', icon: '🔔', label: 'Notifikasi' },
  { id: 'keamanan', icon: '🔐', label: 'Keamanan' },
  { id: 'log', icon: '📋', label: 'Log & Backup' },
  { id: 'laporan', icon: '📈', label: 'Laporan Terjadwal' },
];

export function renderSettings() {
  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">⚙️ Pengaturan Sistem</h1>
          <p class="page-subtitle">Konfigurasi monitoring, notifikasi, keamanan, dan backup</p>
        </div>
      </div>

      <div class="settings-layout">
        <!-- Sidebar nav -->
        <div class="settings-sidebar">
          ${sections.map((s) => `
            <button class="settings-nav-item ${activeSection === s.id ? 'active' : ''}" data-section="${s.id}" id="snav-${s.id}">
              ${s.icon} ${s.label}
            </button>
          `).join('')}
        </div>

        <!-- Content -->
        <div id="settings-content">
          ${renderSettingsSection(activeSection)}
        </div>
      </div>
    </div>
  `;
}

function renderSettingsSection(section) {
  const sections = {
    umum: renderUmum,
    monitoring: renderMonitoring,
    notifikasi: renderNotifikasi,
    keamanan: renderKeamanan,
    log: renderLog,
    laporan: renderLaporan,
  };
  return (sections[section] || renderUmum)();
}

function renderUmum() {
  return `
    <div class="settings-section">
      <div class="settings-section-title">🔧 Pengaturan Umum</div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Nama Aplikasi</div>
          <div class="settings-item-desc">Nama yang ditampilkan di header dan laporan</div>
        </div>
        <div class="settings-item-control">
          <input type="text" class="form-control" id="set-app-name" value="DevWatch" />
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Zona Waktu</div>
          <div class="settings-item-desc">Zona waktu untuk semua log dan laporan</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-timezone">
            <option value="Asia/Jakarta" selected>WIB — Asia/Jakarta (UTC+7)</option>
            <option value="Asia/Makassar">WITA — Asia/Makassar (UTC+8)</option>
            <option value="Asia/Jayapura">WIT — Asia/Jayapura (UTC+9)</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Bahasa Antarmuka</div>
          <div class="settings-item-desc">Bahasa yang digunakan di seluruh aplikasi</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-lang">
            <option value="id" selected>Bahasa Indonesia</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Logo Aplikasi</div>
          <div class="settings-item-desc">Upload logo untuk header dan laporan PDF</div>
        </div>
        <div class="settings-item-control">
          <button class="btn btn-secondary btn-sm">📁 Upload Logo</button>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary" id="save-umum-btn">💾 Simpan Pengaturan</button>
      </div>
    </div>
  `;
}

function renderMonitoring() {
  return `
    <div class="settings-section">
      <div class="settings-section-title">📡 Pengaturan Monitoring</div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Interval Polling Default</div>
          <div class="settings-item-desc">Default interval untuk device baru (30–600 detik)</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-interval">
            <option value="30">30 detik</option>
            <option value="60" selected>60 detik (default)</option>
            <option value="120">2 menit</option>
            <option value="300">5 menit</option>
            <option value="600">10 menit</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Timeout Ping (ms)</div>
          <div class="settings-item-desc">Waktu tunggu respons ping sebelum dianggap timeout</div>
        </div>
        <div class="settings-item-control">
          <input type="number" class="form-control" id="set-timeout" value="3000" min="500" max="10000" />
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Retry Count</div>
          <div class="settings-item-desc">Jumlah percobaan ulang sebelum mengubah status ke Offline</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-retry">
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="3" selected>3x (rekomendasi)</option>
            <option value="5">5x</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Engine Monitoring</div>
          <div class="settings-item-desc">Aktifkan atau nonaktifkan engine monitoring global</div>
        </div>
        <div class="settings-item-control">
          <label class="toggle-wrapper">
            <input type="checkbox" class="toggle-input" id="set-engine-active" checked />
            <span class="toggle-track"></span>
            <span style="font-size:0.85rem; color:var(--color-text-secondary);">Aktif</span>
          </label>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary" id="save-monitoring-btn">💾 Simpan Pengaturan</button>
      </div>
    </div>
  `;
}

function renderNotifikasi() {
  return `
    <div class="settings-section">
      <div class="settings-section-title">🔔 Pengaturan Notifikasi</div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Push Notification Browser</div>
          <div class="settings-item-desc">Aktifkan notifikasi browser saat device offline</div>
        </div>
        <div class="settings-item-control">
          <label class="toggle-wrapper">
            <input type="checkbox" class="toggle-input" id="set-push-notif" checked />
            <span class="toggle-track"></span>
            <span style="font-size:0.85rem; color:var(--color-text-secondary);">Aktif</span>
          </label>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Jam Kerja Notifikasi</div>
          <div class="settings-item-desc">Notifikasi hanya dikirim dalam rentang jam ini</div>
        </div>
        <div class="settings-item-control" style="display:flex; gap:8px; align-items:center;">
          <input type="time" class="form-control" id="set-notif-dari" value="07:00" style="width:auto;" />
          <span style="color:var(--color-muted);">–</span>
          <input type="time" class="form-control" id="set-notif-sampai" value="17:00" style="width:auto;" />
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Notif Maintenance Reminder</div>
          <div class="settings-item-desc">Notifikasi saat estimasi maintenance terlewat</div>
        </div>
        <div class="settings-item-control">
          <label class="toggle-wrapper">
            <input type="checkbox" class="toggle-input" id="set-maint-notif" checked />
            <span class="toggle-track"></span>
            <span style="font-size:0.85rem; color:var(--color-text-secondary);">Aktif</span>
          </label>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary" id="save-notif-btn">💾 Simpan Pengaturan</button>
      </div>
    </div>
  `;
}

function renderKeamanan() {
  return `
    <div class="settings-section">
      <div class="settings-section-title">🔐 Pengaturan Keamanan</div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Session Timeout</div>
          <div class="settings-item-desc">Durasi sesi aktif sebelum otomatis logout</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-session-timeout">
            <option value="30">30 menit</option>
            <option value="60" selected>1 jam</option>
            <option value="240">4 jam</option>
            <option value="480">8 jam</option>
            <option value="0">Tidak ada timeout</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Batas Percobaan Login</div>
          <div class="settings-item-desc">Maksimal percobaan login sebelum akun terkunci</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-login-limit">
            <option value="3">3x percobaan</option>
            <option value="5" selected>5x percobaan (default)</option>
            <option value="10">10x percobaan</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Durasi Lockout Login</div>
          <div class="settings-item-desc">Durasi kunci akun setelah terlalu banyak gagal login</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-lockout">
            <option value="5">5 menit</option>
            <option value="15" selected>15 menit (default)</option>
            <option value="30">30 menit</option>
            <option value="60">1 jam</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Whitelist IP Admin</div>
          <div class="settings-item-desc">Batasi akses admin hanya dari IP tertentu (opsional, kosongkan untuk nonaktif)</div>
        </div>
        <div class="settings-item-control">
          <textarea class="form-control" id="set-whitelist-ip" placeholder="Contoh:&#10;192.168.1.5&#10;192.168.1.8" style="min-height:70px;"></textarea>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Enforce HTTPS</div>
          <div class="settings-item-desc">Paksa semua koneksi menggunakan HTTPS</div>
        </div>
        <div class="settings-item-control">
          <label class="toggle-wrapper">
            <input type="checkbox" class="toggle-input" id="set-https" checked />
            <span class="toggle-track"></span>
            <span style="font-size:0.85rem; color:var(--color-text-secondary);">Aktif</span>
          </label>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary" id="save-keamanan-btn">💾 Simpan Pengaturan</button>
      </div>
    </div>
  `;
}

function renderLog() {
  return `
    <div class="settings-section">
      <div class="settings-section-title">📋 Log & Backup</div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Retensi Log</div>
          <div class="settings-item-desc">Log lebih lama dari batas ini akan dihapus otomatis</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-log-retention">
            <option value="30">30 hari</option>
            <option value="60">60 hari</option>
            <option value="90" selected>90 hari (default)</option>
            <option value="180">180 hari</option>
            <option value="365">1 tahun</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Auto-Delete Log Lama</div>
          <div class="settings-item-desc">Hapus log secara otomatis sesuai batas retensi</div>
        </div>
        <div class="settings-item-control">
          <label class="toggle-wrapper">
            <input type="checkbox" class="toggle-input" id="set-auto-delete" checked />
            <span class="toggle-track"></span>
            <span style="font-size:0.85rem; color:var(--color-text-secondary);">Aktif</span>
          </label>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Jadwal Backup Database</div>
          <div class="settings-item-desc">Frekuensi backup otomatis database SQLite</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-backup-schedule">
            <option value="daily" selected>Setiap hari (01:00 WIB)</option>
            <option value="weekly">Setiap Senin (01:00 WIB)</option>
            <option value="monthly">Setiap bulan (tanggal 1)</option>
            <option value="none">Nonaktif</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Lokasi Backup</div>
          <div class="settings-item-desc">Folder tujuan backup database (path lokal server)</div>
        </div>
        <div class="settings-item-control">
          <input type="text" class="form-control" id="set-backup-path" value="D:\Backup\DevWatch" />
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:8px; flex-wrap:wrap; gap:8px;">
        <button class="btn btn-secondary" id="manual-backup-btn">💾 Backup Sekarang</button>
        <button class="btn btn-primary" id="save-log-btn">💾 Simpan Pengaturan</button>
      </div>
    </div>
  `;
}

function renderLaporan() {
  return `
    <div class="settings-section">
      <div class="settings-section-title">📈 Laporan Terjadwal</div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Laporan Mingguan Otomatis</div>
          <div class="settings-item-desc">Generate dan kirim laporan setiap Senin pagi</div>
        </div>
        <div class="settings-item-control">
          <label class="toggle-wrapper">
            <input type="checkbox" class="toggle-input" id="set-weekly-report" checked />
            <span class="toggle-track"></span>
            <span style="font-size:0.85rem; color:var(--color-text-secondary);">Aktif</span>
          </label>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Jam Generate Laporan</div>
          <div class="settings-item-desc">Waktu generate laporan mingguan otomatis</div>
        </div>
        <div class="settings-item-control">
          <input type="time" class="form-control" id="set-report-time" value="07:00" style="width:auto;" />
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Penerima Laporan</div>
          <div class="settings-item-desc">Email yang menerima laporan mingguan (satu per baris)</div>
        </div>
        <div class="settings-item-control">
          <textarea class="form-control" id="set-report-recipients" placeholder="admin@kantor.com&#10;manager@kantor.com" style="min-height:70px;"></textarea>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Target SLA Global</div>
          <div class="settings-item-desc">Target uptime default untuk semua device (%)</div>
        </div>
        <div class="settings-item-control">
          <input type="number" class="form-control" id="set-sla-target" value="99" min="90" max="100" step="0.1" />
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary" id="save-laporan-btn">💾 Simpan Pengaturan</button>
      </div>
    </div>
  `;
}

export function initSettingsEvents() {
  // Section nav
  document.querySelectorAll('.settings-nav-item[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSection = btn.getAttribute('data-section');
      document.querySelectorAll('.settings-nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const content = document.getElementById('settings-content');
      if (content) content.innerHTML = renderSettingsSection(activeSection);
      bindSaveButtons();
    });
  });

  bindSaveButtons();
}

function bindSaveButtons() {
  const saveIds = ['save-umum-btn', 'save-monitoring-btn', 'save-notif-btn', 'save-keamanan-btn', 'save-log-btn', 'save-laporan-btn'];
  saveIds.forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => {
      Swal.fire({
        icon: 'success',
        title: 'Pengaturan Disimpan',
        text: 'Perubahan pengaturan berhasil disimpan.',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    });
  });

  // Manual backup
  document.getElementById('manual-backup-btn')?.addEventListener('click', async () => {
    await Swal.fire({
      title: 'Backup Database',
      html: '<div style="text-align:center;"><div class="spinner spinner-lg" style="margin:0 auto;"></div><p style="margin-top:12px; color:#94a3b8;">Membuat backup database...</p></div>',
      showConfirmButton: false,
      allowOutsideClick: false,
      timer: 2000,
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
    Swal.fire({
      icon: 'success',
      title: 'Backup Berhasil',
      text: `Database berhasil dibackup ke D:\\Backup\\DevWatch\\devwatch-${new Date().toISOString().slice(0, 10)}.sqlite`,
      confirmButtonText: 'OK',
      confirmButtonColor: '#6366f1',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
  });
}
