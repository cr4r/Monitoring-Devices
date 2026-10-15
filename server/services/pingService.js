// ================================================================
// DevWatch — pingService.js
// Engine ICMP Ping berbasis utilitas sistem operasi asli (Windows / Linux)
// ================================================================

import { execFile } from 'child_process';
import os from 'os';
import { config } from '../config.js';

const isWindows = os.platform() === 'win32';

/**
 * Melakukan ICMP ping ke IP/Host target secara riil
 * @param {string} host - IP address atau hostname
 * @param {number} timeoutMs - Batas waktu timeout dalam milidetik
 * @returns {Promise<{ alive: boolean, time: number, statusText: string }>}
 */
export function pingHost(host, timeoutMs = config.pingTimeoutMs) {
  return new Promise((resolve) => {
    // Validasi format host sederhana untuk mencegah command injection
    if (!host || typeof host !== 'string' || !/^[a-zA-Z0-9.-]+$/.test(host.trim())) {
      return resolve({
        alive: false,
        time: 0,
        statusText: 'Format alamat IP atau hostname tidak valid',
      });
    }

    const cleanHost = host.trim();
    const cmd = isWindows ? 'ping' : 'ping';
    const args = isWindows
      ? ['-n', '1', '-w', timeoutMs.toString(), cleanHost]
      : ['-c', '1', '-W', Math.ceil(timeoutMs / 1000).toString(), cleanHost];

    const startTime = Date.now();

    execFile(cmd, args, { timeout: timeoutMs + 1000 }, (error, stdout, stderr) => {
      const duration = Date.now() - startTime;
      const output = (stdout || '') + (stderr || '');

      if (error) {
        // Ping gagal atau timeout
        return resolve({
          alive: false,
          time: 0,
          statusText: parseFailureReason(output),
        });
      }

      // Analisis output ping
      const parseResult = parsePingOutput(output, duration);
      resolve(parseResult);
    });
  });
}

function parsePingOutput(output, fallbackDuration) {
  // Windows: "Reply from 192.168.1.1: bytes=32 time=4ms TTL=64" atau "time<1ms"
  if (output.includes('TTL=') || output.includes('ttl=')) {
    const timeMatch = output.match(/time[<=]([0-9]+)ms/i);
    let time = 1;
    if (timeMatch && timeMatch[1]) {
      time = parseInt(timeMatch[1], 10);
    } else {
      time = Math.max(1, Math.min(fallbackDuration, 50));
    }
    return {
      alive: true,
      time: Math.max(1, time),
      statusText: `${time} ms`,
    };
  }

  // Jika paket hilang / timeout
  return {
    alive: false,
    time: 0,
    statusText: parseFailureReason(output),
  };
}

function parseFailureReason(output) {
  if (/Destination host unreachable/i.test(output)) {
    return 'Host Tidak Terjangkau (Unreachable)';
  }
  if (/Request timed out/i.test(output) || /100% packet loss/i.test(output)) {
    return 'Permintaan Habis Waktu (Timeout)';
  }
  if (/could not find host/i.test(output)) {
    return 'Hostname Tidak Ditemukan (DNS Error)';
  }
  return 'Koneksi Terputus';
}
