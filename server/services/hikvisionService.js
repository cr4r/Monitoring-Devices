// ================================================================
// DevWatch — hikvisionService.js
// Pengecekan koneksi CCTV Hikvision via ISAPI, RTSP TCP, dan ICMP
// ================================================================

import net from 'net';
import { pingHost } from './pingService.js';
import { config } from '../config.js';

/**
 * Uji port TCP (misal port 554 RTSP atau port 80/8000 ISAPI)
 */
export function checkTcpPort(host, port, timeoutMs = config.pingTimeoutMs) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const duration = Date.now() - startTime;
      socket.destroy();
      resolve({
        alive: true,
        time: Math.max(1, duration),
        statusText: `${duration} ms`,
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        alive: false,
        time: 0,
        statusText: `Port ${port} Timeout`,
      });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({
        alive: false,
        time: 0,
        statusText: `Port ${port} ${err.code || 'Refused'}`,
      });
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      resolve({
        alive: false,
        time: 0,
        statusText: err.message,
      });
    }
  });
}

/**
 * Pengecekan menyeluruh terhadap perangkat sesuai metode yang dikonfigurasikan
 */
export async function probeDevice(device, timeoutMs = config.pingTimeoutMs) {
  const metode = (device.metode || 'PING').toUpperCase();
  const host = device.ip;

  if (metode === 'RTSP') {
    const port = device.port || 554;
    const tcpRes = await checkTcpPort(host, port, timeoutMs);
    if (tcpRes.alive) return tcpRes;
    // Fallback ke ICMP jika port tertutup tapi host hidup
    return await pingHost(host, timeoutMs);
  }

  if (metode === 'ISAPI') {
    const port = device.port || 80;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const startTime = Date.now();
      const res = await fetch(`http://${host}:${port}/ISAPI/System/deviceInfo`, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timer);

      if (res && (res.status === 200 || res.status === 401)) {
        // 401 Unauthorized berarti endpoint ISAPI aktif merespons challenge
        const duration = Date.now() - startTime;
        return {
          alive: true,
          time: Math.max(1, duration),
          statusText: `${duration} ms (ISAPI)`,
        };
      }
    } catch {
      // Abaikan, fallback ke ping
    }
    return await pingHost(host, timeoutMs);
  }

  // Standar: ICMP Ping
  return await pingHost(host, timeoutMs);
}
