// ================================================================
// DevWatch - install-service.js
// Script instalasi background Windows Service untuk DevWatch
// Jalankan via: npm run service:install (di terminal Administrator)
// ================================================================

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverScript = path.resolve(__dirname, '../index.js');

console.log('========================================================');
console.log('📡 DevWatch - Pemasangan Windows Service');
console.log('========================================================');
console.log(`Lokasi Server Script: ${serverScript}`);

try {
  const { Service } = await import('node-windows');

  const svc = new Service({
    name: 'DevWatch Device Monitor',
    description: 'DevWatch - Sistem Monitoring Jaringan & CCTV Kantor (Windows Service)',
    script: serverScript,
    nodeOptions: ['--harmony'],
    env: [
      { name: 'NODE_ENV', value: 'production' },
      { name: 'PORT', value: '3000' },
    ],
  });

  svc.on('install', () => {
    console.log('✅ Service "DevWatch Device Monitor" berhasil dipasang!');
    svc.start();
    console.log('🚀 Service sedang dimulai di background (Port 3000)...');
  });

  svc.on('alreadyinstalled', () => {
    console.log('⚠️ Service sudah terpasang sebelumnya.');
  });

  svc.on('error', (err) => {
    console.error('❌ Terjadi kesalahan:', err);
  });

  svc.install();
} catch (e) {
  console.log(`
ℹ️ PANDUAN ALTERNATIF MENGGUNAKAN NSSM (Non-Sucking Service Manager):
Jika node-windows memerlukan elevasi admin terpisah, Anda dapat menggunakan NSSM:

1. Unduh nssm.exe dan letakkan di PATH Anda.
2. Buka PowerShell / CMD sebagai Administrator.
3. Jalankan perintah:
   nssm install DevWatch "node.exe" "${serverScript}"
   nssm set DevWatch AppDirectory "${path.resolve(__dirname, '../..')}"
   nssm set DevWatch Start SERVICE_AUTO_START
   nssm start DevWatch

Service akan otomatis berjalan sejak komputer dinyalakan.
`);
}
