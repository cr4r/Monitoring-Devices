// ================================================================
// DevWatch - settings.js
// Pengaturan sistem: 6 kategori, form save dengan SweetAlert & database sync
// ================================================================

import Swal from 'sweetalert2';
import { apiGetSettings, apiUpdateSettings, apiTriggerBackup, apiRestoreBackup, apiCleanLogs, apiGetLogsStats, apiPreviewCleanLogs } from '../api.js';
import { applySystemSettings } from '../settingsManager.js';
import { applyTheme, getSavedTheme } from '../themeManager.js';

let activeSection = 'umum';
let stagedLogo = undefined;
let currentSettings = {
  app_name: 'MonDev',
  app_logo: '',
  theme: 'auto',
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
  backup_target_path: 'D:\\Backup\\MonDev',
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
  const currentThemeVal = getSavedTheme();
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
          <input type="text" class="form-control" id="set-app-name" value="${getVal('app_name', 'MonDev')}" />
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Tema Tampilan</div>
          <div class="settings-item-desc">Tema warna aplikasi</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-theme">
            <option value="dark" ${currentThemeVal === 'dark' ? 'selected' : ''}>🌙 Mode Gelap</option>
            <option value="light" ${currentThemeVal === 'light' ? 'selected' : ''}>☀️ Mode Terang Lembut</option>
            <option value="auto" ${currentThemeVal === 'auto' ? 'selected' : ''}>💻 Otomatis (Sistem OS)</option>
          </select>
        </div>
      </div>

      <div class="settings-item">
        <div class="settings-item-info">
          <div class="settings-item-label">Zona Waktu</div>
          <div class="settings-item-desc">Zona waktu untuk jam antarmuka, riwayat log, dan laporan</div>
        </div>
        <div class="settings-item-control">
          <select class="form-control" id="set-timezone">
            <option value="Asia/Jakarta" ${tz === 'Asia/Jakarta' ? 'selected' : ''}>WIB - Asia/Jakarta (UTC+7)</option>
            <option value="Asia/Makassar" ${tz === 'Asia/Makassar' ? 'selected' : ''}>WITA - Asia/Makassar (UTC+8)</option>
            <option value="Asia/Jayapura" ${tz === 'Asia/Jayapura' ? 'selected' : ''}>WIT - Asia/Jayapura (UTC+9)</option>
            <option value="UTC" ${tz === 'UTC' ? 'selected' : ''}>UTC - Coordinated Universal Time (UTC+0)</option>
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
            <div id="logo-preview-box" style="width:52px; height:52px; border-radius:10px; background:${activeLogo ? 'transparent' : 'rgba(255,255,255,0.06)'}; border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.2);">
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
  const autoDel = getVal('auto_delete_logs_enabled', getVal('auto_backup_enabled', 'true')) === 'true';
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
          <input type="text" class="form-control" id="set-backup-path" value="${getVal('backup_target_path', 'D:\\Backup\\MonDev')}" />
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:8px; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-secondary" id="manual-backup-btn">💾 Backup Data</button>
          <button class="btn btn-secondary" id="restore-backup-btn" style="border-color:rgba(99,102,241,0.4); color:#c7d2fe;">📤 Restore Data</button>
          <button class="btn btn-secondary" id="clean-logs-btn" style="border-color:rgba(239,68,68,0.4); color:#fca5a5;">🧹 Bersihkan Log Lama</button>
        </div>
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
          previewBox.style.background = 'transparent';
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
        previewBox.style.background = 'rgba(255,255,255,0.06)';
        previewBox.innerHTML = '<span style="font-size:1.6rem;">📡</span>';
      }
      resetLogoBtn.style.display = 'none';
      if (logoFileInput) logoFileInput.value = '';
    };
  }

  const setThemeSelect = document.getElementById('set-theme');
  if (setThemeSelect) {
    setThemeSelect.onchange = (e) => {
      applyTheme(e.target.value, false);
    };
  }

  const sectionExtractors = {
    'save-umum-btn': () => {
      const payload = {
        app_name: document.getElementById('set-app-name')?.value,
        timezone: document.getElementById('set-timezone')?.value,
        language: document.getElementById('set-lang')?.value,
        theme: document.getElementById('set-theme')?.value,
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
      auto_delete_logs_enabled: String(document.getElementById('set-auto-delete')?.checked ?? true),
      auto_backup_enabled: String(document.getElementById('set-backup-schedule')?.value !== 'none'),
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

  // Manual backup button dengan pilihan Log Saja vs Full System
  const manualBackupBtn = document.getElementById('manual-backup-btn');
  if (manualBackupBtn) {
    manualBackupBtn.onclick = async () => {
      const { value: scope, isConfirmed } = await Swal.fire({
        title: '💾 Buat Cadangan Sistem',
        html: `
          <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
            <p style="font-size:0.85rem; color:#94a3b8; margin:0;">Pilih cakupan data yang ingin Anda cadangkan:</p>

            <label style="display:flex; align-items:start; gap:10px; padding:12px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.25); border-radius:8px; cursor:pointer;">
              <input type="radio" name="swal-backup-scope" value="logs" checked style="margin-top:3px; accent-color:#6366f1;" />
              <div>
                <div style="font-weight:700; color:var(--color-heading); font-size:0.88rem;">📋 Backup Log Saja</div>
                <div style="font-size:0.75rem; color:var(--color-muted);">Riwayat status perangkat, aktivitas pengguna, insiden, dan log konfigurasi (JSON ringkas).</div>
              </div>
            </label>

            <label style="display:flex; align-items:start; gap:10px; padding:12px; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.25); border-radius:8px; cursor:pointer;">
              <input type="radio" name="swal-backup-scope" value="full" style="margin-top:3px; accent-color:#22c55e;" />
              <div>
                <div style="font-weight:700; color:var(--color-heading); font-size:0.88rem;">💾 Backup Seluruhnya (Full System)</div>
                <div style="font-size:0.75rem; color:var(--color-muted);">Semua perangkat, topologi, snapshot kamera, akun pengguna, seluruh pengaturan, dan log.</div>
              </div>
            </label>
          </div>
        `,
        width: 540,
        showCancelButton: true,
        confirmButtonText: '⚡ Buat Cadangan Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#6366f1',
        cancelButtonColor: '#374151',
        background: '#1a1d2e',
        color: '#e2e8f0',
        preConfirm: () => {
          return document.querySelector('input[name="swal-backup-scope"]:checked')?.value || 'logs';
        },
      });

      if (!isConfirmed || !scope) return;

      Swal.fire({
        title: scope === 'full' ? 'Menyiapkan Cadangan Seluruh Sistem...' : 'Menyiapkan Cadangan Log...',
        html: '<div style="text-align:center;"><div class="spinner spinner-lg" style="margin:0 auto;"></div><p style="margin-top:12px; color:#94a3b8;">Menyalin dan mengompresi data cadangan aman...</p></div>',
        showConfirmButton: false,
        allowOutsideClick: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });

      try {
        const res = await apiTriggerBackup(scope);
        const data = res.data || {};
        const token = localStorage.getItem('token') || '';
        const downloadFilename = data.filename || '';
        const downloadUrl = `/api/settings/backup/download?filename=${encodeURIComponent(downloadFilename)}&token=${encodeURIComponent(token)}`;

        Swal.fire({
          icon: 'success',
          title: 'Cadangan Berhasil Dibuat',
          html: `
            <div style="text-align:left; font-size:0.85rem; color:#94a3b8;">
              <p>Berkas cadangan (<b>${scope === 'full' ? 'Seluruh Sistem' : 'Log Sistem'}</b>) berhasil disimpan di server:</p>
              <div style="margin:8px 0; padding:8px 12px; background:rgba(255,255,255,0.05); border-radius:6px; font-family:var(--font-mono); color:#e2e8f0;">
                <b>${data.filename || 'devwatch-backup'}</b> (${data.sizeKb || 0} KB)
              </div>
              <p style="font-size:0.78rem; color:#64748b;">Lokasi: ${data.filepath || 'Folder backups server'}</p>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: `📥 Unduh Berkas (${data.filename?.endsWith('.json') ? '.json' : '.sqlite'})`,
          cancelButtonText: 'Tutup',
          confirmButtonColor: '#6366f1',
          cancelButtonColor: '#374151',
          background: '#1a1d2e',
          color: '#e2e8f0',
        }).then((result) => {
          if (result.isConfirmed) {
            window.location.href = downloadUrl;
          }
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Membuat Cadangan',
          text: err.message,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      }
    };
  }

  // Restore backup button (Full system or logs restore)
  const restoreBackupBtn = document.getElementById('restore-backup-btn');
  if (restoreBackupBtn) {
    restoreBackupBtn.onclick = async () => {
      let selectedFile = null;

      const { isConfirmed } = await Swal.fire({
        title: '📤 Pulihkan Data Sistem (Restore)',
        html: `
          <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
            <div style="padding:10px 14px; background:rgba(234,179,8,0.12); border:1px solid rgba(234,179,8,0.3); border-radius:8px; font-size:0.8rem; color:#fde047;">
              ⚠️ <b>Peringatan Keamanan</b>: Memulihkan cadangan akan menyelaraskan data sistem dengan berkas cadangan. Server akan secara otomatis membuat <i>safety checkpoint</i> sebelum pemulihan dijalankan.
            </div>

            <div class="csv-drop-zone" id="restore-drop-zone" style="cursor:pointer; border:2px dashed rgba(99,102,241,0.4); border-radius:10px; padding:24px 16px; text-align:center; background:rgba(15,23,42,0.4); transition:all 0.2s ease;">
              <input type="file" id="restore-file-input" accept=".json,.sqlite" style="display:none;" />
              <div style="font-size:2.2rem; margin-bottom:8px;">📤</div>
              <div style="font-weight:700; color:var(--color-heading); font-size:0.9rem;" id="restore-file-label">Klik untuk memilih berkas cadangan (.json / .sqlite)</div>
              <div style="font-size:0.75rem; color:var(--color-muted); margin-top:4px;" id="restore-file-sub">Mendukung file JSON Log atau Database SQLite MonDev</div>
            </div>
          </div>
        `,
        width: 580,
        showCancelButton: true,
        confirmButtonText: '⚡ Mulai Pemulihan (Restore)',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#374151',
        background: '#1a1d2e',
        color: '#e2e8f0',
        didOpen: () => {
          const dropZone = document.getElementById('restore-drop-zone');
          const fileInput = document.getElementById('restore-file-input');
          const label = document.getElementById('restore-file-label');
          const sub = document.getElementById('restore-file-sub');

          dropZone?.addEventListener('click', () => fileInput?.click());
          fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
              selectedFile = file;
              if (label) label.textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
              if (sub) sub.textContent = 'Berkas siap untuk diproses dan dipulihkan ke server.';
              if (dropZone) {
                dropZone.style.borderColor = '#10b981';
                dropZone.style.background = 'rgba(16, 185, 129, 0.08)';
              }
            }
          });
        },
        preConfirm: () => {
          if (!selectedFile) {
            Swal.showValidationMessage('Silakan pilih berkas cadangan (.json atau .sqlite) terlebih dahulu.');
            return false;
          }
          return true;
        },
      });

      if (!isConfirmed || !selectedFile) return;

      Swal.fire({
        title: 'Memproses Pemulihan Data...',
        html: '<div style="text-align:center;"><div class="spinner spinner-lg" style="margin:0 auto;"></div><p style="margin-top:12px; color:#94a3b8;">Menyimpan checkpoint keamanan dan menerapkan data cadangan...</p></div>',
        showConfirmButton: false,
        allowOutsideClick: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });

      try {
        const isJson = selectedFile.name.endsWith('.json');
        let payload = {};

        if (isJson) {
          const text = await selectedFile.text();
          const parsed = JSON.parse(text);
          payload = { backupData: parsed, filename: selectedFile.name };
        } else {
          // File SQLite biner: kirim via base64
          const arrayBuf = await selectedFile.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          payload = { fileBase64: base64, filename: selectedFile.name };
        }

        const res = await apiRestoreBackup(payload);
        const restored = res.restored || {};

        Swal.fire({
          icon: 'success',
          title: 'Pemulihan Sistem Berhasil',
          html: `
            <div style="text-align:left; font-size:0.85rem; color:#94a3b8;">
              <p>${res.message || 'Data sistem berhasil dipulihkan.'}</p>
              <div style="margin:10px 0; padding:10px 14px; background:rgba(255,255,255,0.05); border-radius:6px; font-size:0.8rem;">
                <div>• Perangkat Dipulihkan: <b style="color:#10b981;">${restored.devices ?? (res.type === 'sqlite' ? 'Semua' : 0)}</b></div>
                <div>• Baris Log Dipulihkan: <b style="color:#6366f1;">${restored.logs ?? (res.type === 'sqlite' ? 'Semua' : 0)}</b></div>
                <div>• Pengaturan Dipulihkan: <b style="color:#f59e0b;">${restored.settings ?? (res.type === 'sqlite' ? 'Semua' : 0)}</b></div>
                ${res.safetyCheckpoint ? `<div style="margin-top:6px; font-size:0.75rem; color:#64748b;">Safety Checkpoint: <b>${res.safetyCheckpoint}</b></div>` : ''}
              </div>
              <p style="font-size:0.75rem; color:#cbd5e1;">Aplikasi akan memperbarui data tampilan secara otomatis.</p>
            </div>
          `,
          background: '#1a1d2e',
          color: '#e2e8f0',
        }).then(() => {
          window.location.reload();
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Memulihkan Cadangan',
          text: err.message,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      }
    };
  }

  // Clean logs button (Real log cleanup with stats & flexible retention)
  const cleanLogsBtn = document.getElementById('clean-logs-btn');
  if (cleanLogsBtn) {
    cleanLogsBtn.onclick = async () => {
      // 1. Ambil statistik log terkini
      let stats = { total: 0, status: { count: 0 }, activity: { count: 0 }, config: { count: 0 }, oldestAll: null };
      try {
        const statRes = await apiGetLogsStats();
        if (statRes && statRes.stats) {
          stats = statRes.stats;
        }
      } catch (err) {
        console.warn('Gagal memuat statistik log:', err.message);
      }

      // Hitung umur log tertua
      let oldestDays = 0;
      let oldestDesc = 'Belum ada log';
      if (stats.oldestAll) {
        const oldestDate = new Date(stats.oldestAll);
        const now = new Date();
        const diffMs = Math.max(0, now - oldestDate);
        oldestDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const oldestHours = Math.floor(diffMs / (1000 * 60 * 60));
        oldestDesc = oldestDays > 0 ? `${oldestDays} hari yang lalu` : `${oldestHours} jam yang lalu`;
      }

      const currentRetention = getVal('retention_days', '90');

      const { isConfirmed } = await Swal.fire({
        title: '🧹 Bersihkan Log Sistem',
        html: `
          <div style="text-align:left; font-size:0.85rem; color:#94a3b8; display:flex; flex-direction:column; gap:12px;">
            <!-- Ringkasan Log Saat Ini -->
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700; color:var(--color-heading);">📊 Log Tersimpan Saat Ini:</span>
                <span style="background:rgba(99,102,241,0.2); color:#818cf8; font-weight:700; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${stats.total} Total Baris</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.78rem;">
                <div>• Log Status: <b>${stats.status?.count || 0}</b></div>
                <div>• Log Aktivitas: <b>${stats.activity?.count || 0}</b></div>
                <div>• Log Konfigurasi: <b>${stats.config?.count || 0}</b></div>
                <div>• Rekaman Tertua: <b style="color:var(--color-heading);">${oldestDesc}</b></div>
              </div>
            </div>

            <!-- Form Pilihan Batas Pembersihan -->
            <div>
              <label style="font-weight:600; color:var(--color-heading); display:block; margin-bottom:4px;">Pilih Kriteria Pembersihan:</label>
              <select class="form-control" id="swal-clean-retention" style="width:100%;">
                <option value="0">⚠️ Semua Log (Hapus Total / Kosongkan Riwayat)</option>
                <option value="h1">Lebih dari 1 jam lalu (Uji coba cepat)</option>
                <option value="h6">Lebih dari 6 jam lalu</option>
                <option value="h12">Lebih dari 12 jam lalu</option>
                <option value="1">Lebih dari 1 hari lalu (Kemarin & sebelumnya)</option>
                <option value="3">Lebih dari 3 hari lalu</option>
                <option value="7">Lebih dari 7 hari lalu (1 minggu)</option>
                <option value="14">Lebih dari 14 hari lalu (2 minggu)</option>
                <option value="30" ${currentRetention === '30' ? 'selected' : ''}>Lebih dari 30 hari lalu (1 bulan)</option>
                <option value="60" ${currentRetention === '60' ? 'selected' : ''}>Lebih dari 60 hari lalu (2 bulan)</option>
                <option value="90" ${currentRetention === '90' || !['0','h1','h6','h12','1','3','7','14','30','60','180'].includes(currentRetention) ? 'selected' : ''}>Lebih dari 90 hari lalu (3 bulan - standar)</option>
                <option value="180" ${currentRetention === '180' ? 'selected' : ''}>Lebih dari 180 hari lalu (6 bulan)</option>
              </select>
            </div>

            <!-- Kotak Penjelasan Dinamis -->
            <div id="swal-clean-hint" style="border-radius:6px; padding:8px 12px; font-size:0.78rem; transition:all 0.2s ease;"></div>
          </div>
        `,
        icon: 'warning',
        width: 520,
        showCancelButton: true,
        confirmButtonText: '🧹 Bersihkan Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#374151',
        background: '#1a1d2e',
        color: '#e2e8f0',
        didOpen: () => {
          const select = document.getElementById('swal-clean-retention');
          const hint = document.getElementById('swal-clean-hint');

          const updateHint = async () => {
            if (!select || !hint) return;
            const val = select.value;
            const isHours = val.startsWith('h');
            const num = parseInt(val.replace('h', ''), 10);

            if (val === '0') {
              hint.style.background = 'rgba(239, 68, 68, 0.12)';
              hint.style.border = '1px solid rgba(239, 68, 68, 0.3)';
              hint.style.color = '#fca5a5';
              hint.innerHTML = `⚠️ <b>Peringatan Hapus Total</b>: Seluruh <b>${stats.total}</b> baris log status, aktivitas, dan riwayat konfigurasi akan dikosongkan permanen.`;
              return;
            }

            hint.style.background = 'rgba(99, 102, 241, 0.08)';
            hint.style.border = '1px solid rgba(99, 102, 241, 0.2)';
            hint.style.color = '#c7d2fe';
            hint.innerHTML = `⏳ Menghitung baris log yang cocok...`;

            try {
              const previewQuery = isHours ? { hours: num } : { days: num };
              const prev = await apiPreviewCleanLogs(previewQuery);
              const matchTotal = prev.total || 0;

              if (matchTotal === 0) {
                hint.style.background = 'rgba(245, 158, 11, 0.12)';
                hint.style.border = '1px solid rgba(245, 158, 11, 0.3)';
                hint.style.color = '#fcd34d';
                hint.innerHTML = `ℹ️ <b>Hasil Evaluasi: 0 baris log cocok</b>. Seluruh log yang tercatat saat ini masih lebih baru dari batas <b>${isHours ? num + ' jam' : num + ' hari'}</b> lalu (log tertua berumur ${oldestDesc}). Tidak ada log yang akan dihapus. Pilih kriteria lebih singkat atau <b>Semua Log</b> jika ingin mengosongkan riwayat.`;
              } else {
                hint.style.background = 'rgba(16, 185, 129, 0.12)';
                hint.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                hint.style.color = '#6ee7b7';
                hint.innerHTML = `✓ <b>${matchTotal} baris log ditemukan</b> yang lebih lama dari <b>${isHours ? num + ' jam' : num + ' hari'}</b> lalu (${prev.statusLogs || 0} status, ${prev.activityLogs || 0} aktivitas, ${prev.configLogs || 0} config). Baris-baris ini akan dihapus permanen.`;
              }
            } catch {
              hint.innerHTML = `✓ Seluruh log yang tercatat lebih dari <b>${isHours ? num + ' jam' : num + ' hari'}</b> lalu akan dibersihkan.`;
            }
          };

          select?.addEventListener('change', updateHint);
          updateHint();
        },
      });

      if (isConfirmed) {
        const select = document.getElementById('swal-clean-retention');
        const val = select ? select.value : '90';
        const isHours = val.startsWith('h');
        const num = parseInt(val.replace('h', ''), 10);
        const cleanPayload = isHours ? { retentionHours: num } : { retentionDays: num };

        Swal.fire({
          title: 'Membersihkan Log...',
          didOpen: () => Swal.showLoading(),
          showConfirmButton: false,
          allowOutsideClick: false,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });

        try {
          const res = await apiCleanLogs(cleanPayload);
          const del = res.deleted || {};
          window.dispatchEvent(new CustomEvent('devwatch:logs_updated', { detail: { action: 'clean_logs', ...cleanPayload } }));

          Swal.fire({
            icon: 'success',
            title: 'Pembersihan Selesai',
            html: `
              <div style="font-size:0.85rem; color:#94a3b8;">
                <p>${res.message || 'Pembersihan log berhasil.'}</p>
                <div style="margin-top:10px; display:inline-block; text-align:left; font-size:0.8rem; background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.08);">
                  <div>• Log Status: <b style="color:#10b981;">${del.statusLogs || 0}</b> dihapus</div>
                  <div>• Log Aktivitas: <b style="color:#10b981;">${del.activityLogs || 0}</b> dihapus</div>
                  <div>• Log Konfigurasi: <b style="color:#10b981;">${del.configLogs || 0}</b> dihapus</div>
                  <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-weight:700; color:var(--color-heading);">
                    Total Dihapus: <b>${del.total || 0}</b> baris
                  </div>
                </div>
              </div>
            `,
            background: '#1a1d2e',
            color: '#e2e8f0',
          });
        } catch (err) {
          Swal.fire({
            icon: 'error',
            title: 'Gagal Membersihkan Log',
            text: err.message,
            background: '#1a1d2e',
            color: '#e2e8f0',
          });
        }
      }
    };
  }
}
