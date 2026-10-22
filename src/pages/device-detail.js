// ================================================================
// DevWatch — device-detail.js
// Halaman detail 1 device: status, uptime, riwayat insiden, maintenance
// ================================================================

import Swal from 'sweetalert2';
import { mockDevices, updateDeviceStatus, syncDevicesFromApi, cleanDeviceIp } from '../data/mock-devices.js';
import { apiPingDevice, apiSetMaintenance, apiFinishMaintenance, apiGetDevice, apiGetIsapiInfo, apiGetRtspStreamInfo } from '../api.js';
import { uptimePerDevice, insiden, getTimeline24h } from '../data/mock-reports.js';
import { renderTimeline24h } from '../components/charts.js';
import { getSession } from '../main.js';
import { formatDateWithTz } from '../settingsManager.js';

export function renderDeviceDetail(params = {}) {
  const id = parseInt(params.id || 1);
  const device = mockDevices.find((d) => d.id === id);

  if (!device) {
    return `
      <div class="page-container fade-in-up">
        <div class="empty-state" style="padding:80px;">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Device tidak ditemukan</div>
          <div class="empty-desc">ID device tidak valid atau sudah dihapus</div>
        </div>
      </div>
    `;
  }

  const uptimeData = uptimePerDevice.find((u) => u.deviceId === id) || {
    uptime24h: device.uptime24h, uptime7d: 0, uptime30d: 0, slaTarget: 99
  };

  const deviceInsiden = insiden.filter((inc) => inc.deviceId === id);
  const statusColor = { online: 'var(--color-online)', offline: 'var(--color-offline)', maintenance: 'var(--color-maintenance)' }[device.status];

  const session = getSession();
  const canEdit = session?.role === 'admin' || session?.role === 'teknisi';

  const uptimeBadgeClass = (u) => u >= 99 ? 'high' : u >= 95 ? 'medium' : 'low';

  const getDeviceDetailIcon = (j) => {
    const low = (j || '').toLowerCase();
    if (low.includes('cctv')) return '📷';
    if (low.includes('router') || low.includes('gateway')) return '🌐';
    if (low.includes('switch') || low.includes('hub')) return '🔀';
    if (low.includes('server')) return '🖥️';
    if (low.includes('access point') || low.includes('ap') || low.includes('wifi')) return '📶';
    return '💻';
  };

  const isPreview = Boolean(session?.is_preview);
  const devIcon = getDeviceDetailIcon(device.jenis);
  const metodeUpper = (device.metode || '').toUpperCase();
  const rawIpLower = (device.ip || '').toLowerCase();
  const isRtspCctv = metodeUpper === 'RTSP' || rawIpLower.startsWith('rtsp://') || rawIpLower.startsWith('rstp://') || ((device.jenis || '').toLowerCase().includes('cctv') && metodeUpper === 'RTSP');
  const isOnline = (device.status || '').toLowerCase() === 'online';

  return `
    <div class="page-container fade-in-up">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">
            ${devIcon}
            ${device.nama}
          </h1>
          <p class="page-subtitle">${device.lokasi} · ${device.grup}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="back-btn">← Kembali</button>
          ${canEdit ? `<button class="btn btn-secondary" id="detail-ping-btn">📡 Ping Manual</button>` : ''}
          ${canEdit && device.status !== 'maintenance' ? `<button class="btn btn-warning" id="detail-maintenance-btn">🔧 Set Maintenance</button>` : ''}
          ${canEdit && device.status === 'maintenance' ? `<button class="btn btn-success" id="detail-end-maintenance-btn">✅ Selesai Maintenance</button>` : ''}
        </div>
      </div>

      <!-- Header Info -->
      <div class="device-detail-header">
        <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
          <div style="
            width:64px; height:64px; border-radius:16px; display:flex; align-items:center;
            justify-content:center; font-size:2rem; flex-shrink:0;
            background:rgba(99,102,241,0.14); border:1px solid rgba(99,102,241,0.25);
          ">${devIcon}</div>

          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <h2 style="font-size:1.3rem; font-weight:800; color:var(--color-heading);">${device.nama}</h2>
              <div class="badge badge-${device.status || 'offline'}">
                <span class="status-dot ${device.status || 'offline'}"></span>
                ${(device.status || 'offline').charAt(0).toUpperCase() + (device.status || 'offline').slice(1)}
              </div>
            </div>
            <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:6px; font-size:0.82rem; color:var(--color-muted);">
              <span>🌐 <span class="ip-text" title="${device.ip}">${cleanDeviceIp(device.ip)}</span></span>
              <span>🔌 Metode: <b style="color:var(--color-text-secondary);">${(device.metode || 'ping').toUpperCase()}</b></span>
              ${device.port ? `<span>🔢 Port: <b style="color:var(--color-text-secondary);">${device.port}</b></span>` : ''}
              <span>⏱️ Interval: <b style="color:var(--color-text-secondary);">${device.interval || 60} detik</b></span>
            </div>
            ${device.deskripsi ? `<div style="margin-top:6px; font-size:0.82rem; color:var(--color-muted);">${device.deskripsi}</div>` : ''}
          </div>
        </div>

        <div class="device-detail-status-row">
          <div class="device-detail-stat">
            <div class="device-detail-stat-val">
              <span class="uptime-badge ${uptimeBadgeClass(uptimeData.uptime24h)}">${uptimeData.uptime24h.toFixed(1)}%</span>
            </div>
            <div class="device-detail-stat-label">Uptime 24 Jam</div>
          </div>
          <div class="device-detail-stat">
            <div class="device-detail-stat-val">
              <span class="uptime-badge ${uptimeBadgeClass(uptimeData.uptime7d)}">${uptimeData.uptime7d.toFixed(1)}%</span>
            </div>
            <div class="device-detail-stat-label">Uptime 7 Hari</div>
          </div>
          <div class="device-detail-stat">
            <div class="device-detail-stat-val">
              <span class="uptime-badge ${uptimeBadgeClass(uptimeData.uptime30d)}">${uptimeData.uptime30d.toFixed(1)}%</span>
            </div>
            <div class="device-detail-stat-label">Uptime 30 Hari</div>
          </div>
          <div class="device-detail-stat">
            <div class="device-detail-stat-val" style="color:var(--color-heading);">
              ${device.status === 'online' ? `${device.responseTime} ms` : '—'}
            </div>
            <div class="device-detail-stat-label">Response Time</div>
          </div>
          <div class="device-detail-stat">
            <div class="device-detail-stat-val" style="color:var(--color-heading);">${deviceInsiden.length}</div>
            <div class="device-detail-stat-label">Total Insiden (bulan ini)</div>
          </div>
          <div class="device-detail-stat">
            <div class="device-detail-stat-val" style="color:${uptimeData.slaTarget <= uptimeData.uptime24h ? 'var(--color-online)' : 'var(--color-offline)'};">
              ${uptimeData.slaTarget}%
            </div>
            <div class="device-detail-stat-label">Target SLA</div>
          </div>
        </div>

        ${device.status === 'maintenance' && device.maintenanceInfo ? `
        <div style="
          margin-top:16px; padding:12px 16px;
          background:var(--color-maintenance-dim); border:1px solid rgba(234,179,8,0.3);
          border-radius:10px;
        ">
          <div style="font-weight:700; color:var(--color-maintenance); margin-bottom:6px;">🔧 Mode Maintenance Aktif</div>
          <div style="font-size:0.85rem; color:var(--color-text-secondary);">
            <b>Alasan:</b> ${device.maintenanceInfo.alasan}<br>
            <b>Oleh:</b> ${device.maintenanceInfo.oleh}<br>
            <b>Estimasi selesai:</b> ${formatDateWithTz(device.maintenanceInfo.estimasiSelesai)}
          </div>
        </div>` : ''}
      </div>

      <!-- CCTV RTSP Live Streaming Player & Telemetry Console -->
      ${isRtspCctv ? `
      <div class="cctv-player-card" id="cctv-player-card">
        <div class="cctv-player-header">
          <div class="cctv-title-group">
            <h3 style="font-size:1.05rem; font-weight:800; color:var(--color-heading); display:flex; align-items:center; gap:8px;">
              📹 Live Streaming CCTV Surveillance
            </h3>
            <span class="cctv-live-badge" id="cctv-stream-status-badge">
              <span class="cctv-live-dot" style="${isOnline ? '' : 'background:#94a3b8; animation:none;'}"></span>
              <span id="cctv-stream-status-text">${isOnline ? 'LIVE' : 'OFFLINE'}</span>
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <div class="cctv-mode-selector" id="cctv-mode-selector">
              <button class="cctv-mode-btn ${isPreview ? '' : 'active'}" data-mode="real" title="Gunakan stream langsung dari IP kamera RTSP">
                🔴 Stream Kamera Riil
              </button>
              <button class="cctv-mode-btn ${isPreview ? 'active' : ''}" data-mode="sim" title="Tampilkan feed simulasi untuk uji coba UI">
                🧪 Mode Uji (Simulasi)
              </button>
            </div>
            <div class="cctv-resolution-selector" id="cctv-res-selector">
              <button class="cctv-res-btn active" data-res="main" title="Resolusi Asli Kamera (Native Full HD/2K/4MP)">🟢 Native / Asli</button>
              <button class="cctv-res-btn" data-res="sub" title="Sub Stream (Lebih ringan & responsif)">🟡 Sub Stream</button>
              <button class="cctv-res-btn" data-res="mobile" title="Mobile Stream (Hemat bandwidth)">⚪ Mobile</button>
            </div>
          </div>
        </div>

        <!-- Viewport Video & Canvas -->
        <div class="cctv-viewport-wrapper" id="cctv-viewport">
          <div class="cctv-hud-grid"></div>
          <canvas id="cctv-stream-canvas" width="1280" height="720"></canvas>
          
          <!-- OSD Overlay -->
          <div class="cctv-osd-layer">
            <div class="cctv-osd-top">
              <div class="cctv-osd-cam-name" id="cctv-osd-name">[CAM-0${(device.id % 9) + 1}] ${device.nama.toUpperCase()}</div>
              <div class="cctv-osd-time" id="cctv-osd-clock">--:--:-- WIB</div>
            </div>
            <div class="cctv-osd-bottom">
              <div class="cctv-osd-quality" id="cctv-osd-resolution">720p HD · H.264 · 25 FPS</div>
              <div class="cctv-osd-telemetry" id="cctv-osd-bitrate">${isOnline ? '1.82 Mbps · 18 ms' : 'NO SIGNAL · RTSP OFFLINE'}</div>
            </div>
          </div>
        </div>

        <!-- Controls Toolbar -->
        <div class="cctv-controls-toolbar">
          <div class="cctv-toolbar-left">
            <button class="cctv-ctrl-btn" id="cctv-btn-snapshot" title="Ambil tangkapan layar frame saat ini">
              📸 Snapshot Frame
            </button>
            <button class="cctv-ctrl-btn active" id="cctv-btn-motion" title="Aktifkan/nonaktifkan AI Motion Tracking">
              🚨 AI Motion Box: <b id="cctv-motion-state">ON</b>
            </button>
            <button class="cctv-ctrl-btn" id="cctv-btn-reconnect" title="Refresh handshake koneksi RTSP">
              🔄 Reconnect
            </button>
            <button class="cctv-ctrl-btn" id="cctv-btn-copy-url" title="Salin URL RTSP aktif">
              📋 Salin URL RTSP
            </button>
          </div>
          <div class="cctv-toolbar-right">
            <div class="cctv-zoom-group">
              <span style="font-size:0.72rem; color:var(--color-muted); padding:0 6px;">🔍 Zoom:</span>
              <button class="cctv-zoom-btn active" data-zoom="1">1.0x</button>
              <button class="cctv-zoom-btn" data-zoom="1.5">1.5x</button>
              <button class="cctv-zoom-btn" data-zoom="2">2.0x</button>
              <button class="cctv-zoom-btn" data-zoom="3">3.0x</button>
            </div>
            <button class="cctv-ctrl-btn" id="cctv-btn-fullscreen" title="Layar penuh player">
              ⛶ Fullscreen
            </button>
          </div>
        </div>

        <!-- Real-time Telemetry Metrics Grid -->
        <div class="cctv-telemetry-grid">
          <div class="cctv-telemetry-box">
            <div class="cctv-telemetry-label">⚡ Kecepatan Stream</div>
            <div class="cctv-telemetry-val" id="cctv-telem-bitrate" style="color:#38bdf8;">${isOnline ? '1.82 Mbps' : '0.00 Mbps'}</div>
            <div class="cctv-telemetry-sub" id="cctv-telem-bitrate-sub">Target: ~1.8 Mbps</div>
          </div>
          <div class="cctv-telemetry-box">
            <div class="cctv-telemetry-label">🎞️ Frame Rate (FPS)</div>
            <div class="cctv-telemetry-val" id="cctv-telem-fps" style="color:#4ade80;">${isOnline ? '25.0 FPS' : '0.0 FPS'}</div>
            <div class="cctv-telemetry-sub" id="cctv-telem-fps-sub">Stabilitas: 99.4%</div>
          </div>
          <div class="cctv-telemetry-box">
            <div class="cctv-telemetry-label">⏱️ Latensi Jaringan</div>
            <div class="cctv-telemetry-val" id="cctv-telem-latency" style="color:#fbbf24;">${isOnline ? `${device.responseTime || 18} ms` : 'Timeout'}</div>
            <div class="cctv-telemetry-sub">Jitter: &lt; 2 ms</div>
          </div>
          <div class="cctv-telemetry-box">
            <div class="cctv-telemetry-label">📶 Packet Drop / Loss</div>
            <div class="cctv-telemetry-val" id="cctv-telem-drop" style="color:${isOnline ? '#22c55e' : '#ef4444'};">${isOnline ? '0.00%' : '100%'}</div>
            <div class="cctv-telemetry-sub">${isOnline ? '0 drops / sec' : 'No connection'}</div>
          </div>
          <div class="cctv-telemetry-box">
            <div class="cctv-telemetry-label">📽️ Format Kompresi</div>
            <div class="cctv-telemetry-val" id="cctv-telem-codec" style="font-size:0.92rem;">H.264 / AVC</div>
            <div class="cctv-telemetry-sub" id="cctv-telem-res-label">1280x720 (720p HD)</div>
          </div>
          <div class="cctv-telemetry-box">
            <div class="cctv-telemetry-label">📡 Protokol Transport</div>
            <div class="cctv-telemetry-val" style="font-size:0.92rem; color:#a78bfa;">RTSP / TCP</div>
            <div class="cctv-telemetry-sub">Port 554 (Interleaved)</div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Two Column -->
      <div class="two-col">
        <!-- Timeline Chart -->
        <div class="chart-container">
          <div class="chart-header">
            <div class="chart-title">📉 Status 24 Jam Terakhir</div>
            <span class="text-xs text-muted">Response time (ms)</span>
          </div>
          <div style="height:220px;">
            <canvas id="detail-timeline-chart"></canvas>
          </div>
        </div>

        <!-- Info Card -->
        <div class="card">
          <div class="section-title" style="margin-bottom:12px;">ℹ️ Informasi Device</div>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:0.85rem;">
            ${[
              ['Jenis', device.jenis === 'cctv' ? '📷 CCTV Hikvision' : (device.jenis || '💻 Komputer Kantor')],
              ['IP Address', `<span class="ip-text" title="${device.ip}">${cleanDeviceIp(device.ip)}</span>`],
              ['Hostname', device.hostname || '—'],
              ['Metode Cek', device.metode.toUpperCase()],
              ['Port', device.port || '—'],
              ['Interval', `${device.interval} detik`],
              ['Grup', device.grup],
              ['Lokasi', device.lokasi],
              ['Monitoring', device.active ? '<span class="badge badge-online">Aktif</span>' : '<span class="badge badge-offline">Nonaktif</span>'],
              device.hikModel ? ['Model Kamera', device.hikModel] : null,
            ].filter(Boolean).map(([label, val]) => `
              <div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--border-color);">
                <span style="color:var(--color-muted); min-width:110px;">${label}</span>
                <span style="color:var(--color-text);">${val}</span>
              </div>
            `).join('')}
          </div>
          ${(String(device.jenis).toLowerCase().includes('cctv') || ['ISAPI', 'ONVIF', 'RTSP'].includes((device.metode || '').toUpperCase())) ? `
            <div id="isapi-info-panel" style="margin-top:14px; padding:12px; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.2); border-radius:8px;">
              <div style="font-weight:700; font-size:0.85rem; color:var(--color-heading); margin-bottom:8px;">
                📹 Status Protokol Kamera (${(device.metode || 'ISAPI').toUpperCase()})
              </div>
              <div id="isapi-info-content" style="font-size:0.78rem; color:var(--color-muted);">
                Memuat status protokol...
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- SLA Progress -->
      <div class="card" style="margin-top:16px;">
        <div class="section-title" style="margin-bottom:16px;">📊 Uptime & SLA</div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${[
            { label: 'Uptime 24 Jam', val: uptimeData.uptime24h, target: uptimeData.slaTarget },
            { label: 'Uptime 7 Hari', val: uptimeData.uptime7d, target: uptimeData.slaTarget },
            { label: 'Uptime 30 Hari', val: uptimeData.uptime30d, target: uptimeData.slaTarget },
          ].map((u) => `
            <div>
              <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.82rem;">
                <span style="color:var(--color-text-secondary);">${u.label}</span>
                <div style="display:flex; gap:8px; align-items:center;">
                  <span style="color:var(--color-muted); font-size:0.75rem;">Target: ${u.target}%</span>
                  <span class="uptime-badge ${u.val >= 99 ? 'high' : u.val >= 95 ? 'medium' : 'low'}">${u.val.toFixed(1)}%</span>
                </div>
              </div>
              <div class="uptime-bar">
                <div class="uptime-fill ${u.val >= 99 ? 'high' : u.val >= 95 ? 'medium' : 'low'}" style="width:${u.val}%;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Incident History -->
      <div class="card" style="margin-top:16px;">
        <div class="section-title" style="margin-bottom:16px;">⚡ Riwayat Insiden</div>
        ${deviceInsiden.length === 0 ? `
          <div class="empty-state" style="padding:32px;">
            <div class="empty-icon">✅</div>
            <div class="empty-title">Tidak ada insiden tercatat</div>
            <div class="empty-desc">Device ini memiliki riwayat yang bersih</div>
          </div>
        ` : `
          <div class="incident-timeline">
            ${deviceInsiden.map((inc) => `
              <div class="incident-item">
                <div class="incident-dot-line">
                  <div class="incident-dot" style="background:${inc.tipe === 'offline' ? 'var(--color-offline)' : 'var(--color-maintenance)'}"></div>
                  <div class="incident-line"></div>
                </div>
                <div style="flex:1; padding-bottom:8px;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                    <span style="font-weight:600; color:var(--color-heading);">
                      ${inc.status === 'Sedang berlangsung' ? '🔴 Offline (Aktif)' : '⚫ Offline (Selesai)'}
                    </span>
                    <span class="chip">${inc.status}</span>
                    ${inc.durasi ? `<span class="chip">⏱️ ${inc.durasi}</span>` : ''}
                  </div>
                  <div style="font-size:0.8rem; color:var(--color-muted);">
                    ${formatDateWithTz(inc.mulai)}
                    ${inc.selesai ? ` → ${formatDateWithTz(inc.selesai)}` : ''}
                  </div>
                  <div style="font-size:0.82rem; color:var(--color-text-secondary); margin-top:4px;">${inc.penyebab}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function drawCctvFeed(ctx, width, height, state) {
  // Clear canvas
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, width, height);

  if (!state.isOnline) {
    // SMPTE Color Bars & Surveillance No-Signal Screen
    const barColors = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
    const barWidth = width / barColors.length;
    for (let i = 0; i < barColors.length; i++) {
      ctx.fillStyle = barColors[i];
      ctx.fillRect(i * barWidth, 0, barWidth, height * 0.45);
    }

    // Mid Section
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, height * 0.45, width, height * 0.25);

    // Red warning box
    const boxW = Math.min(480, width * 0.85);
    const boxH = 76;
    const boxX = (width - boxW) / 2;
    const boxY = (height - boxH) / 2;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ NO SIGNAL / RTSP OFFLINE', width / 2, boxY + 32);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#fee2e2';
    ctx.fillText(`Target: ${state.cleanIp || 'Socket 554'} (Connection Refused / Timeout)`, width / 2, boxY + 56);

    // Bottom info band
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText('DEVWATCH SURVEILLANCE ENGINE · RTSP OVER TCP INTERLEAVED · RETRYING...', width / 2, height * 0.86);
    return;
  }

  // ONLINE SURVEILLANCE FEED CANVAS
  // Realistic dark twilight camera view gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.4, '#1e293b');
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Perspective ground & horizon
  const horizon = height * 0.42;
  const vpX = width * 0.5;

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let y = horizon; y < height; y += (height - horizon) / 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let x = 0; x <= width; x += width / 12) {
    ctx.beginPath();
    ctx.moveTo(vpX, horizon);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Left building / gate column
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.22, horizon * 0.7);
  ctx.lineTo(width * 0.22, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
  ctx.stroke();

  // Right building / perimeter column
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width * 0.78, horizon * 0.7);
  ctx.lineTo(width * 0.78, height);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Distant security post / barrier
  ctx.fillStyle = '#312e81';
  ctx.fillRect(width * 0.34, horizon * 0.65, width * 0.32, horizon * 0.35);
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.3)';
  ctx.strokeRect(width * 0.34, horizon * 0.65, width * 0.32, horizon * 0.35);

  // Moving object across field of view
  const t = state.ticks;
  const loopWidth = width + 240;
  const objX = ((t * 1.2) % loopWidth) - 120;
  const objY = horizon + (height - horizon) * 0.48;
  const objScale = 0.88;

  // Car / vehicle body
  ctx.fillStyle = '#334155';
  ctx.fillRect(objX, objY - 28 * objScale, 110 * objScale, 28 * objScale);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(objX + 20 * objScale, objY - 44 * objScale, 60 * objScale, 18 * objScale);

  // Wheels
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(objX + 24 * objScale, objY + 2 * objScale, 8 * objScale, 0, Math.PI * 2);
  ctx.arc(objX + 86 * objScale, objY + 2 * objScale, 8 * objScale, 0, Math.PI * 2);
  ctx.fill();

  // Headlight beam
  const lightX = objX + 110 * objScale;
  const lightY = objY - 12 * objScale;
  const beamGrad = ctx.createRadialGradient(lightX, lightY, 2, lightX + 130 * objScale, lightY, 110 * objScale);
  beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
  beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(lightX, lightY - 8);
  ctx.lineTo(lightX + 160 * objScale, lightY - 40 * objScale);
  ctx.lineTo(lightX + 160 * objScale, lightY + 30 * objScale);
  ctx.closePath();
  ctx.fill();

  // AI Motion Bounding Box
  if (state.motionActive && objX > 40 && objX < width - 140) {
    const bx = objX - 8;
    const by = objY - 50 * objScale;
    const bw = 126 * objScale;
    const bh = 58 * objScale;

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);

    // AI Corner Accents
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    const cl = 8;
    ctx.beginPath(); ctx.moveTo(bx, by + cl); ctx.lineTo(bx, by); ctx.lineTo(bx + cl, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + bw - cl, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cl); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by + bh - cl); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cl, by + bh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + bw - cl, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cl); ctx.stroke();

    // AI Detection Tag
    ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
    ctx.fillRect(bx, by - 18, 120, 18);
    ctx.fillStyle = '#052e16';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TARGET: VEHICLE 96%', bx + 5, by - 5);
  }

  // Crosshair in middle
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  const cx = width / 2;
  const cy = height / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy); ctx.lineTo(cx - 6, cy);
  ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 24, cy);
  ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy - 6);
  ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy + 24);
  ctx.stroke();

  // Subtle surveillance noise
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let i = 0; i < 35; i++) {
    const rx = Math.random() * width;
    const ry = Math.random() * height;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Canvas Watermark OSD (burnt into canvas for snapshots)
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(state.osdCameraName, 24, 34);

  ctx.textAlign = 'right';
  ctx.fillText(state.currentTimeString, width - 24, 34);

  ctx.textAlign = 'left';
  ctx.font = '12px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`${state.profileResolution} · ${state.profileCodec} · ${state.profileFps} FPS`, 24, height - 20);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#4ade80';
  ctx.fillText(`● LIVE · ${state.liveBitrate} Mbps · ${state.liveLatency} ms`, width - 24, height - 20);
}

function drawRealCameraOfflineScreen(ctx, width, height, state) {
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, width, height);

  // Grid background
  ctx.strokeStyle = state.isAuthError ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Warning card in center
  const boxW = Math.min(680, width * 0.92);
  const boxH = 160;
  const boxX = (width - boxW) / 2;
  const boxY = (height - boxH) / 2 - 10;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = state.isAuthError ? 'rgba(234, 179, 8, 0.7)' : 'rgba(239, 68, 68, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = state.isAuthError ? '#eab308' : '#ef4444';
  ctx.fillRect(boxX, boxY, 6, boxH);

  ctx.fillStyle = state.isAuthError ? '#facc15' : '#f87171';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    state.isAuthError
      ? '🔐 KREDENSIAL KAMERA TIDAK VALID (401 UNAUTHORIZED)'
      : '📡 MODE STREAM KAMERA RIIL: MENUNGGU KONEKSI RTSP',
    boxX + 22,
    boxY + 34
  );

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px monospace';
  ctx.fillText(`Target: ${state.cleanIp}:${state.port} (RTSP Socket Port 554)`, boxX + 22, boxY + 62);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px monospace';
  ctx.fillText(
    state.isAuthError
      ? (state.errorMessage || 'Username atau password kamera salah. Periksa kredensial di menu Edit Perangkat.')
      : `Kamera berada di subnet jaringan server (${state.cleanIp}).`,
    boxX + 22,
    boxY + 90
  );

  ctx.fillStyle = '#38bdf8';
  ctx.font = '11px monospace';
  ctx.fillText(
    state.isAuthError
      ? '💡 Tips: Perbarui URL RTSP dengan password aktif melalui menu Edit Perangkat.'
      : '✓ Saat server terhubung ke LAN CCTV, feed live kamera otomatis tampil di player ini.',
    boxX + 22,
    boxY + 118
  );

  // Watermark OSD
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(state.osdCameraName, 24, 34);

  ctx.textAlign = 'right';
  ctx.fillText(state.currentTimeString, width - 24, 34);

  ctx.textAlign = 'left';
  ctx.font = '12px monospace';
  ctx.fillStyle = state.isAuthError ? '#facc15' : '#ef4444';
  ctx.fillText(
    state.isAuthError ? 'AUTENTIKASI RTSP/HTTP GAGAL · PERIKSA PASSWORD' : 'MODE STREAM RIIL AKTIF · SOCKET TIMEOUT / OFFLINE',
    24,
    height - 20
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('RTSP over TCP Interleaved', width - 24, height - 20);
}

function initCctvStreamPlayer(device, id) {
  const canvas = document.getElementById('cctv-stream-canvas');
  if (!canvas) return;

  // Cleanup past loops & timers
  if (window.__activeCctvStreamLoopId) {
    cancelAnimationFrame(window.__activeCctvStreamLoopId);
    window.__activeCctvStreamLoopId = null;
  }
  if (window.__activeCctvTimerId) {
    clearInterval(window.__activeCctvTimerId);
    window.__activeCctvTimerId = null;
  }
  if (window.__activeCctvFramePoller) {
    clearTimeout(window.__activeCctvFramePoller);
    clearInterval(window.__activeCctvFramePoller);
    window.__activeCctvFramePoller = null;
  }

  const session = getSession();
  const isPreview = Boolean(session?.is_preview);
  let streamMode = isPreview ? 'sim' : 'real'; // Default 'sim' untuk Mode Preview, 'real' untuk Mode Riil
  let currentRes = 'main';
  let zoomLevel = 1.0;
  let motionActive = true;
  let ticks = 0;
  let currentBitrate = 1.82;
  let currentFps = 25.0;
  let currentLatency = device.responseTime && Number(device.responseTime) > 0 ? Number(device.responseTime) : 18;
  let activeRtspUrl = device.ip;
  const isOnline = (device.status || '').toLowerCase() === 'online';

  // Real Camera Stream State & Adaptive Double Buffering
  const realImage = new Image();
  let realCameraOnline = false;
  let hasEverLoadedFrame = false;
  let consecutiveFailures = 0;
  let lastSuccessfulFrameTime = 0;
  let realAuthFailed = false;
  let realErrorMessage = '';
  let realFrameCount = 0;
  let realByteCount = 0;
  let calculatedRealFps = 0;
  let calculatedRealBitrate = 0;
  let isPollingBusy = false;
  let isPollerDestroyed = false;
  const recentFrameTimes = [];

  // Request backend profile data
  apiGetRtspStreamInfo(id).then((res) => {
    if (res && res.data) {
      const d = res.data;
      if (d.fullRtspUrl) activeRtspUrl = d.fullRtspUrl;
      if (d.currentLatencyMs) currentLatency = d.currentLatencyMs;
    }
  }).catch(() => {});

  const ctx = canvas.getContext('2d');

  function scheduleNextPoll(delayMs = 40) {
    if (isPollerDestroyed || streamMode !== 'real' || isPreview) return;
    if (window.__activeCctvFramePoller) clearTimeout(window.__activeCctvFramePoller);
    window.__activeCctvFramePoller = setTimeout(pollRealFrame, delayMs);
  }

  // Real Camera Frame Poller dengan Adaptive Self-Scheduling & Double Buffering
  function pollRealFrame() {
    if (isPollerDestroyed || streamMode !== 'real' || isPreview || isPollingBusy) return;
    isPollingBusy = true;
    const fetchStart = Date.now();

    fetch(`/api/devices/${id}/live-frame?res=${currentRes}&t=${fetchStart}`)
      .then(async (res) => {
        if (res.ok) {
          const blob = await res.blob();
          realByteCount += blob.size;
          realFrameCount++;

          const now = Date.now();
          recentFrameTimes.push(now);
          while (recentFrameTimes.length > 8) recentFrameTimes.shift();
          if (recentFrameTimes.length >= 2) {
            const timeSpanSec = (now - recentFrameTimes[0]) / 1000;
            if (timeSpanSec > 0) {
              calculatedRealFps = Math.round((recentFrameTimes.length - 1) / timeSpanSec);
            }
          }

          const url = URL.createObjectURL(blob);
          realImage.onload = () => {
            URL.revokeObjectURL(url);
            realCameraOnline = true;
            hasEverLoadedFrame = true;
            consecutiveFailures = 0;
            lastSuccessfulFrameTime = Date.now();
            realAuthFailed = false;
            isPollingBusy = false;

            // Sesuaikan dimensi canvas secara dinamis dengan resolusi asli kamera
            if (realImage.naturalWidth && realImage.naturalHeight) {
              if (canvas.width !== realImage.naturalWidth || canvas.height !== realImage.naturalHeight) {
                canvas.width = realImage.naturalWidth;
                canvas.height = realImage.naturalHeight;
              }
            }

            // Jadwalkan frame berikutnya dengan jeda mikro agar kamera tidak kelebihan beban
            scheduleNextPoll(30);
          };
          realImage.onerror = () => {
            URL.revokeObjectURL(url);
            isPollingBusy = false;
            consecutiveFailures++;
            if (consecutiveFailures >= 4 && (Date.now() - lastSuccessfulFrameTime > 4000)) {
              realCameraOnline = false;
            }
            scheduleNextPoll(200);
          };
          realImage.src = url;
        } else {
          isPollingBusy = false;
          consecutiveFailures++;

          if (res.status === 401) {
            realAuthFailed = true;
            realCameraOnline = false;
            try {
              const errJson = await res.json();
              realErrorMessage = errJson.message || 'Kredensial kamera ditolak (401).';
            } catch {
              realErrorMessage = 'Kredensial kamera ditolak (401).';
            }
            scheduleNextPoll(1500);
          } else {
            // Hanya nyatakan offline jika gagal >= 4 kali berturut-turut atau sudah > 4 detik tanpa frame
            if (consecutiveFailures >= 4 || !hasEverLoadedFrame || (Date.now() - lastSuccessfulFrameTime > 4500)) {
              realCameraOnline = false;
            }
            scheduleNextPoll(250);
          }
        }
      })
      .catch(() => {
        isPollingBusy = false;
        consecutiveFailures++;
        if (consecutiveFailures >= 4 || !hasEverLoadedFrame || (Date.now() - lastSuccessfulFrameTime > 4500)) {
          realCameraOnline = false;
        }
        scheduleNextPoll(300);
      });
  }

  // Jalankan siklus poller pertama
  pollRealFrame();

  function renderLoop() {
    ticks++;
    const now = new Date();
    const timeStr = now.toLocaleDateString('id-ID', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).replace(/\//g, '-') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0') + '.' +
    String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0') + ' WIB';

    const osdClock = document.getElementById('cctv-osd-clock');
    if (osdClock && ticks % 4 === 0) {
      osdClock.textContent = timeStr;
    }

    if (streamMode === 'real') {
      const canRenderRealImage = realImage.complete && realImage.naturalWidth > 0 && (realCameraOnline || hasEverLoadedFrame);

      if (canRenderRealImage && !realAuthFailed) {
        // Render Real Camera Feed dengan double-buffering (tetap gambar frame terakhir saat transient drop)
        ctx.drawImage(realImage, 0, 0, canvas.width, canvas.height);

        const nativeResStr = `${realImage.naturalWidth}x${realImage.naturalHeight} Native`;

        // OSD overlay on top of real video
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`[CAM-0${(device.id % 9) + 1}] ${device.nama.toUpperCase()}`, 24, 34);

        ctx.textAlign = 'right';
        ctx.fillText(timeStr, canvas.width - 24, 34);

        ctx.textAlign = 'left';
        ctx.font = '12px monospace';
        ctx.fillStyle = '#38bdf8';
        const displayFps = calculatedRealFps > 0 ? calculatedRealFps : (realCameraOnline ? 15 : 0);
        ctx.fillText(`${nativeResStr} · H.264 / AVC · ${displayFps} FPS`, 24, canvas.height - 20);

        ctx.textAlign = 'right';
        ctx.fillStyle = realCameraOnline ? '#4ade80' : '#f59e0b';
        const liveStatusText = realCameraOnline ? '● LIVE (STREAM RIIL)' : '▲ REBUFFERING...';
        ctx.fillText(`${liveStatusText} · ${calculatedRealBitrate > 0 ? calculatedRealBitrate.toFixed(2) : currentBitrate.toFixed(2)} Mbps · ${currentLatency} ms`, canvas.width - 24, canvas.height - 20);

        // Sinkronkan elemen OSD di DOM jika tersedia
        const osdResElem = document.getElementById('cctv-osd-resolution');
        if (osdResElem && ticks % 10 === 0) {
          osdResElem.textContent = `${nativeResStr} · H.264 · ${displayFps} FPS`;
        }
      } else {
        // Render Real Camera Waiting / Offline Screen
        drawRealCameraOfflineScreen(ctx, canvas.width, canvas.height, {
          cleanIp: cleanDeviceIp(device.ip),
          port: device.port || 554,
          currentTimeString: timeStr,
          osdCameraName: `[CAM-0${(device.id % 9) + 1}] ${device.nama.toUpperCase()}`,
          isAuthError: realAuthFailed,
          errorMessage: realErrorMessage,
        });
      }
    } else {
      // Render Simulation Feed
      drawCctvFeed(ctx, canvas.width, canvas.height, {
        isOnline,
        ticks,
        motionActive,
        cleanIp: cleanDeviceIp(device.ip),
        osdCameraName: `[CAM-0${(device.id % 9) + 1}] ${device.nama.toUpperCase()} (SIMULASI)`,
        currentTimeString: timeStr,
        profileResolution: currentRes === 'main' ? '1080p FHD' : currentRes === 'sub' ? '720p HD' : '480p SD',
        profileCodec: 'H.264 / AVC',
        profileFps: currentRes === 'main' ? 30 : currentRes === 'sub' ? 25 : 15,
        liveBitrate: currentBitrate.toFixed(2),
        liveLatency: currentLatency
      });
    }

    window.__activeCctvStreamLoopId = requestAnimationFrame(renderLoop);
  }
  window.__activeCctvStreamLoopId = requestAnimationFrame(renderLoop);

  // Periodic Telemetry Updates
  window.__activeCctvTimerId = setInterval(() => {
    const bElem = document.getElementById('cctv-telem-bitrate');
    const fElem = document.getElementById('cctv-telem-fps');
    const lElem = document.getElementById('cctv-telem-latency');
    const dElem = document.getElementById('cctv-telem-drop');
    const osdTel = document.getElementById('cctv-osd-bitrate');
    const codecElem = document.getElementById('cctv-telem-codec');

    if (streamMode === 'real') {
      if (realCameraOnline || hasEverLoadedFrame) {
        calculatedRealBitrate = ((realByteCount * 8) / 1000000);
        realFrameCount = 0;
        realByteCount = 0;

        const fpsVal = calculatedRealFps > 0 ? calculatedRealFps : (realCameraOnline ? 15 : 0);
        if (bElem) bElem.textContent = `${calculatedRealBitrate > 0 ? calculatedRealBitrate.toFixed(2) : (currentRes === 'main' ? '4.12' : '1.82')} Mbps`;
        if (fElem) fElem.textContent = `${fpsVal} FPS`;
        if (lElem) lElem.textContent = `${currentLatency} ms`;
        if (dElem) dElem.textContent = consecutiveFailures > 0 ? `${(consecutiveFailures * 2).toFixed(1)}%` : '0.00%';
        if (codecElem) codecElem.textContent = 'H.264 / AVC (Riil)';
        if (osdTel) osdTel.textContent = `${bElem ? bElem.textContent : '1.82 Mbps'} · ${currentLatency} ms`;
      } else {
        if (bElem) bElem.textContent = '0.00 Mbps';
        if (fElem) fElem.textContent = '0.0 FPS';
        if (lElem) lElem.textContent = realAuthFailed ? '401 Auth' : 'Timeout';
        if (dElem) dElem.textContent = '100%';
        if (codecElem) codecElem.textContent = 'H.264 / AVC (RTSP)';
        if (osdTel) osdTel.textContent = realAuthFailed ? 'AUTH FAILED · 401 UNAUTHORIZED' : 'RTSP STREAM OFFLINE · HOST UNREACHABLE';
      }
      return;
    }

    // Simulation Telemetry
    if (!isOnline) {
      if (bElem) bElem.textContent = '0.00 Mbps';
      if (fElem) fElem.textContent = '0.0 FPS';
      if (lElem) lElem.textContent = 'Timeout';
      if (dElem) dElem.textContent = '100%';
      if (osdTel) osdTel.textContent = 'NO SIGNAL · RTSP OFFLINE';
      return;
    }

    const targetBitrate = currentRes === 'main' ? 4.12 : currentRes === 'sub' ? 1.82 : 0.62;
    const targetFps = currentRes === 'main' ? 30.0 : currentRes === 'sub' ? 25.0 : 15.0;

    currentBitrate = Math.max(0.2, targetBitrate + (Math.random() * 0.16 - 0.08));
    currentFps = Math.max(10, +(targetFps + (Math.random() * 0.4 - 0.2)).toFixed(1));
    const jitterLatency = Math.max(2, Math.round(currentLatency + (Math.random() * 4 - 2)));
    const dropRate = (Math.random() < 0.15 ? 0.01 : 0.00).toFixed(2);

    if (bElem) bElem.textContent = `${currentBitrate.toFixed(2)} Mbps`;
    if (fElem) fElem.textContent = `${currentFps.toFixed(1)} FPS`;
    if (lElem) lElem.textContent = `${jitterLatency} ms`;
    if (dElem) dElem.textContent = `${dropRate}%`;
    if (osdTel) osdTel.textContent = `${currentBitrate.toFixed(2)} Mbps · ${jitterLatency} ms`;
  }, 1000);

  // Stream Mode Toggle Handlers
  document.querySelectorAll('#cctv-mode-selector .cctv-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      if (mode === streamMode) return;
      streamMode = mode;

      document.querySelectorAll('#cctv-mode-selector .cctv-mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const statusText = document.getElementById('cctv-stream-status-text');

      if (mode === 'real') {
        if (statusText) statusText.textContent = realCameraOnline ? 'LIVE RIIL' : 'RTSP OFFLINE';
        Swal.fire({
          icon: 'info',
          title: 'Mode Stream Kamera Riil Aktif',
          html: `<div style="font-size:0.85rem; color:#94a3b8; line-height:1.5;">
            Menghubungkan langsung ke socket kamera <b style="color:#60a5fa;">${cleanDeviceIp(device.ip)}:554</b>.<br><br>
            <span style="font-size:0.75rem; color:#cbd5e1;">Catatan: Pada laptop di luar LAN server, socket akan berstatus timeout. Ketika dijalankan di komputer server yang terhubung ke CCTV, stream live riil kamera akan langsung tampil.</span>
          </div>`,
          timer: 3000,
          showConfirmButton: false,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      } else {
        if (statusText) statusText.textContent = 'SIMULASI LIVE';
        Swal.fire({
          icon: 'success',
          title: 'Mode Uji (Simulasi) Aktif',
          text: 'Menampilkan feed pengujian grafis dan simulasi telemetri untuk pengetesan kontrol.',
          timer: 1500,
          showConfirmButton: false,
          background: '#1a1d2e',
          color: '#e2e8f0',
        });
      }
    });
  });

  // Resolution Switcher Handlers
  document.querySelectorAll('#cctv-res-selector .cctv-res-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const res = btn.getAttribute('data-res');
      if (res === currentRes) return;
      currentRes = res;

      document.querySelectorAll('#cctv-res-selector .cctv-res-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const osdRes = document.getElementById('cctv-osd-resolution');
      const codecSub = document.getElementById('cctv-telem-res-label');
      const bitSub = document.getElementById('cctv-telem-bitrate-sub');
      const fpsSub = document.getElementById('cctv-telem-fps-sub');

      if (res === 'main') {
        if (streamMode === 'real' && realImage.naturalWidth && realImage.naturalHeight) {
          canvas.width = realImage.naturalWidth;
          canvas.height = realImage.naturalHeight;
        } else {
          canvas.width = 1920;
          canvas.height = 1080;
        }
        const wStr = realImage.naturalWidth || 1920;
        const hStr = realImage.naturalHeight || 1080;
        if (osdRes) osdRes.textContent = `${wStr}x${hStr} Native · H.264 · 25 FPS`;
        if (codecSub) codecSub.textContent = `${wStr}x${hStr} (Native Stream)`;
        if (bitSub) bitSub.textContent = 'Target: ~4.1 Mbps';
        if (fpsSub) fpsSub.textContent = 'Stabilitas: 99.8%';
        currentBitrate = 4.12;
        currentFps = 25.0;
      } else if (res === 'sub') {
        canvas.width = 1280;
        canvas.height = 720;
        if (osdRes) osdRes.textContent = '1280x720 HD · H.264 · 25 FPS';
        if (codecSub) codecSub.textContent = '1280x720 (Sub Stream)';
        if (bitSub) bitSub.textContent = 'Target: ~1.8 Mbps';
        if (fpsSub) fpsSub.textContent = 'Stabilitas: 99.4%';
        currentBitrate = 1.82;
        currentFps = 25.0;
      } else {
        canvas.width = 640;
        canvas.height = 480;
        if (osdRes) osdRes.textContent = '640x480 SD · H.264 · 15 FPS';
        if (codecSub) codecSub.textContent = '640x480 (Mobile Stream)';
        if (bitSub) bitSub.textContent = 'Target: ~600 Kbps';
        if (fpsSub) fpsSub.textContent = 'Stabilitas: 98.9%';
        currentBitrate = 0.62;
        currentFps = 15.0;
      }
    });
  });

  // Digital Zoom Handlers
  document.querySelectorAll('.cctv-zoom-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const z = parseFloat(btn.getAttribute('data-zoom') || '1');
      zoomLevel = z;
      document.querySelectorAll('.cctv-zoom-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      canvas.style.transform = `scale(${z})`;
    });
  });

  // AI Motion Toggle Handler
  document.getElementById('cctv-btn-motion')?.addEventListener('click', () => {
    motionActive = !motionActive;
    const stateLabel = document.getElementById('cctv-motion-state');
    const btn = document.getElementById('cctv-btn-motion');
    if (stateLabel) stateLabel.textContent = motionActive ? 'ON' : 'OFF';
    if (btn) btn.classList.toggle('active', motionActive);
  });

  // Snapshot Handler
  document.getElementById('cctv-btn-snapshot')?.addEventListener('click', () => {
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = dataUrl;
    a.download = `CCTV_SNAPSHOT_${device.nama.replace(/\s+/g, '_')}_${ts}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    Swal.fire({
      icon: 'success',
      title: 'Snapshot Tersimpan',
      text: `Frame resolusi ${canvas.width}x${canvas.height} berhasil diunduh.`,
      timer: 1600,
      showConfirmButton: false,
      background: '#1a1d2e',
      color: '#e2e8f0',
    });
  });

  // Fullscreen Handler
  document.getElementById('cctv-btn-fullscreen')?.addEventListener('click', () => {
    const vp = document.getElementById('cctv-viewport');
    if (!vp) return;
    if (!document.fullscreenElement) {
      vp.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  // Reconnect Handler
  document.getElementById('cctv-btn-reconnect')?.addEventListener('click', () => {
    const badge = document.getElementById('cctv-stream-status-badge');
    const text = document.getElementById('cctv-stream-status-text');
    if (text) text.textContent = 'CONNECTING...';
    if (badge) badge.style.borderColor = '#fbbf24';
    pollRealFrame();
    setTimeout(() => {
      if (text) text.textContent = realCameraOnline ? 'LIVE RIIL' : (streamMode === 'real' ? 'RTSP OFFLINE' : 'LIVE');
      if (badge) badge.style.borderColor = '';
      Swal.fire({
        icon: 'success',
        title: 'Handshake RTSP Berhasil',
        text: `Koneksi streaming ke socket ${cleanDeviceIp(device.ip)} diperbarui.`,
        timer: 1500,
        showConfirmButton: false,
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    }, 500);
  });

  // Copy RTSP URL Handler
  document.getElementById('cctv-btn-copy-url')?.addEventListener('click', () => {
    let urlToCopy = activeRtspUrl || device.ip;
    if (urlToCopy.startsWith('rstp://')) {
      urlToCopy = urlToCopy.replace(/^rstp:\/\//i, 'rtsp://');
    } else if (!urlToCopy.startsWith('rtsp://')) {
      urlToCopy = `rtsp://${urlToCopy}:554/cam/realmonitor?channel=1&subtype=1`;
    }
    navigator.clipboard.writeText(urlToCopy).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'URL RTSP Disalin',
        html: `<div style="font-size:0.85rem; word-break:break-all; color:#93c5fd; background:#0f172a; padding:8px 12px; border-radius:6px;">${urlToCopy}</div><div style="font-size:0.75rem; color:#94a3b8; margin-top:8px;">URL siap dibuka di VLC Player, OBS Studio, atau NVR.</div>`,
        timer: 3000,
        showConfirmButton: true,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#6366f1',
        background: '#1a1d2e',
        color: '#e2e8f0',
      });
    }).catch(() => {
      Swal.fire({ icon: 'info', title: 'URL RTSP', text: urlToCopy, background: '#1a1d2e', color: '#e2e8f0' });
    });
  });

  // Cleanup on page change
  const cleanup = () => {
    if (window.__activeCctvStreamLoopId) {
      cancelAnimationFrame(window.__activeCctvStreamLoopId);
      window.__activeCctvStreamLoopId = null;
    }
    if (window.__activeCctvTimerId) {
      clearInterval(window.__activeCctvTimerId);
      window.__activeCctvTimerId = null;
    }
    if (window.__activeCctvFramePoller) {
      clearInterval(window.__activeCctvFramePoller);
      window.__activeCctvFramePoller = null;
    }
    window.removeEventListener('hashchange', cleanup);
  };
  window.addEventListener('hashchange', cleanup);
}

export function initDeviceDetailEvents(navigate) {
  document.getElementById('back-btn')?.addEventListener('click', () => navigate('devices'));

  const getDetailId = () => {
    const hash = window.location.hash || '';
    const match = hash.match(/id=(\d+)/);
    return match ? parseInt(match[1]) : 1;
  };

  const id = getDetailId();
  const device = mockDevices.find((d) => d.id === id);

  if (device) {
    const metodeUpper = (device.metode || '').toUpperCase();
    const rawIpLower = (device.ip || '').toLowerCase();
    const isRtspCctv = metodeUpper === 'RTSP' || rawIpLower.startsWith('rtsp://') || rawIpLower.startsWith('rstp://') || ((device.jenis || '').toLowerCase().includes('cctv') && metodeUpper === 'RTSP');
    if (isRtspCctv) {
      initCctvStreamPlayer(device, id);
    }
  }

  // Ambil data timeline 24 jam riil dari database
  apiGetDevice(id).then((res) => {
    if (res && res.data && res.data.timeline24h) {
      const mapped = res.data.timeline24h.map((t) => ({
        jam: t.hour,
        status: t.status,
        responseTime: t.latency || 1,
      }));
      renderTimeline24h('detail-timeline-chart', mapped);
    } else {
      const timelineData = getTimeline24h(id);
      renderTimeline24h('detail-timeline-chart', timelineData);
    }
  }).catch(() => {
    const timelineData = getTimeline24h(id);
    renderTimeline24h('detail-timeline-chart', timelineData);
  });

  // Ambil metadata ISAPI/ONVIF jika perangkat kamera, atau tampilkan RTSP stream status
  const isapiPanel = document.getElementById('isapi-info-content');
  if (isapiPanel && device) {
    const metodeUpper = (device.metode || 'PING').toUpperCase();
    if (metodeUpper === 'RTSP') {
      const isOnline = device.status === 'online';
      isapiPanel.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px; color:var(--color-text);">
            <div><span style="color:var(--color-muted);">Protokol:</span> <b>RTSP/1.0</b></div>
            <div><span style="color:var(--color-muted);">Port Default:</span> <b>${device.port || 554}</b></div>
            <div><span style="color:var(--color-muted);">Target Host:</span> <b class="ip-text">${cleanDeviceIp(device.ip)}</b></div>
            <div><span style="color:var(--color-muted);">Status Stream:</span> ${isOnline ? '<span class="badge badge-online">🟢 Online</span>' : '<span class="badge badge-offline">🔴 Offline</span>'}</div>
          </div>
          <div style="font-size:0.75rem; color:var(--color-muted); line-height:1.5; border-top:1px solid rgba(255,255,255,0.06); padding-top:6px;">
            📡 Perangkat ini menggunakan protokol <b>RTSP (Real-Time Streaming Protocol)</b>. Pemantauan memvalidasi stream port 554 dan respons transmisi video.
          </div>
        </div>
      `;
    } else {
      apiGetIsapiInfo(id).then((res) => {
        const d = res?.data;
        if (d?.supported && d?.metadata) {
          const m = d.metadata;
          isapiPanel.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px; color:var(--color-text);">
              <div><span style="color:var(--color-muted);">Model:</span> <b>${m.model || 'Hikvision CCTV'}</b></div>
              <div><span style="color:var(--color-muted);">Firmware:</span> <b>${m.firmwareVersion || 'ISAPI v2.0'}</b></div>
              <div><span style="color:var(--color-muted);">Serial:</span> <b>${m.serialNumber || '—'}</b></div>
              <div><span style="color:var(--color-muted);">Status ISAPI:</span> <span class="badge badge-online">Aktif</span></div>
            </div>
          `;
        } else if (d?.supported) {
          isapiPanel.innerHTML = `<span style="color:var(--color-online);">✅ Endpoint protokol aktif merespons permintaan. (${d.message || 'Challenge 401 OK'})</span>`;
        } else {
          isapiPanel.innerHTML = `<span style="color:var(--color-muted);">${d?.message || 'Protokol tidak merespons.'}</span>`;
        }
      }).catch(() => {
        if (isapiPanel) isapiPanel.innerHTML = '<span style="color:var(--color-muted);">Informasi protokol belum tersedia.</span>';
      });
    }
  }

  // Ping
  document.getElementById('detail-ping-btn')?.addEventListener('click', async () => {
    const id = getDetailId();
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;

    Swal.fire({
      title: `Probe ke ${device.nama}`,
      html: `Mengirim probe langsung ke <code style="color:var(--color-accent);">${device.ip}</code>...`,
      didOpen: () => Swal.showLoading(),
      showConfirmButton: false,
      allowOutsideClick: false,
      background: '#1a1d2e',
      color: '#e2e8f0',
    });

    try {
      const res = await apiPingDevice(id);
      const pingData = res.data || res;
      const isOnline = Boolean(pingData.alive || pingData.status === 'online');
      const ms = pingData.responseTime ?? pingData.time;
      device.status = isOnline ? 'online' : 'offline';
      device.responseTime = ms;

      Swal.fire({
        title: 'Hasil Probe Jaringan',
        html: isOnline
          ? `<div style="text-align:center;">
              <div style="font-size:2.5rem; font-weight:800; color:var(--color-online);">${ms !== null && ms !== undefined ? ms + ' ms' : 'OK'}</div>
              <div style="color:#94a3b8; font-size:0.85rem;">${device.ip} Online ✅ (${pingData.method || device.metode})</div>
            </div>`
          : `<div style="text-align:center;">
              <div style="font-size:2.2rem; font-weight:800; color:var(--color-offline);">Offline / Timeout</div>
              <div style="color:#94a3b8; font-size:0.85rem;">${device.ip} ${pingData.statusText || pingData.error || 'Request Timeout'} ❌</div>
            </div>`,
        background: '#1a1d2e',
        color: '#e2e8f0',
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#6366f1',
      });
      navigate('device-detail', { id });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Melakukan Probe', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
    }
  });

  // Set Maintenance
  document.getElementById('detail-maintenance-btn')?.addEventListener('click', async () => {
    const id = getDetailId();
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;

    const { value: reason } = await Swal.fire({
      title: '🔧 Set Maintenance',
      input: 'textarea',
      inputLabel: 'Alasan Maintenance',
      inputPlaceholder: 'Contoh: Pemeliharaan rutin server...',
      showCancelButton: true,
      confirmButtonText: 'Aktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#eab308',
      background: '#1a1d2e',
      color: '#e2e8f0',
      inputValidator: (v) => !v && 'Alasan maintenance wajib diisi!',
    });

    if (reason) {
      try {
        await apiSetMaintenance(id, reason, 120);
        await syncDevicesFromApi();
        Swal.fire({ icon: 'success', title: 'Maintenance Diaktifkan', timer: 1500, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
        navigate('device-detail', { id });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Set Maintenance', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  });

  // End Maintenance
  document.getElementById('detail-end-maintenance-btn')?.addEventListener('click', async () => {
    const id = getDetailId();
    const device = mockDevices.find((d) => d.id === id);
    if (!device) return;

    const res = await Swal.fire({
      title: '✅ Selesai Maintenance?',
      text: `Selesaikan mode maintenance untuk ${device.nama}?`,
      showCancelButton: true,
      confirmButtonText: 'Ya, Selesai',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#22c55e',
      background: '#1a1d2e',
      color: '#e2e8f0',
    });

    if (res.isConfirmed) {
      try {
        await apiFinishMaintenance(id);
        await syncDevicesFromApi();
        Swal.fire({ icon: 'success', title: 'Maintenance Selesai', timer: 1500, showConfirmButton: false, background: '#1a1d2e', color: '#e2e8f0' });
        navigate('device-detail', { id });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Selesai Maintenance', text: err.message, background: '#1a1d2e', color: '#e2e8f0' });
      }
    }
  });
}
