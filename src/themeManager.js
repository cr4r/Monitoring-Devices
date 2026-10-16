// ================================================================
// DevWatch — themeManager.js
// Pengelola tema sistem: Mode Gelap, Mode Terang Lembut, Mode Otomatis
// ================================================================

const THEME_STORAGE_KEY = 'devwatch_theme';

let currentTheme = 'dark'; // 'dark' | 'light' | 'auto'

/**
 * Mendapatkan tema yang tersimpan di preferensi pengguna
 */
export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
  } catch {}
  return 'dark';
}

/**
 * Mendapatkan tema efektif yang sedang dirender ('dark' atau 'light')
 */
export function getEffectiveTheme(theme = currentTheme) {
  if (theme === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }
  return theme === 'light' ? 'light' : 'dark';
}

/**
 * Menerapkan tema ke elemen <html> dan menyelaraskan ikon topbar
 */
export function applyTheme(theme, persist = true) {
  currentTheme = theme || 'dark';
  const effective = getEffectiveTheme(currentTheme);

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-preference', currentTheme);

    // Perbarui meta theme-color untuk mobile browser
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', effective === 'light' ? '#f6f8fb' : '#0f1117');
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch {}
  }

  // Perbarui tombol topbar jika ada di DOM
  updateTopbarThemeButton(effective);

  // Pancarkan custom event agar komponen lain (seperti Chart.js & Canvas) bereaksi
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('devwatch:theme_changed', {
        detail: {
          preference: currentTheme,
          effectiveTheme: effective,
          isLight: effective === 'light',
        },
      })
    );
  }
}

/**
 * Beralih cepat antara Mode Gelap dan Mode Terang
 */
export function toggleTheme() {
  const effective = getEffectiveTheme(currentTheme);
  const nextTheme = effective === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme, true);
  return nextTheme;
}

/**
 * Memperbarui tampilan tombol di Topbar
 */
export function updateTopbarThemeButton(effectiveTheme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;

  const isLight = (effectiveTheme || getEffectiveTheme()) === 'light';
  // Jika sedang light, tampilkan ikon bulan untuk beralih ke dark; jika dark, tampilkan matahari
  btn.innerHTML = isLight ? '🌙' : '☀️';
  btn.title = isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang Lembut';
  btn.setAttribute('data-tooltip', isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang');
  btn.classList.toggle('active', isLight);
}

/**
 * Inisialisasi tema saat aplikasi pertama kali dimuat
 */
export function initThemeManager() {
  const saved = getSavedTheme();
  applyTheme(saved, false);

  // Pantau perubahan skema warna sistem OS jika pengguna memilih 'auto'
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (currentTheme === 'auto') {
        applyTheme('auto', false);
      }
    });
  }
}
