// ================================================================
// DevWatch — settingsManager.js
// Pengelola pengaturan sistem dinamis (Nama Aplikasi, Zona Waktu, dsb)
// ================================================================

import { apiGetSettings } from './api.js';
import { setLanguage } from './i18n.js';

let cachedSettings = {
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

export function getAppSetting(key, fallback = '') {
  return cachedSettings[key] !== undefined ? cachedSettings[key] : fallback;
}

export function getAllSettings() {
  return { ...cachedSettings };
}

export function applySystemSettings(newSettings = {}) {
  // Gabungkan pengaturan baru ke cache
  Object.assign(cachedSettings, newSettings);

  const appName = cachedSettings.app_name || 'DevWatch';
  const appLogo = cachedSettings.app_logo;
  const lang = cachedSettings.language || 'id';

  // 1. Terapkan bahasa ke i18n
  setLanguage(lang);

  // 2. Ubah document.title browser
  if (typeof document !== 'undefined') {
    document.title = `${appName} — Device Monitoring System`;

    // 3. Ubah semua logo dan judul di antarmuka (Sidebar, Login, Footer)
    document.querySelectorAll('.sidebar-logo-name').forEach((el) => {
      el.textContent = appName;
    });

    document.querySelectorAll('.brand-app-name').forEach((el) => {
      el.textContent = appName;
    });

    // 4. Ubah icon logo sidebar dengan logo custom jika ada
    document.querySelectorAll('.sidebar-logo-icon').forEach((el) => {
      if (appLogo) {
        el.innerHTML = `<img src="${appLogo}" class="custom-app-logo" style="width:32px;height:32px;object-fit:contain;border-radius:6px;" alt="Logo" />`;
      } else {
        el.innerHTML = '📡';
      }
    });

    // 5. Simpan ke localStorage agar render pertama langsung konsisten
    try {
      localStorage.setItem('devwatch_app_name', appName);
      localStorage.setItem('devwatch_timezone', cachedSettings.timezone || 'Asia/Jakarta');
      localStorage.setItem('devwatch_language', lang);
      if (appLogo) {
        localStorage.setItem('devwatch_app_logo', appLogo);
      } else {
        localStorage.removeItem('devwatch_app_logo');
      }
    } catch {
      // Abaikan jika storage penuh
    }

    // 6. Pancarkan event agar komponen lain bisa bereaksi seketika
    window.dispatchEvent(
      new CustomEvent('devwatch:settings_updated', {
        detail: { settings: cachedSettings },
      })
    );
    window.dispatchEvent(
      new CustomEvent('devwatch:language_changed', {
        detail: { language: lang },
      })
    );
  }
}

export function formatDateWithTz(dateInput, options = {}) {
  if (!dateInput) return '—';
  try {
    const tz = cachedSettings.timezone || 'Asia/Jakarta';
    const lang = cachedSettings.language === 'en' ? 'en-US' : 'id-ID';
    return new Date(dateInput).toLocaleString(lang, {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...options,
    });
  } catch {
    return String(dateInput);
  }
}

export async function initSettingsManager() {
  // Baca cache lokal lebih dulu untuk respon instan
  try {
    const savedName = localStorage.getItem('devwatch_app_name');
    const savedTz = localStorage.getItem('devwatch_timezone');
    const savedLang = localStorage.getItem('devwatch_language');
    const savedLogo = localStorage.getItem('devwatch_app_logo');
    if (savedName) cachedSettings.app_name = savedName;
    if (savedTz) cachedSettings.timezone = savedTz;
    if (savedLang) cachedSettings.language = savedLang;
    if (savedLogo) cachedSettings.app_logo = savedLogo;
    applySystemSettings({});
  } catch {
    // Abaikan
  }

  // Sinkronkan data riil dari database SQLite
  try {
    const res = await apiGetSettings();
    if (res && res.data) {
      for (const [k, v] of Object.entries(res.data)) {
        if (typeof v === 'object' && v !== null) {
          Object.assign(cachedSettings, v);
        } else {
          cachedSettings[k] = v;
        }
      }
      applySystemSettings({});
    }
  } catch (err) {
    console.warn('Gagal memuat pengaturan awal dari server:', err);
  }
}
