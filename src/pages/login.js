// ================================================================
// DevWatch — login.js
// Halaman login dengan mock auth, rate limiting, SweetAlert2
// ================================================================

import Swal from 'sweetalert2';
import { setSession } from '../main.js';
import { apiLogin } from '../api.js';

import { getAppSetting } from '../settingsManager.js';

let failCount = 0;
let lockoutUntil = null;

export function renderLogin() {
  const appName = getAppSetting('app_name', 'DevWatch');
  return `
    <div class="login-page" id="login-page">
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

          <!-- Quick Login Chips -->
          <div style="margin-top:16px; padding:12px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px;">
            <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--color-muted); margin-bottom:8px; text-align:center; font-weight:600;">
              ⚡ Login Cepat Default User (1-Click)
            </div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
              <button type="button" class="btn btn-secondary btn-sm quick-login-btn" data-email="admin@kantor.com" data-pwd="admin123" style="font-size:0.75rem; padding:6px 4px; display:flex; flex-direction:column; align-items:center; gap:2px;">
                <span>👑 Admin</span>
                <span style="font-size:0.65rem; color:var(--color-muted);">Full Akses</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm quick-login-btn" data-email="teknisi@kantor.com" data-pwd="teknisi123" style="font-size:0.75rem; padding:6px 4px; display:flex; flex-direction:column; align-items:center; gap:2px;">
                <span>🔧 Teknisi</span>
                <span style="font-size:0.65rem; color:var(--color-muted);">Maintenance</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm quick-login-btn" data-email="viewer@kantor.com" data-pwd="viewer123" style="font-size:0.75rem; padding:6px 4px; display:flex; flex-direction:column; align-items:center; gap:2px;">
                <span>👁️ Viewer</span>
                <span style="font-size:0.65rem; color:var(--color-muted);">Hanya Lihat</span>
              </button>
            </div>
          </div>
        </form>

        <div class="login-footer">
          <p>DevWatch v1.0 · Sistem Monitoring Internal</p>
          <p style="margin-top:4px;">
            Demo: <code>admin@kantor.com</code> / <code>admin123</code> · <code>teknisi@kantor.com</code> / <code>teknisi123</code>
          </p>
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

  // Quick login handler
  document.querySelectorAll('.quick-login-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const em = btn.getAttribute('data-email');
      const pw = btn.getAttribute('data-pwd');
      if (emailInput) emailInput.value = em;
      if (passwordInput) passwordInput.value = pw;
      loginBtn?.click();
    });
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
