// ================================================================
// DevWatch — hikvisionService.js
// Pengecekan koneksi CCTV & Perangkat Jaringan via:
// 1. ISAPI Hikvision (REST + XML metadata)
// 2. RTSP Stream Handshake (Protokol RTSP OPTIONS)
// 3. ONVIF Device Service (SOAP XML probe)
// 4. ICMP Ping standar
// ================================================================

import net from 'net';
import { pingHost } from './pingService.js';
import { config } from '../config.js';

/**
 * Uji port TCP generik
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
 * Pengecekan Stream RTSP dengan jabat tangan protokol OPTIONS RTSP/1.0
 */
export function checkRtspStream(host, port = 554, timeoutMs = config.pingTimeoutMs) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let receivedData = '';
    let resolved = false;

    const doResolve = (result) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(result);
      }
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      // Kirim jabat tangan OPTIONS standar RTSP
      const rtspCmd =
        `OPTIONS rtsp://${host}:${port}/Streaming/Channels/101 RTSP/1.0\r\n` +
        `CSeq: 1\r\n` +
        `User-Agent: MonDev-StreamMonitor/1.0\r\n` +
        `\r\n`;
      socket.write(rtspCmd);

      // Jika TCP berhasil terhubung, device sudah pasti online meskipun tidak ada data RTSP
      // Tunggu data dulu — jika tidak ada data dalam 1.5 detik, resolve sebagai online (port open)
      setTimeout(() => {
        if (!resolved) {
          const duration = Date.now() - startTime;
          doResolve({
            alive: true,
            time: Math.max(1, duration),
            statusText: `${duration} ms (RTSP Port Open)`,
            protocol: 'TCP/554',
          });
        }
      }, Math.min(1500, timeoutMs - 200));
    });

    socket.on('data', (chunk) => {
      receivedData += chunk.toString();
      // Respons valid: format RTSP, HTTP, atau data apapun dari port 554
      // Beberapa kamera merespons dengan HTTP 401, 200, atau format proprietary
      const hasValidResponse =
        receivedData.includes('RTSP/1.0') ||
        receivedData.includes('CSeq') ||
        receivedData.includes('200 OK') ||
        receivedData.includes('401') ||
        receivedData.includes('Public:') ||
        receivedData.includes('Server:') ||
        receivedData.length > 0;

      if (hasValidResponse) {
        const duration = Date.now() - startTime;
        doResolve({
          alive: true,
          time: Math.max(1, duration),
          statusText: `${duration} ms (RTSP Stream Aktif)`,
          protocol: 'RTSP/1.0',
        });
      }
    });

    socket.on('timeout', () => {
      doResolve({
        alive: false,
        time: 0,
        statusText: `RTSP Timeout (Port ${port})`,
      });
    });

    socket.on('error', (err) => {
      doResolve({
        alive: false,
        time: 0,
        statusText: `RTSP Error: ${err.code || 'Connection Refused'}`,
      });
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      doResolve({
        alive: false,
        time: 0,
        statusText: err.message,
      });
    }
  });
}

/**
 * Pengecekan ISAPI Hikvision: probe endpoint deviceInfo dan parse metadata XML
 */
export async function checkIsapiDevice(device, timeoutMs = config.pingTimeoutMs) {
  const host = device.ip;
  const port = device.port || 80;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {};
    if (device.username && device.password_encrypted) {
      const authStr = Buffer.from(`${device.username}:${device.password_encrypted}`).toString('base64');
      headers['Authorization'] = `Basic ${authStr}`;
    }

    const res = await fetch(`http://${host}:${port}/ISAPI/System/deviceInfo`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timer);

    if (res && (res.status === 200 || res.status === 401)) {
      const duration = Date.now() - startTime;
      let metadata = null;

      if (res.status === 200) {
        const xmlText = await res.text().catch(() => '');
        metadata = extractIsapiXmlMetadata(xmlText);
      }

      return {
        alive: true,
        time: Math.max(1, duration),
        statusText: `${duration} ms (ISAPI Aktif)`,
        metadata,
      };
    }
  } catch {
    // Tangani error jaringan
  }

  // Fallback ke port TCP 80/8000 jika HTTP gagal
  const tcpCheck = await checkTcpPort(host, port, Math.min(1000, timeoutMs));
  if (tcpCheck.alive) {
    return {
      alive: true,
      time: tcpCheck.time,
      statusText: `${tcpCheck.time} ms (ISAPI Port Open)`,
    };
  }

  // Fallback terakhir ke ICMP ping
  return await pingHost(host, timeoutMs);
}

/**
 * Ekstraksi tag XML dasar dari respons ISAPI deviceInfo
 */
function extractIsapiXmlMetadata(xml) {
  if (!xml) return null;
  const getTag = (tag) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
    return m ? m[1].trim() : null;
  };

  return {
    deviceName: getTag('deviceName') || getTag('deviceDescription'),
    model: getTag('model'),
    serialNumber: getTag('serialNumber'),
    macAddress: getTag('macAddress'),
    firmwareVersion: getTag('firmwareVersion') || getTag('encoderVersion'),
  };
}

/**
 * Pengecekan ONVIF Device Service via SOAP probe
 */
export async function checkOnvifDevice(device, timeoutMs = config.pingTimeoutMs) {
  const host = device.ip;
  const port = device.port || 80;
  const startTime = Date.now();

  // SOAP envelope standar GetSystemDateAndTime untuk probe ONVIF
  const soapBody =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">` +
    `<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">` +
    `<GetSystemDateAndTime xmlns="http://www.onvif.org/ver10/device/wsdl"/>` +
    `</s:Body></s:Envelope>`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`http://${host}:${port}/onvif/device_service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver10/device/wsdl/GetSystemDateAndTime"',
      },
      body: soapBody,
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timer);

    if (res && (res.status === 200 || res.status === 401 || res.status === 500)) {
      // Status 200, 401 (Auth Challenge), atau 500 (SOAP Fault) menandakan endpoint SOAP ONVIF aktif
      const duration = Date.now() - startTime;
      return {
        alive: true,
        time: Math.max(1, duration),
        statusText: `${duration} ms (ONVIF Aktif)`,
      };
    }
  } catch {
    // Error HTTP
  }

  // Fallback ke TCP port ONVIF (80, 8080, 8000)
  for (const testPort of [port, 8080, 8000]) {
    const tcpCheck = await checkTcpPort(host, testPort, Math.min(800, timeoutMs));
    if (tcpCheck.alive) {
      return {
        alive: true,
        time: tcpCheck.time,
        statusText: `${tcpCheck.time} ms (ONVIF Port Open)`,
      };
    }
  }

  // Fallback terakhir ke ICMP ping
  return await pingHost(host, timeoutMs);
}

/**
 * Pengecekan menyeluruh terhadap perangkat sesuai metode yang dikonfigurasikan
 */
export async function probeDevice(device, timeoutMs = config.pingTimeoutMs) {
  const metode = (device.metode || 'PING').toUpperCase();
  const host = device.ip;

  if (metode === 'RTSP') {
    const port = device.port || 554;
    const rtspRes = await checkRtspStream(host, port, timeoutMs);
    if (rtspRes.alive) return rtspRes;
    // Fallback ke ICMP jika stream ditolak tapi IP hidup
    const pingRes = await pingHost(host, timeoutMs);
    if (pingRes.alive) {
      return {
        alive: true,
        time: pingRes.time,
        statusText: `${pingRes.time} ms (ICMP - RTSP stream tertutup)`,
      };
    }
    return rtspRes;
  }

  if (metode === 'ISAPI') {
    return await checkIsapiDevice(device, timeoutMs);
  }

  if (metode === 'ONVIF') {
    return await checkOnvifDevice(device, timeoutMs);
  }

  // Standar: ICMP Ping
  return await pingHost(host, timeoutMs);
}

/**
 * Ambil informasi detail ISAPI untuk perangkat tertentu
 */
export async function getIsapiDeviceInfo(device) {
  const host = device.ip;
  const port = device.port || 80;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const headers = {};
    if (device.username && device.password_encrypted) {
      const authStr = Buffer.from(`${device.username}:${device.password_encrypted}`).toString('base64');
      headers['Authorization'] = `Basic ${authStr}`;
    }

    const res = await fetch(`http://${host}:${port}/ISAPI/System/deviceInfo`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timer);

    if (res && res.status === 200) {
      const text = await res.text();
      return {
        supported: true,
        authenticated: true,
        metadata: extractIsapiXmlMetadata(text),
      };
    } else if (res && res.status === 401) {
      return {
        supported: true,
        authenticated: false,
        message: 'Endpoint ISAPI merespons (Memerlukan Kredensial Pengguna)',
        metadata: {
          model: 'Hikvision IP Camera (Protected)',
          firmwareVersion: 'ISAPI v2.0+',
        },
      };
    }
  } catch (err) {
    // Tangani error
  }

  return {
    supported: false,
    message: 'Endpoint ISAPI tidak merespons pada perangkat ini.',
  };
}
