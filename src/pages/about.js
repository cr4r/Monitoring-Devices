// ================================================================
// DevWatch — about.js
// Halaman tentang aplikasi
import Swal from 'sweetalert2';

export function renderAbout() {
  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">ℹ️ Tentang Aplikasi</h1>
          <p class="page-subtitle">Informasi versi, teknologi, dan lisensi DevWatch</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--spacing-lg);">
        <!-- Main about card -->
        <div class="card about-card">
          <div class="about-logo">📡</div>
          <h2 class="gradient-text" style="font-size:2rem; font-weight:800;">DevWatch</h2>
          <p style="font-size:1rem; color:var(--color-text-secondary);">Device Network Monitoring System</p>
          <div class="about-version">v1.0.0</div>
          <div class="about-version" style="margin-top:4px;">Build: Oktober 2026</div>
          <p style="margin-top:16px; font-size:0.88rem; color:var(--color-muted); max-width:380px;">
            Sistem monitoring device jaringan kantor secara real-time. 
            Pantau status online/offline komputer dan CCTV Hikvision dari satu dashboard terpusat.
          </p>
          <div class="about-stack">
            <span class="chip">Node.js</span>
            <span class="chip">Express.js</span>
            <span class="chip">SQLite</span>
            <span class="chip">Vite</span>
            <span class="chip">Vanilla JS</span>
            <span class="chip">Chart.js</span>
            <span class="chip">SweetAlert2</span>
            <span class="chip">Windows Service</span>
          </div>
        </div>

        <!-- Info cards -->
        <div style="display:flex; flex-direction:column; gap:var(--spacing-md);">
          <div class="card">
            <div class="section-title" style="margin-bottom:12px;">🚀 Kemampuan Sistem</div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:0.85rem; color:var(--color-text-secondary);">
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Monitoring 20–100 device (PC + CCTV)</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> ICMP Ping, ISAPI Hikvision, RTSP, ONVIF</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Dashboard real-time + Network Map</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Maintenance Mode dengan countdown timer</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Uptime Score & SLA Tracker</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Push Notification Browser</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Log sistem 3 jenis dengan export PDF</div>
              <div style="display:flex; gap:8px; align-items:center;"><span style="color:var(--color-online);">✅</span> Akses lokal & publik via HTTPS</div>
            </div>
          </div>

          <div class="card">
            <div class="section-title" style="margin-bottom:12px;">👨‍💻 Informasi Teknis</div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:0.85rem;">
              ${[
                ['Runtime', 'Node.js v24 + Windows Service'],
                ['Database', 'SQLite (file-based)'],
                ['Protokol', 'HTTPS wajib untuk akses publik'],
                ['Auth', 'JWT Token + bcrypt'],
                ['Enkripsi', 'AES-256 untuk kredensial CCTV'],
                ['Frontend', 'Vite + Vanilla JS'],
              ].map(([k, v]) => `
                <div style="display:flex; gap:12px; padding:6px 0; border-bottom:1px solid var(--border-color);">
                  <span style="color:var(--color-muted); min-width:100px;">${k}</span>
                  <span style="color:var(--color-text);">${v}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            <div class="section-title" style="margin-bottom:8px;">📚 Dokumentasi & Buku Panduan</div>
            <p style="font-size:0.82rem; color:var(--color-muted); margin-bottom:12px;">
              Buku panduan operasional lengkap, panduan instalasi Windows Service, backup database, dan mitigasi masalah tersedia di berkas <code>DOKUMENTASI_PENGGUNAAN.md</code>.
            </p>
            <button class="btn btn-secondary btn-sm" id="about-docs-btn" style="width:100%;">
              📖 Buka Rangkuman Panduan
            </button>
          </div>

          <div class="card">
            <div class="section-title" style="margin-bottom:8px;">📜 Lisensi</div>
            <p style="font-size:0.82rem; color:var(--color-muted);">
              DevWatch adalah perangkat lunak internal untuk penggunaan kantor. 
              Seluruh hak cipta dilindungi. Redistribusi tanpa izin dilarang.
            </p>
            <p style="font-size:0.78rem; color:var(--color-muted); margin-top:8px;">
              © 2026 DevWatch Internal System
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initAboutEvents() {
  document.getElementById('about-docs-btn')?.addEventListener('click', () => {
    Swal.fire({
      title: '📖 Buku Panduan Penggunaan DevWatch',
      html: `
        <div style="text-align:left; font-size:0.84rem; display:flex; flex-direction:column; gap:10px; max-height:360px; overflow-y:auto; padding-right:6px;">
          <div style="padding:8px; background:rgba(99,102,241,0.1); border-left:3px solid #6366f1; border-radius:4px;">
            <b>Panduan lengkap tersedia di:</b> <code>DOKUMENTASI_PENGGUNAAN.md</code>
          </div>
          <div><b>1. Akses Pengguna (Default RBAC):</b><br/>Admin: <code>admin@devwatch.local</code> / <code>admin123</code><br/>Teknisi: <code>teknisi@devwatch.local</code> / <code>teknisi123</code></div>
          <div><b>2. Monitoring Perangkat:</b><br/>Mendukung ICMP ping, ISAPI Hikvision, RTSP stream port 554, dan port scan umum.</div>
          <div><b>3. Peta Topologi Visual:</b><br/>Navigasi Gateway ➔ Core Switch ➔ Switch Distribusi ➔ Perangkat. Node dapat di-drag & drop.</div>
          <div><b>4. Backup Basis Data:</b><br/>Buka menu Pengaturan ➔ Sistem ➔ Cadangkan Database Sekarang untuk membuat snapshot SQLite & mengunduh berkas.</div>
          <div><b>5. Uji Beban & Deployment:</b><br/>Jalankan <code>npm run test:load</code> untuk uji 200+ perangkat, dan <code>npm run cert:generate</code> untuk sertifikat TLS.</div>
        </div>
      `,
      confirmButtonText: 'Tutup Panduan',
      confirmButtonColor: '#6366f1',
      background: '#1a1d2e',
      color: '#e2e8f0',
      width: 500,
    });
  });
}
