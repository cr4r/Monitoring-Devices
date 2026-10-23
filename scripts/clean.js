// ================================================================
// DevWatch / MonDev — scripts/clean.js
// Membersihkan folder dist dan berkas sementara
// ================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pathsToClean = [
  path.join(rootDir, 'dist'),
  path.join(rootDir, 'server/data/temp_restore.sqlite'),
];

for (const p of pathsToClean) {
  if (fs.existsSync(p)) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`✓ Dihapus folder: ${path.relative(rootDir, p)}`);
      } else {
        fs.unlinkSync(p);
        console.log(`✓ Dihapus file: ${path.relative(rootDir, p)}`);
      }
    } catch (err) {
      console.warn(`Gagal menghapus ${p}:`, err.message);
    }
  }
}

console.log('✨ Pembersihan direktori selesai.');
