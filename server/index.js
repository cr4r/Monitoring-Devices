// ================================================================
// DevWatch — server/index.js
// Entry point Express server + WebSocket + Static SPA + Monitoring
// ================================================================

import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { seedDatabase } from './database/seed.js';
import { initWebSocket } from './services/websocketService.js';
import { startMonitoringWorker, stopMonitoringWorker } from './services/monitoringWorker.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route modules
import authRoutes from './routes/auth.js';
import devicesRoutes from './routes/devices.js';
import logsRoutes from './routes/logs.js';
import reportsRoutes from './routes/reports.js';
import usersRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Middleware dasar
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'DevWatch Device Monitoring System',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Registrasi API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);

// Sajikan Berkas Statis Frontend (Produksi / Windows Service)
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA Fallback: arahkan semua rute non-API ke dist/index.html (kompatibel Express 5)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Error Handler
app.use(errorHandler);

// Inisialisasi Database, WebSocket, dan Monitoring Worker
async function startServer() {
  try {
    // 1. Pastikan database terisi
    await seedDatabase();

    // 2. Inisialisasi WebSocket
    initWebSocket(server);

    // 3. Jalankan Monitoring Worker
    startMonitoringWorker(5000);

    server.on('error', (err) => {
      console.error('HTTP Server Error:', err);
    });

    // 4. Dengarkan Port
    server.listen(config.port, config.host, () => {
      console.log(`=================================================`);
      console.log(`📡 DevWatch Backend Server Berjalan`);
      console.log(`🌐 URL: http://localhost:${config.port}`);
      console.log(`🔌 WebSocket: ws://localhost:${config.port}/ws`);
      console.log(`📁 Database: ${config.dbPath}`);
      console.log(`=================================================`);
    });
  } catch (err) {
    console.error('Gagal memulai server DevWatch:', err);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

// Penanganan Graceful Shutdown
function handleShutdown() {
  console.log('\nMenerima sinyal terminasi. Menutup server dengan aman...');
  stopMonitoringWorker();
  server.close(() => {
    console.log('Server DevWatch telah ditutup.');
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

startServer();

export { app, server };
