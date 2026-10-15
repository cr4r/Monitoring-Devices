// ================================================================
// DevWatch — generate-cert.js
// Pembuat Sertifikat SSL/TLS Mandiri (Self-Signed) untuk Lingkungan Lokal / Staging
// ================================================================

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import selfsigned from 'selfsigned';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sslDir = path.resolve(__dirname, '../../ssl');

console.log('='.repeat(65));
console.log('🔐 DEVAWATCH — GENERATOR SERTIFIKAT SSL/TLS MANDIRI');
console.log('='.repeat(65));

if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
  console.log(`📁 Membuat folder SSL: ${sslDir}`);
}

const keyPath = path.join(sslDir, 'server.key');
const certPath = path.join(sslDir, 'server.crt');

const hostname = os.hostname();
const attrs = [
  { name: 'commonName', value: 'localhost' },
  { name: 'countryName', value: 'ID' },
  { shortName: 'ST', value: 'DKI Jakarta' },
  { name: 'localityName', value: 'Jakarta' },
  { name: 'organizationName', value: 'DevWatch Network Monitoring' },
  { shortName: 'OU', value: 'IT Infrastructure' },
];

console.log('⏳ Menghasilkan RSA 2048-bit Private Key dan X.509 Certificate...');

const pems = await selfsigned.generate(attrs, {
  days: 365 * 2,
  keySize: 2048,
  algorithm: 'sha256',
  extensions: [
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 2, value: hostname },
        { type: 2, value: 'devwatch.local' },
        { type: 7, ip: '127.0.0.1' },
      ],
    },
  ],
});

fs.writeFileSync(keyPath, pems.private, { encoding: 'utf8' });
fs.writeFileSync(certPath, pems.cert, { encoding: 'utf8' });

console.log('✅ Sertifikat SSL berhasil dibuat:');
console.log(`  - Private Key : ${keyPath}`);
console.log(`  - Certificate : ${certPath}`);
console.log(`  - Masa Berlaku: 2 Tahun`);
console.log(`  - Subject Alt : localhost, ${hostname}, devwatch.local, 127.0.0.1`);
console.log('-'.repeat(65));
console.log('💡 Cara Mengaktifkan Native HTTPS di DevWatch:');
console.log('   1. Tambahkan di file .env:');
console.log('      USE_HTTPS=true');
console.log('      SSL_KEY_PATH=./ssl/server.key');
console.log('      SSL_CERT_PATH=./ssl/server.crt');
console.log('   2. Jalankan server:');
console.log('      npm run start');
console.log('   3. Buka browser: https://localhost:3000');
console.log('='.repeat(65) + '\n');
