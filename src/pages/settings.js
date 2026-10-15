// ================================================================
// DevWatch — settings.js
// Pengaturan sistem: 6 kategori, form save dengan SweetAlert & database sync
// ================================================================

import Swal from 'sweetalert2';
import { apiGetSettings, apiUpdateSettings } from '../api.js';
import { applySystemSettings } from '../settingsManager.js';

let activeSection = 'umum';
let stagedLogo = undefined;
let currentSettings = {
  app_name: 'DevWatch',
  app_logo: '',
  timezone: 'Asia/Jakarta',
  language: 'id',
  default_ping_interval: '60',
  ping_timeout_ms: '3000',
  ping_retry_count: '3',
  engine_active: 'true',
  browser_push_enabled: 'true',
  work_hours_start: '07:00',
  work_hours_end: '17:00',
  maint_reminder_enabled: 'true',
  session_timeout_minutes: '60',
  max_login_attempts: '5',
  lockout_duration_minutes: '15',
  ip_whitelist: '',
  enforce_https: 'true',
  retention_days: '90',
  auto_backup_enabled: 'true',
  backup_schedule: 'daily',
  backup_target_path: 'D:\\Backup\\DevWatch',
  auto_weekly_report: 'true',
  report_time: '07:00',
  report_recipients: 'admin@kantor.com',
  target_sla: '99',
};

function getVal(key, fallback = '') {
  if (currentSettings[key] !== undefined) return currentSettings[key];
  for (const cat of Object.keys(currentSettings)) {
    if (typeof currentSettings[cat] === 'object' && currentSettings[cat] !== null && currentSettings[cat][key] !== undefined) {
      return currentSettings[cat][key];
    }
  }
  return fallback;
}

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
  const map = {
    umum: renderUmum,
    monitoring: renderMonitoring,
    notifikasi: renderNotifikasi,
    keamanan: renderKeamanan,
    log: renderLog,
    laporan: renderLaporan,
  };
  return (map[section] || renderUmum)();
}

function renderUmum() {
  const tz = getVal('timezone', 'Asia/Jakarta');
  const lang = getVal('language', 'id');
  const activeLogo = stagedLogo !== undefined ? stagedLogo : getVal('app_logo', '');

  return `
    <div class="settings-section">
      <div class="settings-section-title">🔧 Pengaturan Umum</div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Nama Aplikasi</div>
          <div class="settings-item-desc">Nama yang ditampilkan di header, sidebar, dan laporan</div>
        </div>
        <div class="settings-item-control">
          <input type="text" class="form-control" id="set-app-name" value="${getVal('app_name', 'DevWatch')}" />
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Zona Waktu</div>
          <div class="settings-item-desc">Zona waktu untuk jam antarmuka, riwayat log, dan laporan</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-timezone">
            <option value="Asia/Jakarta" ${tz === 'Asia/Jakarta' ? 'selected' : ''}>WIB — Asia/Jakarta (UTC+7)</option>
            <option value="Asia/Makassar" ${tz === 'Asia/Makassar' ? 'selected' : ''}>WITA — Asia/Makassar (UTC+8)</option>
            <option value="Asia/Jayapura" ${tz === 'Asia/Jayapura' ? 'selected' : ''}>WIT — Asia/Jayapura (UTC+9)</option>
            <option value="UTC" ${tz === 'UTC' ? 'selected' : ''}>UTC — Coordinated Universal Time (UTC+0)</option>
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
            <option value="id" ${lang === 'id' ? 'selected' : ''}>Bahasa Indonesia</option>
            <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Logo Aplikasi</div>
          <div class="settings-item-desc">Upload foto/logo untuk sidebar dan header (Maks 2MB)</div>
        </div>
        <div class="settings-item-control" style="display:flex; flex-direction:column; gap:10px; align-items:flex-start;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div id="logo-preview-box" style="width:52px; height:52px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.2);">
              ${activeLogo ? `<img src="${activeLogo}" style="width:100%; height:100%; object-fit:contain;" alt="Logo" />` : '<span style="font-size:1.6rem;">📡</span>'}
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <input type="file" id="logo-file-input" accept="image/png, image/jpeg, image/webp, image/svg+xml" style="display:none;" />
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-secondary btn-sm" id="choose-logo-btn">📁 Pilih Foto Logo</button>
                <button type="button" class="btn btn-ghost btn-sm" id="reset-logo-btn" style="${activeLogo ? '' : 'display:none;'} color:var(--color-danger);">↺ Reset Default</button>
              </div>
              <span style="font-size:0.75rem; color:var(--color-muted);">Format: PNG, JPG, WebP, SVG (Maks. 2MB)</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary" id="save-umum-btn">💾 Simpan Pengaturan</button>
      </div>
    </div>
  `;
}

function renderMonitoring() {
  const interval = String(getVal('default_ping_interval', '60'));
  const retry = String(getVal('ping_retry_count', '3'));
  const engineActive = getVal('engine_active', 'true') === 'true';

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
            <option value="30" ${interval === '30' ? 'selected' : ''}>30 detik</option>
            <option value="60" ${interval === '60' ? 'selected' : ''}>60 detik (default)</option>
            <option value="120" ${interval === '120' ? 'selected' : ''}>2 menit</option>
            <option value="300" ${interval === '300' ? 'selected' : ''}>5 menit</option>
            <option value="600" ${interval === '600' ? 'selected' : ''}>10 menit</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Timeout Ping (ms)</div>
          <div class="settings-item-desc">Waktu tunggu respons ping sebelum dianggap timeout</div>
        </div>
        <div class="settings-item-control">
          <input type="number" class="form-control" id="set-timeout" value="${getVal('ping_timeout_ms', '3000')}" min="500" max="10000" />
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Retry Count</div>
          <div class="settings-item-desc">Jumlah percobaan ulang sebelum mengubah status ke Offline</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-retry">
            <option value="1" ${retry === '1' ? 'selected' : ''}>1x</option>
            <option value="2" ${retry === '2' ? 'selected' : ''}>2x</option>
            <option value="3" ${retry === '3' ? 'selected' : ''}>3x (rekomendasi)</option>
            <option value="5" ${retry === '5' ? 'selected' : ''}>5x</option>
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
            <input type="checkbox" class="toggle-input" id="set-engine-active" ${engineActive ? 'checked' : ''} />
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
  const pushActive = getVal('browser_push_enabled', 'true') === 'true';
  const maintActive = getVal('maint_reminder_enabled', 'true') === 'true';

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
            <input type="checkbox" class="toggle-input" id="set-push-notif" ${pushActive ? 'checked' : ''} />
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
          <input type="time" class="form-control" id="set-notif-dari" value="${getVal('work_hours_start', '07:00')}" style="width:auto;" />
          <span style="color:var(--color-muted);">–</span>
          <input type="time" class="form-control" id="set-notif-sampai" value="${getVal('work_hours_end', '17:00')}" style="width:auto;" />
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Notif Maintenance Reminder</div>
          <div class="settings-item-desc">Notifikasi saat estimasi maintenance terlewat</div>
        </div>
        <div class="settings-item-control">
          <label class="toggle-wrapper">
            <input type="checkbox" class="toggle-input" id="set-maint-notif" ${maintActive ? 'checked' : ''} />
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
  const timeout = String(getVal('session_timeout_minutes', '60'));
  const limit = String(getVal('max_login_attempts', '5'));
  const lockout = String(getVal('lockout_duration_minutes', '15'));
  const https = getVal('enforce_https', 'true') === 'true';

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
            <option value="30" ${timeout === '30' ? 'selected' : ''}>30 menit</option>
            <option value="60" ${timeout === '60' ? 'selected' : ''}>1 jam</option>
            <option value="240" ${timeout === '240' ? 'selected' : ''}>4 jam</option>
            <option value="480" ${timeout === '480' ? 'selected' : ''}>8 jam</option>
            <option value="0" ${timeout === '0' ? 'selected' : ''}>Tidak ada timeout</option>
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
            <option value="3" ${limit === '3' ? 'selected' : ''}>3x percobaan</option>
            <option value="5" ${limit === '5' ? 'selected' : ''}>5x percobaan (default)</option>
            <option value="10" ${limit === '10' ? 'selected' : ''}>10x percobaan</option>
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
            <option value="5" ${lockout === '5' ? 'selected' : ''}>5 menit</option>
            <option value="15" ${lockout === '15' ? 'selected' : ''}>15 menit (default)</option>
            <option value="30" ${lockout === '30' ? 'selected' : ''}>30 menit</option>
            <option value="60" ${lockout === '60' ? 'selected' : ''}>1 jam</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Whitelist IP Admin</div>
          <div class="settings-item-desc">Batasi akses admin hanya dari IP tertentu (opsional, kosongkan untuk nonaktif)</div>
        </div>
        <div class="settings-item-control">
          <textarea class="form-control" id="set-whitelist-ip" placeholder="Contoh:&#10;192.168.1.5&#10;192.168.1.8" style="min-height:70px;">${getVal('ip_whitelist', '')}</textarea>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Enforce HTTPS</div>
          <div class="settings-item-desc">Paksa semua koneksi menggunakan HTTPS</div>
        </div>
        <div class="settings-item-control">
          <label class="toggle-wrapper">
            <input type="checkbox" class="toggle-input" id="set-https" ${https ? 'checked' : ''} />
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
  const retention = String(getVal('retention_days', '90'));
  const autoDel = getVal('auto_backup_enabled', 'true') === 'true';
  const sched = getVal('backup_schedule', 'daily');

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
            <option value="30" ${retention === '30' ? 'selected' : ''}>30 hari</option>
            <option value="60" ${retention === '60' ? 'selected' : ''}>60 hari</option>
            <option value="90" ${retention === '90' ? 'selected' : ''}>90 hari (default)</option>
            <option value="180" ${retention === '180' ? 'selected' : ''}>180 hari</option>
            <option value="365" ${retention === '365' ? 'selected' : ''}>1 tahun</option>
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
            <input type="checkbox" class="toggle-input" id="set-auto-delete" ${autoDel ? 'checked' : ''} />
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
            <option value="daily" ${sched === 'daily' ? 'selected' : ''}>Setiap hari (01:00 WIB)</option>
            <option value="weekly" ${sched === 'weekly' ? 'selected' : ''}>Setiap Senin (01:00 WIB)</option>
            <option value="monthly" ${sched === 'monthly' ? 'selected' : ''}>Setiap bulan (tanggal 1)</option>
            <option value="none" ${sched === 'none' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Lokasi Backup</div>
          <div class="settings-item-desc">Folder tujuan backup database (path lokal server)</div>
        </div>
        <div class="settings-item-control">
          <input type="text" class="form-control" id="set-backup-path" value="${getVal('backup_target_path', 'D:\\Backup\\DevWatch')}" />
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
  const weekly = getVal('auto_weekly_report', 'true') === 'true';

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
            <input type="checkbox" class="toggle-input" id="set-weekly-report" ${weekly ? 'checked' : ''} />
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
          <input type="time" class="form-control" id="set-report-time" value="${getVal('report_time', '07:00')}" style="width:auto;" />
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Penerima Laporan</div>
          <div class="settings-item-desc">Email yang menerima laporan mingguan (satu per baris)</div>
        </div>
        <div class="settings-item-control">
          <textarea class="form-control" id="set-report-recipients" placeholder="admin@kantor.com&#10;manager@kantor.com" style="min-height:70px;">${getVal('report_recipients', 'admin@kantor.com')}</textarea>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Target SLA Global</div>
          <div class="settings-item-desc">Target uptime default untuk semua device (%)</div>
        </div>
        <div class="settings-item-control">
          <input type="number" class="form-control" id="set-sla-target" value="${getVal('target_sla', '99')}" min="90" max="100" step="0.1" />
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="btn btn-primary" id="save-laporan-btn">💾 Simpan Pengaturan</button>
      </div>
    </div>
  `;
}

export async function initSettingsEvents() {
  // Sync latest from backend on mount
  try {
    const res = await apiGetSettings();
    if (res && res.data) {
      // Flatten or merge settings data
      for (const [k, v] of Object.entries(res.data)) {
        if (typeof v === 'object' && v !== null) {
          Object.assign(currentSettings, v);
        } else {
          currentSettings[k] = v;
        }
      }
      const content = document.getElementById('settings-content');
      if (content) {
        content.innerHTML = renderSettingsSection(activeSection);
        bindSaveButtons();
      }
    }
  } catch (err) {
    console.warn('Gagal memuat pengaturan database:', err);
  }

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
  const chooseLogoBtn = document.getElementById('choose-logo-btn');
  const logoFileInput = document.getElementById('logo-file-input');
  const resetLogoBtn = document.getElementById('reset-logo-btn');
  const previewBox = document.getElementById('logo-preview-box');

  if (chooseLogoBtn && logoFileInput) {
    chooseLogoBtn.onclick = () => logoFileInput.click();

    logoFileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'Berkas Terlalu Besar',
          text: 'Ukuran foto logo maksimal 2 MB.',
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
        logoFileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        stagedLogo = event.target.result;
        if (previewBox) {
          previewBox.innerHTML = `<img src="${stagedLogo}" style="width:100%; height:100%; object-fit:contain;" alt="Logo" />`;
        }
        if (resetLogoBtn) resetLogoBtn.style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
    };
  }

  if (resetLogoBtn) {
    resetLogoBtn.onclick = () => {
      stagedLogo = '';
      if (previewBox) {
        previewBox.innerHTML = '<span style="font-size:1.6rem;">📡</span>';
      }
      resetLogoBtn.style.display = 'none';
      if (logoFileInput) logoFileInput.value = '';
    };
  }

  const sectionExtractors = {
    'save-umum-btn': () => {
      const payload = {
        app_name: document.getElementById('set-app-name')?.value,
        timezone: document.getElementById('set-timezone')?.value,
        language: document.getElementById('set-lang')?.value,
      };
      if (stagedLogo !== undefined) {
        payload.app_logo = stagedLogo;
      }
      return payload;
    },
    'save-monitoring-btn': () => ({
      default_ping_interval: document.getElementById('set-interval')?.value,
      ping_timeout_ms: document.getElementById('set-timeout')?.value,
      ping_retry_count: document.getElementById('set-retry')?.value,
      engine_active: String(document.getElementById('set-engine-active')?.checked ?? true),
    }),
    'save-notif-btn': () => ({
      browser_push_enabled: String(document.getElementById('set-push-notif')?.checked ?? true),
      work_hours_start: document.getElementById('set-notif-dari')?.value,
      work_hours_end: document.getElementById('set-notif-sampai')?.value,
      maint_reminder_enabled: String(document.getElementById('set-maint-notif')?.checked ?? true),
    }),
    'save-keamanan-btn': () => ({
      session_timeout_minutes: document.getElementById('set-session-timeout')?.value,
      max_login_attempts: document.getElementById('set-login-limit')?.value,
      lockout_duration_minutes: document.getElementById('set-lockout')?.value,
      ip_whitelist: document.getElementById('set-whitelist-ip')?.value,
      enforce_https: String(document.getElementById('set-https')?.checked ?? true),
    }),
    'save-log-btn': () => ({
      retention_days: document.getElementById('set-log-retention')?.value,
      auto_backup_enabled: String(document.getElementById('set-auto-delete')?.checked ?? true),
      backup_schedule: document.getElementById('set-backup-schedule')?.value,
      backup_target_path: document.getElementById('set-backup-path')?.value,
    }),
    'save-laporan-btn': () => ({
      auto_weekly_report: String(document.getElementById('set-weekly-report')?.checked ?? true),
      report_time: document.getElementById('set-report-time')?.value,
      report_recipients: document.getElementById('set-report-recipients')?.value,
      target_sla: document.getElementById('set-sla-target')?.value,
    }),
  };

  Object.entries(sectionExtractors).forEach(([btnId, extractor]) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.onclick = async () => {
      try {
        const payload = extractor();
        // Remove undefined
        for (const k of Object.keys(payload)) {
          if (payload[k] === undefined) delete payload[k];
        }

        if (Object.keys(payload).length > 0) {
          await apiUpdateSettings(payload);
          Object.assign(currentSettings, payload);
          applySystemSettings(payload);
        }

        Swal.fire({
          icon: 'success',
          title: 'Pengaturan Disimpan',
          text: 'Perubahan pengaturan berhasil disimpan permanen ke database.',
          timer: 1800,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menyimpan',
          text: err.message,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      }
    };
  });

  // Manual backup button
  const manualBackupBtn = document.getElementById('manual-backup-btn');
  if (manualBackupBtn) {
    manualBackupBtn.onclick = async () => {
      await Swal.fire({
        title: 'Backup Database',
        html: '<div style="text-align:center;"><div class="spinner spinner-lg" style="margin:0 auto;"></div><p style="margin-top:12px; color:#94a3b8;">Membuat backup database SQLite ke direktori tujuan...</p></div>',
        showConfirmButton: false,
        allowOutsideClick: false,
        timer: 1500,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
      const backupPath = getVal('backup_target_path', 'D:\\Backup\\DevWatch');
      Swal.fire({
        icon: 'success',
        title: 'Backup Berhasil',
        text: `Database berhasil dibackup ke ${backupPath}\\devwatch-${new Date().toISOString().slice(0, 10)}.sqlite`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#6366f1',
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    };
  }
}
