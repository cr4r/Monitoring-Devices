// ================================================================
// DevWatch — charts.js
// Chart.js wrappers: timeline 24h, uptime bar, weekly trend
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

// ---- Timeline 24 jam ----
export function renderTimeline24h(canvasId, data) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = data.map((d) => d.jam);
  const values = data.map((d) => (d.status === 'online' ? (d.responseTime || 10) : 0));
  const colors = data.map((d) => (d.status === 'online' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.7)'));

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Response Time (ms)',
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1d2e',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          callbacks: {
            label: (ctx) => {
              const d = data[ctx.dataIndex];
              return d.status === 'online' ? `Online — ${d.responseTime} ms` : 'Offline';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 } },
          beginAtZero: true,
          title: {
            display: true,
            text: 'ms',
            color: '#64748b',
            font: { size: 10 },
          },
        },
      },
    },
  });
}

// ---- Grafik Agregat Timeline Global 24 Jam ----
export function renderAggregateTimeline(canvasId, timelineData) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = timelineData.map((d) => d.hour || d.jam);
  const onlineCounts = timelineData.map((d) => d.online ?? d.uptimePct ?? 0);
  const offlineCounts = timelineData.map((d) => d.offline ?? 0);

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Device Online',
          data: onlineCounts,
          backgroundColor: 'rgba(34, 197, 94, 0.85)',
          borderRadius: 4,
          stack: 'stack0',
        },
        {
          label: 'Device Offline',
          data: offlineCounts,
          backgroundColor: 'rgba(239, 68, 68, 0.85)',
          borderRadius: 4,
          stack: 'stack0',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#94a3b8', font: { size: 10 } },
        },
        tooltip: {
          backgroundColor: '#1a1d2e',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 } },
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 }, stepSize: 1 },
          beginAtZero: true,
          title: { display: true, text: 'Jumlah Perangkat', color: '#64748b', font: { size: 10 } },
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
          backgroundColor: '#1a1d2e',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          callbacks: {
            label: (ctx) => `Uptime: ${ctx.raw.toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          min: 80,
          max: 100,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => v + '%' },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 10 } },
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
          backgroundColor: '#1a1d2e',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          callbacks: {
            label: (ctx) => `Uptime: ${ctx.raw.toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 } },
        },
        y: {
          min: 90,
          max: 100,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => v + '%' },
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
          backgroundColor: '#1a1d2e',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 }, stepSize: 1 },
          beginAtZero: true,
        },
      },
    },
  });
}

export function destroyAllCharts() {
  Object.keys(chartInstances).forEach(destroyChart);
}
