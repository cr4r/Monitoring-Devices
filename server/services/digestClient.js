// ================================================================
// DevWatch - digestClient.js
// Client HTTP dengan Digest Authentication (RFC 2617 & RFC 7616)
// Mendukung caching nonce & realm untuk efisiensi streaming CCTV
// ================================================================

import crypto from 'crypto';

class DigestClient {
  constructor() {
    // Map host (origin) -> { realm, nonce, qop, opaque, nc }
    this.authCache = new Map();
  }

  /**
   * Eksekusi HTTP fetch dengan penanganan tantangan Digest Authentication otomatis
   * @param {string} url - Target URL lengkap
   * @param {object} options - Opsi fetch standar (method, headers, signal, dll)
   * @param {string} username - Nama pengguna kamera
   * @param {string} password - Kata sandi kamera
   */
  async fetch(url, options = {}, username = null, password = null) {
    const parsed = new URL(url);
    const key = `${parsed.protocol}//${parsed.host}`;
    const uri = (parsed.pathname || '/') + (parsed.search || '');
    const method = (options.method || 'GET').toUpperCase();

    let cached = this.authCache.get(key);
    const baseHeaders = { ...(options.headers || {}) };

    // Jika telah ada cache kredensial/nonce, kirim header Digest langsung untuk menghindari delay 401
    if (cached && username && password) {
      cached.nc = (cached.nc || 0) + 1;
      const ncHex = String(cached.nc).padStart(8, '0');
      const cnonce = crypto.randomBytes(8).toString('hex');
      const ha1 = crypto.createHash('md5').update(`${username}:${cached.realm}:${password}`).digest('hex');
      const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');

      let response;
      if (cached.qop) {
        response = crypto.createHash('md5').update(`${ha1}:${cached.nonce}:${ncHex}:${cnonce}:auth:${ha2}`).digest('hex');
      } else {
        response = crypto.createHash('md5').update(`${ha1}:${cached.nonce}:${ha2}`).digest('hex');
      }

      let authHeader = `Digest username="${username}", realm="${cached.realm}", nonce="${cached.nonce}", uri="${uri}", response="${response}"`;
      if (cached.opaque) authHeader += `, opaque="${cached.opaque}"`;
      if (cached.qop) authHeader += `, qop=auth, nc=${ncHex}, cnonce="${cnonce}"`;

      baseHeaders['Authorization'] = authHeader;
    }

    let resp = await fetch(url, { ...options, headers: baseHeaders });

    // Jika server merespons 401 Unauthorized dengan WWW-Authenticate: Digest
    if (resp.status === 401 && username && password) {
      const authChallenge = resp.headers.get('www-authenticate') || '';
      if (authChallenge.toLowerCase().includes('digest')) {
        const realm = (authChallenge.match(/realm="([^"]+)"/) || [])[1] || '';
        const nonce = (authChallenge.match(/nonce="([^"]+)"/) || [])[1] || '';
        const qop = (authChallenge.match(/qop="([^"]+)"/) || [])[1] || '';
        const opaque = (authChallenge.match(/opaque="([^"]+)"/) || [])[1] || '';

        const nc = 1;
        const ncHex = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');
        const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');

        let response;
        if (qop) {
          response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ncHex}:${cnonce}:auth:${ha2}`).digest('hex');
        } else {
          response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
        }

        let authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
        if (opaque) authHeader += `, opaque="${opaque}"`;
        if (qop) authHeader += `, qop=auth, nc=${ncHex}, cnonce="${cnonce}"`;

        // Simpan cache untuk request berikutnya
        this.authCache.set(key, { realm, nonce, qop, opaque, nc });

        const retryHeaders = { ...baseHeaders, Authorization: authHeader };
        resp = await fetch(url, { ...options, headers: retryHeaders });
      }
    }

    return resp;
  }

  /**
   * Reset cache kredensial / nonce host tertentu
   */
  clearCache(host = null) {
    if (host) {
      for (const key of this.authCache.keys()) {
        if (key.includes(host)) this.authCache.delete(key);
      }
    } else {
      this.authCache.clear();
    }
  }
}

export const digestClient = new DigestClient();
