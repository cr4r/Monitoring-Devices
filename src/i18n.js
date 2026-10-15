// ================================================================
// DevWatch — i18n.js
// Sistem lokalisasi bahasa antarmuka (Bahasa Indonesia & English)
// ================================================================

let currentLanguage = 'id';

const translations = {
  id: {
    // Navigasi
    nav_monitoring: 'Monitoring',
    nav_management: 'Manajemen',
    nav_admin: 'Administrasi',
    nav_dashboard: 'Dashboard',
    nav_devices: 'Perangkat',
    nav_logs: 'Log Sistem',
    nav_reports: 'Laporan',
    nav_users: 'Pengguna',
    nav_settings: 'Pengaturan',
    nav_about: 'Tentang',

    // Topbar
    topbar_live: 'Monitoring aktif',
    topbar_notifications: 'Notifikasi',
    topbar_profile: 'Profil Saya',
    topbar_notif_settings: 'Pengaturan Notif',
    topbar_logout: 'Keluar',
    notif_mark_read: 'Tandai Telah Dibaca',
    notif_clear_all: 'Bersihkan Semua Notifikasi',
    notif_empty: 'Tidak ada notifikasi baru',
    notif_close: 'Tutup',

    // Dashboard
    dash_title: 'Dashboard',
    dash_subtitle: 'Status real-time semua device jaringan kantor',
    dash_refresh: 'Refresh',
    dash_total_device: 'Total Device',
    dash_online: 'Online',
    dash_offline: 'Offline',
    dash_maintenance: 'Maintenance',
    dash_uptime: 'dari total',
    dash_needs_attention: 'Perlu perhatian',
    dash_scheduled_mode: 'Mode terjadwal',
    dash_tab_card: 'Tampilan Kartu',
    dash_tab_map: 'Peta Visual',
    dash_tab_timeline: 'Grafik Timeline',
    dash_search_placeholder: 'Cari nama device atau IP...',
    dash_loading: 'Memuat data perangkat...',
    dash_no_device: 'Tidak ada perangkat ditemukan',

    // Pengaturan
    settings_title: 'Pengaturan Sistem',
    settings_subtitle: 'Konfigurasi monitoring, notifikasi, keamanan, dan backup',
    settings_sec_general: 'Umum',
    settings_sec_monitoring: 'Monitoring',
    settings_sec_notifications: 'Notifikasi',
    settings_sec_security: 'Keamanan',
    settings_sec_log_backup: 'Log & Backup',
    settings_sec_reports: 'Laporan Terjadwal',
    settings_app_name: 'Nama Aplikasi',
    settings_app_name_desc: 'Nama yang ditampilkan di header dan laporan',
    settings_timezone: 'Zona Waktu',
    settings_timezone_desc: 'Zona waktu untuk jam, log, dan laporan',
    settings_language: 'Bahasa Antarmuka',
    settings_language_desc: 'Bahasa yang digunakan di seluruh aplikasi',
    settings_app_logo: 'Logo Aplikasi',
    settings_app_logo_desc: 'Upload foto/logo untuk sidebar dan header',
    settings_btn_choose_logo: '📁 Pilih Foto Logo',
    settings_btn_reset_logo: '↺ Reset ke Logo Default',
    settings_save: 'Simpan Pengaturan',
    settings_saved_success: 'Pengaturan berhasil disimpan ke database.',
  },
  en: {
    // Navigasi
    nav_monitoring: 'Monitoring',
    nav_management: 'Management',
    nav_admin: 'Administration',
    nav_dashboard: 'Dashboard',
    nav_devices: 'Devices',
    nav_logs: 'System Logs',
    nav_reports: 'Reports',
    nav_users: 'Users',
    nav_settings: 'Settings',
    nav_about: 'About',

    // Topbar
    topbar_live: 'Monitoring active',
    topbar_notifications: 'Notifications',
    topbar_profile: 'My Profile',
    topbar_notif_settings: 'Notification Settings',
    topbar_logout: 'Sign Out',
    notif_mark_read: 'Mark All as Read',
    notif_clear_all: 'Clear All Notifications',
    notif_empty: 'No new notifications',
    notif_close: 'Close',

    // Dashboard
    dash_title: 'Dashboard',
    dash_subtitle: 'Real-time network status across office devices',
    dash_refresh: 'Refresh',
    dash_total_device: 'Total Devices',
    dash_online: 'Online',
    dash_offline: 'Offline',
    dash_maintenance: 'Maintenance',
    dash_uptime: 'of total',
    dash_needs_attention: 'Requires attention',
    dash_scheduled_mode: 'Scheduled mode',
    dash_tab_card: 'Card View',
    dash_tab_map: 'Visual Map',
    dash_tab_timeline: 'Timeline Chart',
    dash_search_placeholder: 'Search device name or IP...',
    dash_loading: 'Loading devices data...',
    dash_no_device: 'No devices found',

    // Pengaturan
    settings_title: 'System Settings',
    settings_subtitle: 'Configure monitoring, notifications, security, and backups',
    settings_sec_general: 'General',
    settings_sec_monitoring: 'Monitoring',
    settings_sec_notifications: 'Notifications',
    settings_sec_security: 'Security',
    settings_sec_log_backup: 'Logs & Backup',
    settings_sec_reports: 'Scheduled Reports',
    settings_app_name: 'Application Name',
    settings_app_name_desc: 'Name displayed in header, sidebar, and reports',
    settings_timezone: 'Timezone',
    settings_timezone_desc: 'Timezone applied to clock, logs, and reports',
    settings_language: 'Interface Language',
    settings_language_desc: 'Language used across the entire application',
    settings_app_logo: 'Application Logo',
    settings_app_logo_desc: 'Upload photo/logo for sidebar and header',
    settings_btn_choose_logo: '📁 Choose Logo File',
    settings_btn_reset_logo: '↺ Reset to Default Logo',
    settings_save: 'Save Settings',
    settings_saved_success: 'Settings successfully saved to database.',
  },
};

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function t(key, fallback = '') {
  const dict = translations[currentLanguage] || translations.id;
  return dict[key] !== undefined ? dict[key] : (fallback || key);
}
