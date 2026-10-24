// ================================================================
// DevWatch - auth.js (Middleware)
// Verifikasi token JWT & otorisasi berdasarkan peran (RBAC)
// ================================================================

import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/**
 * Middleware untuk memverifikasi JWT Bearer Token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Token autentikasi tidak ditemukan.',
    });
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Sesi telah kedaluwarsa atau token tidak valid. Silakan login kembali.',
      });
    }
    req.user = user;
    next();
  });
}

/**
 * Middleware untuk membatasi akses berdasarkan peran pengguna
 * @param {string[]} allowedRoles - Contoh: ['admin'], ['admin', 'teknisi']
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak: Fitur ini hanya dapat diakses oleh peran: ${allowedRoles.join(', ')}.`,
      });
    }

    next();
  };
}
