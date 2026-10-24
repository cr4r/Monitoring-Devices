// ================================================================
// DevWatch - reportService.js
// Penghitungan metrik SLA, agregasi uptime mingguan, rekap insiden,
// dan penyimpanan otomatis snapshot laporan mingguan ke basis data SQLite
// ================================================================

import { query, queryOne, run } from '../database/db.js';

/**
 * Dapatkan rentang tanggal awal dan akhir pekan berjalan (Senin s/d Minggu)
 */
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  // Hitung selisih hari ke hari Senin (hari 1)
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Nomor minggu ISO
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);

  return {
    monday,
    sunday,
    weekNum: `W${String(weekNum).padStart(2, '0')}`,
    year: monday.getFullYear(),
    label: `Pekan ${weekNum} (${monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`,
  };
}

/**
 * Hitung Uptime riil per perangkat berdasarkan insiden gangguan
 */
export function getSlaReport() {
  const devices = query('SELECT * FROM devices WHERE is_active = 1');
  const now = Date.now();

  // Ambil seluruh insiden 30 hari terakhir
  const incidents = query(`
    SELECT device_id, waktu_mulai, waktu_selesai, durasi_menit, status
    FROM incidents
    WHERE waktu_mulai >= datetime('now', '-30 days')
  `);

  return devices.map((d) => {
    const devIncidents = incidents.filter((i) => i.device_id === d.id);

    const calcDowntime = (days) => {
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      let totalMins = 0;

      for (const inc of devIncidents) {
        const start = new Date(inc.waktu_mulai).getTime();
        if (start < cutoff) continue;

        if (inc.status === 'selesai' && inc.durasi_menit) {
          totalMins += inc.durasi_menit;
        } else if (inc.status === 'terbuka') {
          // Insiden masih berjalan
          const activeMins = Math.max(1, Math.round((now - start) / 60000));
          totalMins += activeMins;
        }
      }
      return totalMins;
    };

    const downtime24h = calcDowntime(1);
    const downtime7d = calcDowntime(7);
    const downtime30d = calcDowntime(30);

    // Total menit kapasitas monitoring
    const cap24h = 24 * 60; // 1440
    const cap7d = 7 * 24 * 60; // 10080
    const cap30d = 30 * 24 * 60; // 43200

    // Hitung Uptime % sesuai formula PRD: (Waktu Online / Total Waktu Monitoring) * 100
    // Maintenance tidak dihitung sebagai downtime
    const uptime24h = Math.max(0, Math.min(100, ((cap24h - downtime24h) / cap24h) * 100));
    const uptime7d = Math.max(0, Math.min(100, ((cap7d - downtime7d) / cap7d) * 100));
    const uptime30d = Math.max(0, Math.min(100, ((cap30d - downtime30d) / cap30d) * 100));

    const targetSla = d.target_sla || 99.0;

    return {
      id: d.id,
      nama: d.nama,
      ip: d.ip,
      grup: d.grup,
      lokasi: d.lokasi,
      jenis: d.jenis,
      status: d.status,
      targetSla,
      uptime24h: +uptime24h.toFixed(1),
      uptime7d: +uptime7d.toFixed(1),
      uptime30d: +uptime30d.toFixed(1),
      downtimeMinutes30d: downtime30d,
      isCompliant: uptime30d >= targetSla,
    };
  });
}

/**
 * Ambil atau hasilkan ringkasan Laporan Mingguan saat ini
 */
export function getWeeklyReport(reportId = null) {
  if (reportId) {
    const row = queryOne('SELECT * FROM weekly_reports WHERE id = ?', [reportId]);
    if (row && row.summary_json) {
      try {
        return JSON.parse(row.summary_json);
      } catch (err) {
        console.error('Gagal parse summary_json:', err);
      }
    }
  }

  const devices = query('SELECT * FROM devices WHERE is_active = 1');
  const total = devices.length;
  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const avgSla = devices.reduce((acc, d) => acc + (d.target_sla || 99), 0) / (total || 1);

  const incidents = query(`
    SELECT i.*, d.nama as device_nama, d.ip as device_ip
    FROM incidents i
    JOIN devices d ON i.device_id = d.id
    WHERE i.waktu_mulai >= datetime('now', '-7 days')
    ORDER BY i.waktu_mulai DESC
  `);

  const totalDowntimeMinutes = incidents.reduce((acc, i) => acc + (i.durasi_menit || 0), 0);
  const totalCapacityMinutes = 7 * 24 * 60 * (total || 1);
  const actualUptimePct = Math.max(0, Math.min(100, ((totalCapacityMinutes - totalDowntimeMinutes) / totalCapacityMinutes) * 100));

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const dailyTrends = days.map((day, idx) => {
    // (getDay() + 6) % 7: Senin=0, Selasa=1, ..., Minggu=6
    const dayIncidents = incidents.filter((inc) => {
      if (!inc.waktu_mulai) return false;
      const d = new Date(inc.waktu_mulai);
      const incDayIndex = (d.getDay() + 6) % 7;
      return incDayIndex === idx;
    }).length;

    return {
      hari: day,
      uptimePct: +Math.min(100, Math.max(0, actualUptimePct - (dayIncidents > 0 ? 0.4 * dayIncidents : 0))).toFixed(1),
      insidenCount: dayIncidents,
    };
  });

  const devStats = devices.map((d) => {
    const devInc = incidents.filter((i) => i.device_id === d.id);
    const devDown = devInc.reduce((acc, i) => acc + (i.durasi_menit || 0), 0);
    const devCap = 7 * 24 * 60;
    const uptime = +Math.max(0, Math.min(100, ((devCap - devDown) / devCap) * 100)).toFixed(1);
    const target = d.target_sla || 99.0;
    return {
      id: d.id,
      nama: d.nama,
      ip: d.ip,
      grup: d.grup,
      sla: target,
      uptime,
      status: d.status,
      incidentsCount: devInc.length,
      isCompliant: uptime >= target,
    };
  });

  const sortedBest = [...devStats].sort((a, b) => b.uptime - a.uptime);
  const sortedWorst = [...devStats].sort((a, b) => a.uptime - b.uptime);

  const compliantCount = devStats.filter((d) => d.isCompliant).length;
  const slaCompliancePct = total > 0 ? +((compliantCount / total) * 100).toFixed(1) : 100.0;

  const groups = [...new Set(devices.map((d) => d.grup).filter(Boolean))];
  const groupBreakdown = groups.map((g) => {
    const gDevs = devStats.filter((d) => d.grup === g);
    const avgUptime = gDevs.reduce((acc, d) => acc + d.uptime, 0) / (gDevs.length || 1);
    return {
      grup: g,
      total: gDevs.length,
      averageUptime: +avgUptime.toFixed(1),
    };
  });

  const weekInfo = getWeekRange();

  const reportData = {
    periode: weekInfo.label,
    mingguKe: weekInfo.weekNum,
    tahun: weekInfo.year,
    mulai: weekInfo.monday.toISOString(),
    selesai: weekInfo.sunday.toISOString(),
    totalDevices: total,
    onlineDevices: onlineCount,
    averageUptime: +actualUptimePct.toFixed(1),
    targetSla: +avgSla.toFixed(1),
    totalIncidents: incidents.length,
    totalDowntimeHours: +(totalDowntimeMinutes / 60).toFixed(1),
    dailyTrends,
    slaCompliancePct,
    groupBreakdown,
    topDevices: sortedBest.slice(0, 5),
    worstDevices: sortedWorst.slice(0, 5),
  };

  return reportData;
}

/**
 * Menyimpan snapshot otomatis laporan mingguan ke tabel weekly_reports
 */
export function saveWeeklySnapshot() {
  const reportData = getWeeklyReport();
  const weekInfo = getWeekRange();

  const existing = queryOne(
    `SELECT id FROM weekly_reports WHERE minggu_ke = ? AND tahun = ?`,
    [weekInfo.weekNum, weekInfo.year]
  );

  const jsonStr = JSON.stringify(reportData);

  if (existing) {
    run(
      `UPDATE weekly_reports
       SET total_devices = ?,
           online_devices = ?,
           average_uptime = ?,
           target_sla = ?,
           total_incidents = ?,
           total_downtime_hours = ?,
           summary_json = ?
       WHERE id = ?`,
      [
        reportData.totalDevices,
        reportData.onlineDevices,
        reportData.averageUptime,
        reportData.targetSla,
        reportData.totalIncidents,
        reportData.totalDowntimeHours,
        jsonStr,
        existing.id,
      ]
    );
    return { id: existing.id, updated: true, report: reportData };
  } else {
    const res = run(
      `INSERT INTO weekly_reports (
        minggu_ke, tahun, periode_label, periode_mulai, periode_selesai,
        total_devices, online_devices, average_uptime, target_sla,
        total_incidents, total_downtime_hours, summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        weekInfo.weekNum,
        weekInfo.year,
        weekInfo.label,
        weekInfo.monday.toISOString(),
        weekInfo.sunday.toISOString(),
        reportData.totalDevices,
        reportData.onlineDevices,
        reportData.averageUptime,
        reportData.targetSla,
        reportData.totalIncidents,
        reportData.totalDowntimeHours,
        jsonStr,
      ]
    );
    return { id: res.lastInsertRowid, created: true, report: reportData };
  }
}

/**
 * Ambil daftar arsip laporan mingguan
 */
export function getWeeklyArchives() {
  return query(`
    SELECT id, minggu_ke, tahun, periode_label, periode_mulai, periode_selesai,
           total_devices, online_devices, average_uptime, target_sla,
           total_incidents, total_downtime_hours, created_at
    FROM weekly_reports
    ORDER BY id DESC
  `);
}

/**
 * Laporan seluruh insiden
 */
export function getIncidentReport() {
  return query(`
    SELECT i.*, d.nama as device_nama, d.ip as device_ip, d.grup, d.lokasi
    FROM incidents i
    JOIN devices d ON i.device_id = d.id
    ORDER BY i.waktu_mulai DESC
    LIMIT 100
  `);
}
