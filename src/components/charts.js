// ================================================================
// DevWatch - charts.js
// Chart.js wrappers: timeline 24h, uptime bar, weekly trend, incidents
// Mendukung responsivitas tema otomatis (Dark / Soft Light Mode)
// ================================================================

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

/**
 * Menghasilkan token warna grafik sesuai tema aktif
 */
function getChartColors() {
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  return {
    isLight,
    gridColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.04)',
    tickColor: isLight ? '#64748b' : '#94a3b8',
    tooltipBg: isLight ? '#ffffff' : '#1a1d2e',
    tooltipBorder: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.08)',
    tooltipTitle: isLight ? '#0f172a' : '#e2e8f0',
    tooltipBody: isLight ? '#475569' : '#94a3b8',
    legendColor: isLight ? '#475569' : '#94a3b8',
  };
}

// ---- Grafik Timeline 24 Jam per Device ----
export function renderTimeline24h(canvasId, data) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const theme = getChartColors();
  const labels = data.map((d) => d.jam || d.hour);

  const values = data.map((d) => {
    if (d.status === 'online') return d.responseTime || 2;
    if (d.status === 'maintenance') return 1;
    if (d.status === 'offline') return 0;
    return null;
  });

  const pointBgColors = data.map((d) => {
    if (d.status === 'online') return '#10b981';
    if (d.status === 'maintenance') return '#f59e0b';
    if (d.status === 'offline') return '#ef4444';
    return 'rgba(148, 163, 184, 0.4)';
  });

  const pointBorderColors = data.map((d) => {
    if (d.status === 'offline') return '#fee2e2';
    if (d.status === 'maintenance') return '#fef3c7';
    return '#ecfdf5';
  });

  const pointRadii = data.map((d) => {
    if (d.status === 'offline') return 6;
    if (d.status === 'maintenance') return 5;
    if (d.status === 'online') return 3.5;
    return 2;
  });

  const pointHoverRadii = data.map((d) => {
    if (d.status === 'offline') return 8;
    if (d.status === 'maintenance') return 7;
    return 6;
  });

  // Dynamic cyber gradient fill
  const areaGradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 260);
  areaGradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
  areaGradient.addColorStop(0.65, 'rgba(16, 185, 129, 0.08)');
  areaGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Latency (ms)',
          data: values,
          borderColor: '#10b981',
          borderWidth: 2.5,
          tension: 0.36,
          fill: true,
          backgroundColor: areaGradient,
          pointBackgroundColor: pointBgColors,
          pointBorderColor: pointBorderColors,
          pointBorderWidth: 1.5,
          pointRadius: pointRadii,
          pointHoverRadius: pointHoverRadii,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 10,
          titleFont: { weight: 'bold', size: 12 },
          bodyFont: { size: 11 },
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
          callbacks: {
            title: (items) => {
              if (items.length > 0) {
                return `🕒 Jam ${items[0].label} WIB`;
              }
              return '';
            },
            label: (ctx) => {
              const d = data[ctx.dataIndex];
              if (!d || d.status === 'nodata' || !d.status) {
                return '⚪ Belum Terdaftar (Tidak Ada Data)';
              }
              if (d.status === 'online') {
                const rt = d.responseTime || 1;
                const jitterRating = rt <= 10 ? '⚡ Respons Sangat Cepat' : (rt <= 50 ? '📶 Normal' : '⚠️ Latensi Tinggi');
                return [`🟢 Online - Latensi: ${rt} ms`, `📊 Kualitas: ${jitterRating}`];
              }
              if (d.status === 'maintenance') {
                return '🟡 Perangkat Sedang Maintenance';
              }
              return '🔴 Terputus / Offline (RTO / Tidak Merespons)';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: theme.gridColor, borderDash: [4, 4] },
          ticks: { color: theme.tickColor, font: { size: 10 } },
        },
        y: {
          grid: { color: theme.gridColor, borderDash: [4, 4] },
          ticks: {
            color: theme.tickColor,
            font: { size: 10 },
            callback: (v) => `${v}ms`,
          },
          beginAtZero: true,
          suggestedMax: 10,
          title: {
            display: true,
            text: 'Latency (ms)',
            color: theme.tickColor,
            font: { size: 10, weight: 'bold' },
          },
        },
      },
    },
  });
}

// ---- Grafik Agregat Timeline Global 24 Jam ----
export function renderAggregateTimeline(canvasId, timelineData, onBarClick = null) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const theme = getChartColors();
  const labels = timelineData.map((d) => d.hour || d.jam);
  const onlineCounts = timelineData.map((d) => d.online ?? d.uptimePct ?? 0);
  const offlineCounts = timelineData.map((d) => d.offline ?? 0);
  const maintenanceCounts = timelineData.map((d) => d.maintenance ?? 0);

  // Modern vertical gradients for stacked bars
  const chartHeight = canvas.height || 250;
  const gradOnline = ctx.createLinearGradient(0, 0, 0, chartHeight);
  gradOnline.addColorStop(0, 'rgba(16, 185, 129, 0.95)');
  gradOnline.addColorStop(1, 'rgba(5, 150, 105, 0.7)');

  const gradMaint = ctx.createLinearGradient(0, 0, 0, chartHeight);
  gradMaint.addColorStop(0, 'rgba(245, 158, 11, 0.95)');
  gradMaint.addColorStop(1, 'rgba(217, 119, 6, 0.7)');

  const gradOffline = ctx.createLinearGradient(0, 0, 0, chartHeight);
  gradOffline.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
  gradOffline.addColorStop(1, 'rgba(185, 28, 28, 0.7)');

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Device Online',
          data: onlineCounts,
          backgroundColor: gradOnline,
          borderRadius: 6,
          borderSkipped: false,
          stack: 'stack0',
          barPercentage: 0.65,
          categoryPercentage: 0.78,
        },
        {
          label: 'Device Maintenance',
          data: maintenanceCounts,
          backgroundColor: gradMaint,
          borderRadius: 6,
          borderSkipped: false,
          stack: 'stack0',
          barPercentage: 0.65,
          categoryPercentage: 0.78,
        },
        {
          label: 'Device Offline',
          data: offlineCounts,
          backgroundColor: gradOffline,
          borderRadius: 6,
          borderSkipped: false,
          stack: 'stack0',
          barPercentage: 0.65,
          categoryPercentage: 0.78,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        if (elements && elements.length > 0 && typeof onBarClick === 'function') {
          const index = elements[0].index;
          const item = timelineData[index];
          onBarClick(item, index);
        }
      },
      onHover: (event, elements) => {
        const target = event.native ? event.native.target : (event.chart ? event.chart.canvas : null);
        if (target) {
          target.style.cursor = elements && elements.length > 0 ? 'pointer' : 'default';
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: theme.legendColor,
            font: { size: 11, weight: '600' },
            usePointStyle: true,
            pointStyle: 'rectRounded',
            padding: 14,
          },
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 10,
          titleFont: { weight: 'bold', size: 12 },
          bodyFont: { size: 11 },
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
          callbacks: {
            title: (items) => {
              if (items.length > 0) {
                return `🕒 Pukul ${items[0].label} WIB`;
              }
              return '';
            },
            afterBody: (items) => {
              if (items.length > 0) {
                const idx = items[0].dataIndex;
                const d = timelineData[idx];
                const on = d.online ?? 0;
                const off = d.offline ?? 0;
                const mnt = d.maintenance ?? 0;
                const tot = on + off + mnt;
                const pct = tot > 0 ? ((on / tot) * 100).toFixed(1) : '100.0';
                const nodataMsg = d?.nodata > 0 ? `\n⚪ Belum Terdaftar: ${d.nodata}` : '';
                return `\nTotal Terpantau: ${tot} Perangkat${nodataMsg}\nKesehatan Jaringan: ${pct}% Online\n👉 Klik bar untuk rincian perangkat`;
              }
              return '';
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: theme.tickColor, font: { size: 10 } },
        },
        y: {
          stacked: true,
          grid: { color: theme.gridColor, borderDash: [4, 4] },
          ticks: { color: theme.tickColor, font: { size: 10 }, stepSize: 1 },
          beginAtZero: true,
          title: { display: true, text: 'Jumlah Perangkat', color: theme.tickColor, font: { size: 10, weight: 'bold' } },
        },
      },
    },
  });
}

// ---- Uptime bar horizontal ----
export function renderUptimeBar(canvasId, devices, field = 'uptime24h') {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const theme = getChartColors();
  const sorted = [...devices].sort((a, b) => a[field] - b[field]).slice(0, 10);
  const labels = sorted.map((d) => d.nama.length > 20 ? d.nama.substring(0, 20) + '…' : d.nama);
  const values = sorted.map((d) => d[field]);
  const colors = values.map((v) => v >= 99 ? 'rgba(34,197,94,0.75)' : v >= 95 ? 'rgba(234,179,8,0.75)' : 'rgba(239,68,68,0.75)');

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Uptime %',
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
          callbacks: {
            label: (ctx) => `Uptime: ${ctx.raw.toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          min: 80,
          max: 100,
          grid: { color: theme.gridColor },
          ticks: { color: theme.tickColor, font: { size: 10 }, callback: (v) => v + '%' },
        },
        y: {
          grid: { display: false },
          ticks: { color: theme.tickColor, font: { size: 10 } },
        },
      },
    },
  });
}

// ---- Weekly trend line ----
export function renderWeeklyTrend(canvasId, weeklyData) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const theme = getChartColors();
  chartInstances[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels: weeklyData.map((d) => d.hari),
      datasets: [
        {
          label: 'Rata-rata Uptime (%)',
          data: weeklyData.map((d) => d.avgUptime),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
          callbacks: {
            label: (ctx) => `Uptime: ${ctx.raw.toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.tickColor, font: { size: 10 } },
        },
        y: {
          min: 90,
          max: 100,
          grid: { color: theme.gridColor },
          ticks: { color: theme.tickColor, font: { size: 10 }, callback: (v) => v + '%' },
        },
      },
    },
  });
}

// ---- Incident bar chart ----
export function renderIncidentBar(canvasId, weeklyData) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const theme = getChartColors();
  chartInstances[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weeklyData.map((d) => d.hari),
      datasets: [{
        label: 'Jumlah Insiden',
        data: weeklyData.map((d) => d.insiden),
        backgroundColor: 'rgba(239,68,68,0.6)',
        borderColor: 'rgba(239,68,68,0.8)',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          titleColor: theme.tooltipTitle,
          bodyColor: theme.tooltipBody,
        },
      },
      scales: {
        x: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.tickColor, font: { size: 10 } },
        },
        y: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.tickColor, font: { size: 10 }, stepSize: 1 },
          beginAtZero: true,
        },
      },
    },
  });
}

export function destroyAllCharts() {
  Object.keys(chartInstances).forEach(destroyChart);
}

// Update semua grafik yang aktif secara real-time saat tema beralih
if (typeof window !== 'undefined') {
  window.addEventListener('devwatch:theme_changed', () => {
    const theme = getChartColors();
    Object.values(chartInstances).forEach((chart) => {
      if (!chart || !chart.options) return;
      if (chart.options.scales?.x?.grid) chart.options.scales.x.grid.color = theme.gridColor;
      if (chart.options.scales?.y?.grid) chart.options.scales.y.grid.color = theme.gridColor;
      if (chart.options.scales?.x?.ticks) chart.options.scales.x.ticks.color = theme.tickColor;
      if (chart.options.scales?.y?.ticks) chart.options.scales.y.ticks.color = theme.tickColor;
      if (chart.options.plugins?.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
        chart.options.plugins.tooltip.borderColor = theme.tooltipBorder;
        chart.options.plugins.tooltip.titleColor = theme.tooltipTitle;
        chart.options.plugins.tooltip.bodyColor = theme.tooltipBody;
      }
      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = theme.legendColor;
      }
      chart.update();
    });
  });
}
