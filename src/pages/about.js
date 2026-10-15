// ================================================================
// DevWatch — about.js
// Halaman tentang aplikasi
// ================================================================

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
  // No interactive events needed
}
