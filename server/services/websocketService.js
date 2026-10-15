// ================================================================
// DevWatch — websocketService.js
// Pengelola koneksi WebSocket untuk siaran telemetri real-time
// ================================================================

import { WebSocketServer, WebSocket } from 'ws';

let wss = null;

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Kirim pesan selamat datang dan status awal
    ws.send(JSON.stringify({
      event: 'connected',
      message: 'Terhubung ke siaran real-time DevWatch',
      timestamp: new Date().toISOString(),
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // Abaikan format non-JSON
      }
    });

    ws.on('error', (err) => {
      console.warn('[WebSocket Error]:', err.message);
    });
  });

  console.log('WebSocket Server siap di /ws');
  return wss;
}

/**
 * Kirim pesan ke seluruh klien browser yang sedang terhubung
 */
export function broadcast(event, payload = {}) {
  if (!wss) return;

  const message = JSON.stringify({
    event,
    data: payload,
    timestamp: new Date().toISOString(),
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
