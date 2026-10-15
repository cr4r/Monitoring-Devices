// ================================================================
// DevWatch — login.js
// Halaman login dengan mock auth, rate limiting, SweetAlert2
// ================================================================

import Swal from 'sweetalert2';
import { getUserByEmail } from '../data/mock-users.js';
import { setSession } from '../main.js';

let failCount = 0;
let lockoutUntil = null;

export function renderLogin() {
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
            <h1 class="gradient-text">DevWatch</h1>
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
        </form>

        <div class="login-footer">
          <p>DevWatch v1.0 · Sistem Monitoring Internal</p>
          <p style="margin-top:4px;">
            Demo: <code>admin@kantor.com</code> / <code>admin123</code>
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

    // Simulasi delay network
    await new Promise((r) => setTimeout(r, 800));

    const user = getUserByEmail(email);

    if (!user || user.password !== password) {
      failCount++;
      loginBtn.disabled = false;
      loginBtn.innerHTML = '🔐 Masuk';

      if (failCount >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60000);
        failCount = 0;
        Swal.fire({
          icon: 'error',
          title: '⛔ Akun Terkunci 15 Menit',
          html: 'Terlalu banyak percobaan login gagal. Sistem mengunci akses selama <b>15 menit</b> untuk keamanan.',
          background: '#1a1d2e',
          color: '#e2e8f0',
          confirmButtonColor: '#6366f1',
          confirmButtonText: 'Mengerti',
        });
        return;
      }

      const remaining = 5 - failCount;
      showInlineAlert(
        `Email atau password salah. Sisa percobaan: <b>${remaining}x</b> sebelum akun terkunci.`,
        'danger'
      );

      // Shake effect
      const card = document.querySelector('.login-card');
      card?.classList.add('fade-in-up');
      setTimeout(() => card?.classList.remove('fade-in-up'), 400);
      return;
    }

    if (user.status === 'nonaktif') {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '🔐 Masuk';
      Swal.fire({
        icon: 'warning',
        title: 'Akun Nonaktif',
        text: 'Akun Anda telah dinonaktifkan oleh Admin. Hubungi IT untuk bantuan.',
        background: '#1a1d2e',
        color: '#e2e8f0',
        confirmButtonColor: '#6366f1',
      });
      return;
    }

    // Berhasil
    failCount = 0;
    setSession({
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
      loginAt: new Date().toISOString(),
    });

    await Swal.fire({
      icon: 'success',
      title: `Selamat Datang, ${user.nama.split(' ')[0]}!`,
      text: `Login sebagai ${getRoleLabel(user.role)}`,
      timer: 1500,
      showConfirmButton: false,
      background: '#1a1d2e',
      color: '#e2e8f0',
    });

    navigate('dashboard');
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
