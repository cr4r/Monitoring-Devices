// ================================================================
// DevWatch / MonDev - scripts/start-dev.js
// Menjalankan server backend (port 3000) dan Vite frontend (port 5173) bersamaan
// ================================================================

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('🚀 Memulai MonDev Dev Environment (Backend + Frontend)...');

// 1. Jalankan Backend Server
const serverProc = spawn('node', ['server/index.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWin,
});

// 2. Jalankan Vite Dev Server
const viteProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWin,
});

function handleExit() {
  try {
    serverProc.kill();
  } catch {}
  try {
    viteProc.kill();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('exit', handleExit);
