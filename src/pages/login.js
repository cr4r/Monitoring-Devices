// ================================================================
// MonDev — login.js
// Halaman login dengan mock auth, rate limiting, SweetAlert2
// ================================================================

import Swal from 'sweetalert2';
import { setSession } from '../main.js';
import { apiLogin } from '../api.js';
import { getAppSetting } from '../settingsManager.js';
import { requestBrowserPushPermission } from '../services/browserNotification.js';
import { toggleTheme, getEffectiveTheme } from '../themeManager.js';

let failCount = 0;
let lockoutUntil = null;

export function renderLogin() {
  const appName = getAppSetting('app_name', 'MonDev');
  const currentEffective = getEffectiveTheme();
  const isLight = currentEffective === 'light';

  return `
    <div class="login-page" id="login-page">
      <!-- Floating Theme Toggle -->
      <div style="position:fixed; top:20px; right:20px; z-index:99;">
        <button
          type="button"
          id="login-theme-toggle"
          class="btn btn-secondary btn-sm"
          style="display:inline-flex; align-items:center; gap:8px; border-radius:24px; padding:8px 16px; font-size:0.82rem; font-weight:600; background:var(--color-surface, #1e2238); border:1px solid var(--border-color, rgba(255,255,255,0.12)); color:var(--color-text, #f1f5f9); box-shadow:0 4px 14px rgba(0,0,0,0.25); cursor:pointer;"
          title="${isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang Lembut'}"
        >
          <span id="login-theme-icon" style="font-size:1.05rem;">${isLight ? '🌙' : '☀️'}</span>
          <span id="login-theme-text">${isLight ? 'Mode Gelap' : 'Mode Terang'}</span>
        </button>
      </div>

      <div class="login-bg">
        <div class="login-bg-orb orb-1"></div>
        <div class="login-bg-orb orb-2"></div>
        <div class="login-bg-orb orb-3"></div>
      </div>

      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon">📡</div>
          <div class="login-logo-text">
            <h1 class="gradient-text brand-app-name">${appName}</h1>
            <p>Device Monitoring System</p>
          </div>
        </div>

        <form class="login-form" id="login-form" novalidate>
          <div id="login-alert"></div>

          <div class="form-group">
            <label class="form-label" for="login-email">
              Email <span class="required">*</span>
            </label>
            <input
              type="email"
              id="login-email"
              class="form-control"
              placeholder="email@kantor.com"
              autocomplete="email"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">
              Password <span class="required">*</span>
            </label>
            <div style="position:relative;">
              <input
                type="password"
                id="login-password"
                class="form-control"
                placeholder="••••••••"
                autocomplete="current-password"
                required
                style="padding-right:40px;"
              />
              <button
                type="button"
                id="toggle-password"
                style="
                  position:absolute; right:10px; top:50%; transform:translateY(-50%);
                  background:none; border:none; color:var(--color-muted);
                  cursor:pointer; font-size:1rem; padding:4px;
                "
                aria-label="Tampilkan password"
              >👁️</button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-lg login-btn w-full" id="login-btn">
            🔐 Masuk
          </button>

          <!-- Divider -->
          <div style="display:flex; align-items:center; margin:16px 0; color:var(--color-muted); font-size:0.75rem;">
            <div style="flex:1; height:1px; background:var(--border-color);"></div>
            <span style="padding:0 8px; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">ATAU</span>
            <div style="flex:1; height:1px; background:var(--border-color);"></div>
          </div>

          <!-- Preview Mode CTA -->
          <div style="padding:14px; background:linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12)); border:1px solid rgba(139, 92, 246, 0.35); border-radius:10px; text-align:center;">
            <div style="font-size:0.8rem; font-weight:700; color:#a78bfa; margin-bottom:4px; display:flex; align-items:center; justify-content:center; gap:6px;">
              <span>🎮 Pratinjau Sistem Tanpa Login</span>
            </div>
            <p style="font-size:0.75rem; color:var(--color-muted); margin:0 0 10px 0; line-height:1.4;">
              Jelajahi 20 perangkat demo, topologi kanvas, telemetri, dan simulasi insiden.
            </p>
            <button
              type="button"
              id="preview-mode-btn"
              class="btn btn-secondary w-full"
              style="background:rgba(139, 92, 246, 0.15); border:1px solid #8b5cf6; color:#c084fc; font-weight:600; font-size:0.85rem; padding:8px 12px; display:flex; align-items:center; justify-content:center; gap:8px;"
            >
              <span>🚀 Masuk Mode Preview (Data Demo)</span>
            </button>
          </div>
        </form>

        <div class="login-footer">
          <p>MonDev v1.0 · Dibuat oleh Fatur</p>
          <p style="margin-top:4px; font-size:0.75rem; color:var(--color-muted);">Sistem Monitoring Perangkat Jaringan Internal</p>
        </div>
      </div>
    </div>
  `;
}

export function initLoginEvents(navigate) {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const togglePwd = document.getElementById('toggle-password');
  const loginBtn = document.getElementById('login-btn');
  const previewBtn = document.getElementById('preview-mode-btn');

  // Theme Toggle handler
  const loginThemeBtn = document.getElementById('login-theme-toggle');
  loginThemeBtn?.addEventListener('click', () => {
    const nextTheme = toggleTheme();
    const isNowLight = nextTheme === 'light';
    const icon = document.getElementById('login-theme-icon');
    const text = document.getElementById('login-theme-text');
    if (icon) icon.textContent = isNowLight ? '🌙' : '☀️';
    if (text) text.textContent = isNowLight ? 'Mode Gelap' : 'Mode Terang';
    if (loginThemeBtn) {
      loginThemeBtn.title = isNowLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang Lembut';
    }
  });

  // Sinkronkan jika ada event perubahan tema global
  window.addEventListener('devwatch:theme_changed', (e) => {
    const isNowLight = e.detail?.isLight;
    const icon = document.getElementById('login-theme-icon');
    const text = document.getElementById('login-theme-text');
    if (icon) icon.textContent = isNowLight ? '🌙' : '☀️';
    if (text) text.textContent = isNowLight ? 'Mode Gelap' : 'Mode Terang';
  });

  // Preview Mode handler
  previewBtn?.addEventListener('click', () => {
    setSession({
      email: 'preview@devwatch.demo',
      nama: 'Guest Preview',
      role: 'admin',
      avatar: 'GP',
      is_preview: true,
    });
    localStorage.removeItem('devwatch_token');
    Swal.fire({
      icon: 'info',
      title: 'Mode Preview Aktif',
      text: 'Anda memasuki sistem dengan 20 perangkat demo. Data database riil tetap bersih.',
      timer: 1500,
      showConfirmButton: false,
      background: 'var(--color-surface, #1a1d2e)',
      color: 'var(--color-text, #e2e8f0)',
    });
    navigate('dashboard');
  });

  // Toggle password visibility
  togglePwd?.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePwd.textContent = isPassword ? '🙈' : '👁️';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check lockout
    if (lockoutUntil && new Date() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - new Date()) / 60000);
      Swal.fire({
        icon: 'error',
        title: 'Akun Terkunci',
        html: `Terlalu banyak percobaan login gagal.<br>Coba lagi dalam <b>${remaining} menit</b>.`,
        background: '#1a1d2e',
        color: '#e2e8f0',
        confirmButtonColor: '#6366f1',
      });
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validasi basic
    if (!email || !password) {
      showInlineAlert('Email dan password wajib diisi.', 'danger');
      return;
    }

    // Loading state
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Memverifikasi...';

    try {
      // Panggil backend API
      const res = await apiLogin(email, password);

      failCount = 0;
      setSession({
        id: res.user.id,
        nama: res.user.nama,
        email: res.user.email,
        role: res.user.role,
        avatar: res.user.avatar,
        loginAt: new Date().toISOString(),
      });

      // Minta izin push notification browser sesuai PRD 6.5
      requestBrowserPushPermission().catch(() => {});

      await Swal.fire({
        icon: 'success',
        title: `Selamat Datang, ${res.user.nama.split(' ')[0]}!`,
        text: `Login sebagai ${getRoleLabel(res.user.role)}`,
        timer: 1500,
        showConfirmButton: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });

      navigate('dashboard');
      return;
    } catch (apiErr) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '🔐 Masuk';

      // Tangani jika dikunci oleh backend rate limiter (429)
      if (apiErr.message.includes('dikunci') || apiErr.message.includes('Terlalu banyak')) {
        Swal.fire({
          icon: 'error',
          title: '⛔ Akun Terkunci',
          html: apiErr.message,
          background: '#1a1d2e',
          color: '#e2e8f0',
          confirmButtonColor: '#6366f1',
        });
        return;
      }

      showInlineAlert(apiErr.message || 'Email atau kata sandi tidak sesuai.', 'danger');

      const card = document.querySelector('.login-card');
      card?.classList.add('fade-in-up');
      setTimeout(() => card?.classList.remove('fade-in-up'), 400);
      return;
    }
  });
}

function showInlineAlert(message, type = 'danger') {
  const alertDiv = document.getElementById('login-alert');
  if (!alertDiv) return;
  alertDiv.innerHTML = `
    <div class="alert-banner ${type}" style="margin-bottom:8px;">
      ⚠️ <span>${message}</span>
    </div>
  `;
}

function getRoleLabel(role) {
  const labels = { admin: 'Administrator', teknisi: 'Teknisi', viewer: 'Viewer' };
  return labels[role] || role;
}
