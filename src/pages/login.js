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
      <!-- Cyber Grid Background & Ambient Lighting -->
      <div class="login-bg">
        <div class="login-cyber-grid"></div>
        <div class="login-bg-orb orb-1"></div>
        <div class="login-bg-orb orb-2"></div>
        <div class="login-bg-orb orb-3"></div>
      </div>

      <!-- Floating Theme Toggle -->
      <div style="position:fixed; top:20px; right:20px; z-index:99;">
        <button
          type="button"
          id="login-theme-toggle"
          class="login-theme-toggle-btn"
          title="${isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang Lembut'}"
        >
          <span id="login-theme-icon" style="font-size:1.05rem;">${isLight ? '🌙' : '☀️'}</span>
          <span id="login-theme-text">${isLight ? 'Mode Gelap' : 'Mode Terang'}</span>
        </button>
      </div>

      <div class="login-card">
        <!-- Live System Telemetry Status Pill -->
        <div style="text-align:center;">
          <div class="login-system-pill">
            <span class="login-pulse-dot"></span>
            <span>LIVE TELEMETRY • SISTEM MONITORING READY</span>
          </div>
        </div>

        <div class="login-logo">
          <div class="login-logo-icon">📡</div>
          <div class="login-logo-text">
            <h1 class="gradient-text brand-app-name">${appName}</h1>
            <p>Infrastructure & Device Telemetry</p>
          </div>
        </div>

        <form class="login-form" id="login-form" novalidate>
          <div id="login-alert"></div>

          <!-- Flexible Identifier (Username OR Email) -->
          <div class="form-group" style="gap:6px;">
            <label class="form-label" for="login-identifier" style="font-size:0.82rem; font-weight:600; display:flex; justify-content:space-between; align-items:center;">
              <span>Username atau Email <span class="required">*</span></span>
              <span style="font-size:0.7rem; color:var(--color-muted); font-weight:500;">admin / user@domain</span>
            </label>
            <div class="login-input-wrapper">
              <span class="login-input-icon">👤</span>
              <input
                type="text"
                id="login-identifier"
                class="form-control login-control"
                placeholder="Masukkan username atau email akun..."
                autocomplete="username"
                required
              />
            </div>
          </div>

          <div class="form-group" style="gap:6px;">
            <label class="form-label" for="login-password" style="font-size:0.82rem; font-weight:600;">
              Kata Sandi <span class="required">*</span>
            </label>
            <div class="login-input-wrapper">
              <span class="login-input-icon">🔒</span>
              <input
                type="password"
                id="login-password"
                class="form-control login-control"
                placeholder="••••••••"
                autocomplete="current-password"
                required
                style="padding-right:42px !important;"
              />
              <button
                type="button"
                id="toggle-password"
                style="
                  position:absolute; right:12px; top:50%; transform:translateY(-50%);
                  background:none; border:none; color:var(--color-muted);
                  cursor:pointer; font-size:1.05rem; padding:4px;
                "
                aria-label="Tampilkan password"
              >👁️</button>
            </div>
          </div>

          <button type="submit" class="login-btn-futuristic w-full" id="login-btn">
            <span>🔐 Masuk ke Sistem</span>
          </button>

          <!-- Divider -->
          <div style="display:flex; align-items:center; margin:4px 0; color:var(--color-muted); font-size:0.75rem;">
            <div style="flex:1; height:1px; background:rgba(255,255,255,0.08);"></div>
            <span style="padding:0 10px; text-transform:uppercase; letter-spacing:0.08em; font-weight:700; font-size:0.7rem;">ATAU</span>
            <div style="flex:1; height:1px; background:rgba(255,255,255,0.08);"></div>
          </div>

          <!-- Preview Mode CTA (Terminal Sandbox) -->
          <div class="login-preview-terminal">
            <div style="font-size:0.8rem; font-weight:700; color:#a78bfa; margin-bottom:4px; display:flex; align-items:center; justify-content:center; gap:6px;">
              <span>🎮 Operator Demo Sandbox</span>
            </div>
            <p style="font-size:0.75rem; color:var(--color-muted); margin:0 0 10px 0; line-height:1.4;">
              Eksplorasi 20 perangkat demo, topologi jaringan kanvas, telemetri live, dan simulasi insiden tanpa login.
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
          <p style="font-weight:600; color:var(--color-heading);">MonDev Enterprise Edition v1.0</p>
          <p style="margin-top:3px; font-size:0.72rem; color:var(--color-muted);">Sistem Pemantauan Jaringan & Telemetri Perangkat Internal</p>
        </div>
      </div>
    </div>
  `;
}

export function initLoginEvents(navigate) {
  const form = document.getElementById('login-form');
  const identifierInput = document.getElementById('login-identifier') || document.getElementById('login-username');
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
      username: 'preview',
      email: 'preview@devwatch.demo',
      nama: 'Guest Preview',
      role: 'admin',
      avatar: 'GP',
      is_preview: true,
    });
    localStorage.setItem('devwatch_token', 'preview_demo_token');
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

    const identifier = identifierInput?.value?.trim() || '';
    const password = passwordInput?.value || '';

    // Validasi basic
    if (!identifier || !password) {
      showInlineAlert('Username atau email dan kata sandi wajib diisi.', 'danger');
      return;
    }

    // Loading state
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Memverifikasi...';

    try {
      // Panggil backend API dengan identifier fleksibel (username atau email)
      const res = await apiLogin(identifier, password);

      failCount = 0;
      setSession({
        id: res.user.id,
        nama: res.user.nama,
        username: res.user.username,
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
      loginBtn.innerHTML = '<span>🔐 Masuk ke Sistem</span>';

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
