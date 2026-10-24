// ================================================================
// DevWatch - hikvisionService.js
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
 * Parse RTSP URL lengkap menjadi komponen {host, port, username, password, path}
 * Mendukung format: rtsp://user:pass@host:port/path
 * Juga mendukung IP biasa (tanpa scheme)
 */
function safeDecode(val) {
  if (!val) return val;
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

export function parseRtspUrl(ipOrUrl) {
  const str = String(ipOrUrl || '').trim();
  if (!str) {
    return {
      host: '',
      port: 554,
      username: null,
      password: null,
      path: '/',
      normalizedUrl: '',
      sanitizedUrl: '',
    };
  }

  // Jika bukan URL (tidak ada :// dan tidak ada @)
  if (!str.includes('://') && !str.includes('@')) {
    let cleanHost = str;
    let port = 554;
    if (str.includes(':')) {
      const parts = str.split(':');
      cleanHost = parts[0];
      port = parseInt(parts[1], 10) || 554;
    }
    cleanHost = cleanHost.replace(/[^\w.-]/g, '');
    return {
      host: cleanHost,
      port,
      username: null,
      password: null,
      path: '/',
      normalizedUrl: `rtsp://${cleanHost}:${port}/`,
      sanitizedUrl: `rtsp://${cleanHost}:${port}/`,
    };
  }

  // Pisahkan scheme
  let rest = str;
  const schemeMatch = str.match(/^([a-zA-Z0-9+-.]+):\/\/(.*)$/);
  if (schemeMatch) {
    rest = schemeMatch[2];
  }

  // Pisahkan path dan query dari authority
  let path = '/';
  const slashIdx = rest.indexOf('/');
  const questionIdx = rest.indexOf('?');
  let splitIdx = -1;
  if (slashIdx !== -1 && questionIdx !== -1) {
    splitIdx = Math.min(slashIdx, questionIdx);
  } else if (slashIdx !== -1) {
    splitIdx = slashIdx;
  } else if (questionIdx !== -1) {
    splitIdx = questionIdx;
  }

  let authority = rest;
  if (splitIdx !== -1) {
    authority = rest.slice(0, splitIdx);
    path = rest.slice(splitIdx);
  }

  // Pisahkan credentials dan hostPort dengan mencari '@' TERAKHIR
  // (menghindari kesalahan jika password pengguna mengandung simbol '@' atau '&')
  let username = null;
  let password = null;
  let hostPort = authority;

  const lastAt = authority.lastIndexOf('@');
  if (lastAt !== -1) {
    const credPart = authority.slice(0, lastAt);
    hostPort = authority.slice(lastAt + 1);

    const firstColon = credPart.indexOf(':');
    if (firstColon !== -1) {
      username = safeDecode(credPart.slice(0, firstColon));
      password = safeDecode(credPart.slice(firstColon + 1));
    } else {
      username = safeDecode(credPart);
      password = null;
    }
  }

  // Pisahkan host dan port
  let host = hostPort;
  let port = 554;
  if (hostPort.startsWith('[')) {
    const endBracket = hostPort.indexOf(']');
    if (endBracket !== -1) {
      host = hostPort.slice(1, endBracket);
      const after = hostPort.slice(endBracket + 1);
      if (after.startsWith(':')) {
        port = parseInt(after.slice(1), 10) || 554;
      }
    }
  } else if (hostPort.includes(':')) {
    const colonIdx = hostPort.lastIndexOf(':');
    host = hostPort.slice(0, colonIdx);
    port = parseInt(hostPort.slice(colonIdx + 1), 10) || 554;
  }

  host = host.trim();

  // Buat URL yang dinormalisasi dengan encoding aman
  const encodedCred = (username && password)
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    : (username ? `${encodeURIComponent(username)}@` : '');

  const normalizedUrl = `rtsp://${encodedCred}${host}:${port}${path}`;
  const sanitizedUrl = `rtsp://${host}:${port}${path}`;

  return {
    host,
    port,
    username,
    password,
    path,
    normalizedUrl,
    sanitizedUrl,
  };
}

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
export function checkRtspStream(host, port = 554, timeoutMs = config.pingTimeoutMs, username = null, password = null, rtspPath = null) {
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
      // Susun RTSP OPTIONS request
      const streamPath = rtspPath || `/Streaming/Channels/101`;
      const rtspUrl = (username && password)
        ? `rtsp://${username}:${password}@${host}:${port}${streamPath}`
        : `rtsp://${host}:${port}${streamPath}`;

      let rtspCmd = `OPTIONS ${rtspUrl} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: MonDev-StreamMonitor/1.0\r\n`;

      // Tambahkan Basic Auth header jika ada credential
      if (username && password) {
        const cred = Buffer.from(`${username}:${password}`).toString('base64');
        rtspCmd += `Authorization: Basic ${cred}\r\n`;
      }
      rtspCmd += `\r\n`;
      socket.write(rtspCmd);
    });

    socket.on('data', (chunk) => {
      receivedData += chunk.toString();
      // Respons valid: harus mengandung header atau status line protokol RTSP resmi
      const hasValidResponse =
        receivedData.includes('RTSP/') ||
        receivedData.includes('CSeq') ||
        receivedData.includes('Public:') ||
        receivedData.includes('Server:') ||
        receivedData.includes('WWW-Authenticate') ||
        /RTSP\/\d\.\d\s+\d{3}/i.test(receivedData);

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
        statusText: `RTSP Timeout (Port ${port} tidak merespons)`,
      });
    });

    socket.on('close', () => {
      if (!resolved) {
        doResolve({
          alive: false,
          time: 0,
          statusText: `RTSP Closed (Koneksi ditutup tanpa data)`,
        });
      }
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

  if (metode === 'RTSP') {
    // Parse RTSP URL jika device.ip berformat URL lengkap (rtsp://user:pass@host:port/path)
    const parsed = parseRtspUrl(device.ip);
    const host = parsed.host;
    const port = parsed.port || device.port || 554;
    const username = parsed.username || device.username || null;
    const password = parsed.password || device.password_encrypted || null;
    const rtspPath = parsed.path !== '/' ? parsed.path : null;

    const rtspRes = await checkRtspStream(host, port, timeoutMs, username, password, rtspPath);
    if (rtspRes.alive) return rtspRes;

    // Jika stream RTSP port 554 tidak aktif, perangkat RTSP WAJIB dilaporkan OFFLINE.
    // ICMP ping hanya dijalankan untuk diagnosa informasi statusText, bukan penentu online.
    const pingRes = await pingHost(host, timeoutMs);
    if (pingRes.alive) {
      return {
        alive: false,
        time: 0,
        statusText: `RTSP Stream Offline (Port ${port} tertutup, Host ICMP ${pingRes.time} ms)`,
      };
    }
    return rtspRes;
  }

  const host = device.ip;

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
