// ================================================================
// DevWatch — browserNotification.js
// Layanan Push Notification Browser & Integrasi Event Real-Time
// ================================================================

import { getAppSetting } from '../settingsManager.js';
import { navigate } from '../router.js';

const NOTIF_STORAGE_KEY = 'devwatch_notifications';

/**
 * Meminta izin Web Notification API ke browser
 */
export async function requestBrowserPushPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'default') {
    try {
      const perm = await Notification.requestPermission();
      console.log('[DevWatch Push]: Izin notifikasi browser:', perm);
      return perm;
    } catch (e) {
      console.warn('[DevWatch Push]: Gagal meminta izin notifikasi:', e);
      return Notification.permission;
    }
  }

  return Notification.permission;
}

/**
 * Memeriksa apakah saat ini berada dalam rentang jam kerja notifikasi
 */
function isWithinWorkHours() {
  try {
    const startStr = getAppSetting('work_hours_start', '07:00');
    const endStr = getAppSetting('work_hours_end', '17:00');

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);

    const startMinutes = (sh || 7) * 60 + (sm || 0);
    const endMinutes = (eh || 17) * 60 + (em || 0);

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch {
    return true;
  }
}

/**
 * Memunculkan Web Notification native browser saat device offline
 */
export function showDeviceOfflinePushNotification(deviceData) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  const pushEnabled = getAppSetting('browser_push_enabled', 'true') !== 'false';
  if (!pushEnabled) return;

  if (Notification.permission !== 'granted') return;

  if (!isWithinWorkHours()) {
    console.log('[DevWatch Push]: Di luar jam kerja, notifikasi desktop dilewati.');
    return;
  }

  const title = `⚠️ ${deviceData.nama || 'Device'} OFFLINE`;
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const body = `${deviceData.nama || 'Perangkat'} (${deviceData.ip || ''}) tidak merespons ${deviceData.metode || 'ping'} sejak ${timeStr}.`;

  try {
    const notification = new Notification(title, {
      body,
      icon: getAppSetting('app_logo') || undefined,
      tag: `devwatch-offline-${deviceData.id || Date.now()}`,
      renotify: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (deviceData.id) {
        navigate('device-detail', { id: deviceData.id });
      } else {
        navigate('devices');
      }
    };
  } catch (err) {
    console.warn('[DevWatch Push]: Gagal membuat objek notifikasi:', err);
  }
}

/**
 * Menyimpan notifikasi baru ke dropdown topbar
 */
function addTopbarNotification(icon, text) {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];

    const newEntry = {
      id: Date.now(),
      icon,
      text,
      time: 'Baru saja',
      read: false,
    };

    list.unshift(newEntry);
    if (list.length > 30) list.pop(); // Batasi maksimal 30 log notifikasi

    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list));

    // Update badge counter di topbar
    const badge = document.getElementById('notif-count');
    const unreadCount = list.filter((n) => !n.read).length;
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch {
    // Abaikan
  }
}

/**
 * Inisialisasi listener event WebSocket status_change secara global
 */
export function initBrowserNotificationService() {
  if (typeof window === 'undefined') return;

  window.addEventListener('devwatch:status_change', (event) => {
    const data = event.detail;
    if (!data) return;

    if (data.status === 'offline') {
      // 1. Tampilkan notifikasi desktop OS
      showDeviceOfflinePushNotification(data);

      // 2. Tambahkan ke dropdown topbar
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      addTopbarNotification('🔴', `${data.nama} (${data.ip || ''}) OFFLINE sejak ${timeStr}`);
    } else if (data.status === 'online') {
      addTopbarNotification('🟢', `${data.nama} kembali terhubung (Online)`);
    }
  });

  window.addEventListener('devwatch:maintenance_expired', (event) => {
    const data = event.detail;
    if (data && data.nama) {
      addTopbarNotification('🟡', `Masa pemeliharaan untuk ${data.nama} telah berakhir.`);
    }
  });
}
