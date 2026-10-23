import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'devwatch-secret-jwt-key-2026-secure-token',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  dbPath: path.resolve(__dirname, process.env.DB_PATH || 'data/devwatch.db'),
  pingTimeoutMs: parseInt(process.env.PING_TIMEOUT_MS || '2000', 10),
  defaultIntervalSeconds: parseInt(process.env.DEFAULT_INTERVAL_SECONDS || '60', 10),
  consecutiveFailureThreshold: parseInt(process.env.FAILURE_THRESHOLD || '3', 10),
  sessionLockoutAttempts: 5,
  sessionLockoutMinutes: 15,
  useHttps: process.env.USE_HTTPS === 'true',
  sslKeyPath: path.resolve(__dirname, process.env.SSL_KEY_PATH || '../ssl/server.key'),
  sslCertPath: path.resolve(__dirname, process.env.SSL_CERT_PATH || '../ssl/server.crt'),
};
