// ================================================================
// DevWatch — setup.js
// Halaman Setup Awal Pertama Kali (First-Run Setup Wizard)
// ================================================================

import Swal from 'sweetalert2';
import { setSession } from '../main.js';

export function renderSetup() {
  return `
    <div class="login-page" id="setup-page" style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px;">
      <div class="login-bg">
        <div class="login-bg-orb orb-1"></div>
        <div class="login-bg-orb orb-2"></div>
        <div class="login-bg-orb orb-3"></div>
      </div>

      <div class="card" style="width:100%; max-width:540px; background:var(--color-surface, #1e2238); border:1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius:16px; padding:32px 28px; box-shadow:0 20px 40px rgba(0,0,0,0.35); position:relative; z-index:2;">
        
        <!-- Header -->
        <div style="text-align:center; margin-bottom:24px;">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:56px; height:56px; border-radius:14px; background:linear-gradient(135deg, #6366f1, #a855f7); font-size:28px; margin-bottom:12px; box-shadow:0 8px 20px rgba(99,102,241,0.35);">
            📡
          </div>
          <h1 class="gradient-text" style="font-size:1.75rem; font-weight:800; margin:0 0 6px 0;">Setup Awal MonDev</h1>
          <p style="font-size:0.88rem; color:var(--color-muted, #94a3b8); margin:0; line-height:1.4;">
            Konfigurasikan sistem dan buat akun <b>Superadministrator</b> perdana. Setup ini hanya dapat dijalankan satu kali.
          </p>
          <div style="margin-top:10px; display:inline-block; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; background:rgba(99,102,241,0.12); color:#818cf8; border:1px solid rgba(99,102,241,0.3);">
            🛡️ Proteksi Anti-Bypass Aktif
          </div>
        </div>

        <form id="setup-form" novalidate style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- Superadmin Name -->
          <div class="form-group" style="margin:0;">
            <label class="form-label" for="setup-nama" style="font-size:0.82rem; font-weight:600; color:var(--color-text, #f1f5f9); margin-bottom:6px; display:block;">
              Nama Lengkap Superadmin <span class="required" style="color:#ef4444;">*</span>
            </label>
            <input
              type="text"
              id="setup-nama"
              class="form-control"
              placeholder="Contoh: Admin"
              required
              autocomplete="name"
              style="width:100%; padding:10px 14px; font-size:0.9rem; border-radius:8px;"
            />
          </div>

          <!-- Email -->
          <div class="form-group" style="margin:0;">
            <label class="form-label" for="setup-email" style="font-size:0.82rem; font-weight:600; color:var(--color-text, #f1f5f9); margin-bottom:6px; display:block;">
              Email Administrator <span class="required" style="color:#ef4444;">*</span>
            </label>
            <input
              type="email"
              id="setup-email"
              class="form-control"
              placeholder="admin@kantor.com"
              required
              autocomplete="email"
              style="width:100%; padding:10px 14px; font-size:0.9rem; border-radius:8px;"
            />
          </div>

          <!-- Password Grid -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" for="setup-password" style="font-size:0.82rem; font-weight:600; color:var(--color-text, #f1f5f9); margin-bottom:6px; display:block;">
                Kata Sandi <span class="required" style="color:#ef4444;">*</span>
              </label>
              <div style="position:relative;">
                <input
                  type="password"
                  id="setup-password"
                  class="form-control"
                  placeholder="Min. 8 karakter"
                  required
                  autocomplete="new-password"
                  style="width:100%; padding:10px 36px 10px 14px; font-size:0.9rem; border-radius:8px;"
                />
                <button
                  type="button"
                  id="toggle-setup-password"
                  style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--color-muted, #94a3b8); cursor:pointer; font-size:0.95rem; padding:4px;"
                  aria-label="Tampilkan sandi"
                >👁️</button>
              </div>
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" for="setup-confirm-password" style="font-size:0.82rem; font-weight:600; color:var(--color-text, #f1f5f9); margin-bottom:6px; display:block;">
                Konfirmasi Sandi <span class="required" style="color:#ef4444;">*</span>
              </label>
              <input
                type="password"
                id="setup-confirm-password"
                class="form-control"
                placeholder="Ulangi sandi"
                required
                autocomplete="new-password"
                style="width:100%; padding:10px 14px; font-size:0.9rem; border-radius:8px;"
              />
            </div>
          </div>

          <!-- Password strength meter -->
          <div style="margin-top:-6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:var(--color-muted, #94a3b8); margin-bottom:4px;">
              <span>Kekuatan Kata Sandi:</span>
              <span id="pwd-strength-label" style="font-weight:600;">Terlalu Pendek</span>
            </div>
            <div style="height:4px; width:100%; background:rgba(255,255,255,0.08); border-radius:2px; overflow:hidden;">
              <div id="pwd-strength-bar" style="height:100%; width:15%; background:#ef4444; transition:all 0.3s ease;"></div>
            </div>
          </div>

          <!-- Divider -->
          <div style="display:flex; align-items:center; margin:4px 0; color:var(--color-muted, #94a3b8); font-size:0.72rem;">
            <div style="flex:1; height:1px; background:var(--border-color, rgba(255,255,255,0.08));"></div>
            <span style="padding:0 8px; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">Pengaturan Sistem Awal</span>
            <div style="flex:1; height:1px; background:var(--border-color, rgba(255,255,255,0.08));"></div>
          </div>

          <!-- App Name & Timezone -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" for="setup-app-name" style="font-size:0.82rem; font-weight:600; color:var(--color-text, #f1f5f9); margin-bottom:6px; display:block;">
                Nama Aplikasi / Instansi
              </label>
              <input
                type="text"
                id="setup-app-name"
                class="form-control"
                value="MonDev"
                placeholder="MonDev"
                style="width:100%; padding:10px 14px; font-size:0.9rem; border-radius:8px;"
              />
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" for="setup-timezone" style="font-size:0.82rem; font-weight:600; color:var(--color-text, #f1f5f9); margin-bottom:6px; display:block;">
                Zona Waktu
              </label>
              <select
                id="setup-timezone"
                class="form-control"
                style="width:100%; padding:10px 14px; font-size:0.9rem; border-radius:8px;"
              >
                <option value="Asia/Jakarta" selected>WIB (Asia/Jakarta)</option>
                <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                <option value="UTC">UTC Standard</option>
              </select>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            id="setup-submit-btn"
            class="btn btn-primary btn-lg w-full"
            style="margin-top:8px; padding:12px; font-size:0.95rem; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;"
          >
            <span>🚀 Selesaikan Setup & Mulai Sistem</span>
          </button>
        </form>

        <div style="margin-top:20px; text-align:center; font-size:0.75rem; color:var(--color-muted, #94a3b8); line-height:1.4;">
          <p style="margin:0;">MonDev v1.0 · Dibuat oleh Fatur</p>
          <p style="margin:4px 0 0 0; opacity:0.8;">Setelah setup selesai, halaman ini akan otomatis terkunci demi integritas sistem.</p>
        </div>

      </div>
    </div>
  `;
}

export function initSetupEvents(navigate) {
  const form = document.getElementById('setup-form');
  const namaInput = document.getElementById('setup-nama');
  const emailInput = document.getElementById('setup-email');
  const pwdInput = document.getElementById('setup-password');
  const confirmInput = document.getElementById('setup-confirm-password');
  const appNameInput = document.getElementById('setup-app-name');
  const timezoneInput = document.getElementById('setup-timezone');
  const togglePwdBtn = document.getElementById('toggle-setup-password');
  const submitBtn = document.getElementById('setup-submit-btn');
  const strengthBar = document.getElementById('pwd-strength-bar');
  const strengthLabel = document.getElementById('pwd-strength-label');

  // Toggle password visibility
  togglePwdBtn?.addEventListener('click', () => {
    const isPassword = pwdInput.type === 'password';
    pwdInput.type = isPassword ? 'text' : 'password';
    togglePwdBtn.textContent = isPassword ? '🙈' : '👁️';
  });

  // Password strength meter
  pwdInput?.addEventListener('input', () => {
    const val = pwdInput.value;
    let score = 0;
    if (val.length >= 8) score += 30;
    if (val.length >= 12) score += 20;
    if (/[a-z]/.test(val) && /[A-Z]/.test(val)) score += 20;
    if (/\d/.test(val)) score += 15;
    if (/[^a-zA-Z0-9]/.test(val)) score += 15;

    if (val.length === 0) {
      strengthBar.style.width = '0%';
      strengthBar.style.backgroundColor = '#ef4444';
      strengthLabel.textContent = 'Kosong';
      strengthLabel.style.color = 'var(--color-muted)';
    } else if (score < 40) {
      strengthBar.style.width = '25%';
      strengthBar.style.backgroundColor = '#ef4444';
      strengthLabel.textContent = 'Lemah (< 8 karakter / variasi rendah)';
      strengthLabel.style.color = '#ef4444';
    } else if (score < 70) {
      strengthBar.style.width = '60%';
      strengthBar.style.backgroundColor = '#eab308';
      strengthLabel.textContent = 'Sedang (Cukup baik)';
      strengthLabel.style.color = '#eab308';
    } else {
      strengthBar.style.width = '100%';
      strengthBar.style.backgroundColor = '#22c55e';
      strengthLabel.textContent = 'Kuat & Aman 👍';
      strengthLabel.style.color = '#22c55e';
    }
  });

  // Form submission
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nama = namaInput?.value?.trim();
    const email = emailInput?.value?.trim();
    const password = pwdInput?.value;
    const confirmPassword = confirmInput?.value;
    const appName = appNameInput?.value?.trim() || 'MonDev';
    const timezone = timezoneInput?.value || 'Asia/Jakarta';

    // Validation
    if (!nama) {
      Swal.fire({ icon: 'warning', title: 'Nama Lengkap Diperlukan', text: 'Mohon masukkan nama lengkap Superadministrator.', background: '#1a1d2e', color: '#e2e8f0' });
      namaInput?.focus();
      return;
    }

    if (!email || !email.includes('@')) {
      Swal.fire({ icon: 'warning', title: 'Email Tidak Valid', text: 'Mohon masukkan alamat email yang valid.', background: '#1a1d2e', color: '#e2e8f0' });
      emailInput?.focus();
      return;
    }

    if (!password || password.length < 8) {
      Swal.fire({ icon: 'warning', title: 'Kata Sandi Kurang Kuat', text: 'Kata sandi minimal 8 karakter demi keamanan sistem kantor Anda.', background: '#1a1d2e', color: '#e2e8f0' });
      pwdInput?.focus();
      return;
    }

    if (password !== confirmPassword) {
      Swal.fire({ icon: 'error', title: 'Konfirmasi Sandi Berbeda', text: 'Kata sandi dan konfirmasi kata sandi tidak cocok.', background: '#1a1d2e', color: '#e2e8f0' });
      confirmInput?.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳ Mengonfigurasi Sistem...</span>`;

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama,
          email,
          password,
          confirmPassword,
          appName,
          timezone,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menjalankan setup awal.');
      }

      // Simpan token JWT & set session
      if (data.token) {
        localStorage.setItem('devwatch_token', data.token);
      }
      if (data.user) {
        setSession(data.user);
      }

      // Simpan pengaturan lokal
      localStorage.setItem('devwatch_app_name', appName);
      localStorage.setItem('devwatch_timezone', timezone);

      await Swal.fire({
        icon: 'success',
        title: '🎉 Setup Awal Berhasil!',
        html: `
          <div style="font-size:0.9rem; line-height:1.5;">
            Selamat datang, <b>${data.user.nama}</b>!<br>
            Akun Superadmin Anda telah aktif dengan role <b>Admin</b>.<br>
            Sistem <b>${appName}</b> siap memantau perangkat jaringan Anda.
          </div>
        `,
        confirmButtonText: 'Masuk ke Dashboard ➔',
        confirmButtonColor: '#6366f1',
        background: '#1a1d2e',
        color: '#e2e8f0',
      });

      navigate('dashboard');
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Setup Gagal',
        text: err.message,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>🚀 Selesaikan Setup & Mulai Sistem</span>`;
    }
  });
}
