// ================================================================
// DevWatch — device-detail.js
// Halaman detail 1 device: status, uptime, riwayat insiden, maintenance
// ================================================================

import Swal from 'sweetalert2';
import { mockDevices, updateDeviceStatus, syncDevicesFromApi, cleanDeviceIp } from '../data/mock-devices.js';
import { apiPingDevice, apiSetMaintenance, apiFinishMaintenance, apiGetDevice, apiGetIsapiInfo } from '../api.js';
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

  const devIcon = getDeviceDetailIcon(device.jenis);

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

export function initDeviceDetailEvents(navigate) {
  document.getElementById('back-btn')?.addEventListener('click', () => navigate('devices'));

  const getDetailId = () => {
    const hash = window.location.hash || '';
    const match = hash.match(/id=(\d+)/);
    return match ? parseInt(match[1]) : 1;
  };

  const id = getDetailId();

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
