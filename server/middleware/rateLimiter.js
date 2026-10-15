// ================================================================
// DevWatch — rateLimiter.js
// Proteksi brute force login: 5x gagal -> lockout 15 menit
// ================================================================

import { config } from '../config.js';

const failureMap = new Map(); // key: email or ip -> { count, lockoutUntil }

export function loginRateLimiter(req, res, next) {
  const key = req.body?.email?.toLowerCase() || req.ip;
  const entry = failureMap.get(key);
  const now = Date.now();

  if (entry && entry.lockoutUntil && now < entry.lockoutUntil) {
    const remainingMinutes = Math.ceil((entry.lockoutUntil - now) / 60000);
    return res.status(429).json({
      success: false,
      isLocked: true,
      remainingMinutes,
      message: `Terlalu banyak percobaan login yang gagal. Akun dikunci sementara. Silakan coba kembali dalam ${remainingMinutes} menit.`,
    });
  }

  // Jika waktu lockout telah berlalu, reset
  if (entry && entry.lockoutUntil && now >= entry.lockoutUntil) {
    failureMap.delete(key);
  }

  next();
}

export function recordFailedLogin(key) {
  const now = Date.now();
  const entry = failureMap.get(key) || { count: 0, lockoutUntil: null };
  entry.count += 1;

  if (entry.count >= config.sessionLockoutAttempts) {
    entry.lockoutUntil = now + config.sessionLockoutMinutes * 60 * 1000;
  }

  failureMap.set(key, entry);
  return entry;
}

export function resetFailedLogin(key) {
  failureMap.delete(key);
}
