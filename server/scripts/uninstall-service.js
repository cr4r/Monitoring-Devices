// ================================================================
// DevWatch — uninstall-service.js
// Script pencopotan Windows Service
// ================================================================

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverScript = path.resolve(__dirname, '../index.js');

try {
  const { Service } = await import('node-windows');

  const svc = new Service({
    name: 'DevWatch Device Monitor',
    script: serverScript,
  });

  svc.on('uninstall', () => {
    console.log('✅ Service "DevWatch Device Monitor" berhasil dicopot.');
  });

  svc.uninstall();
} catch (e) {
  console.log(`
ℹ️ Untuk mencopot service melalui NSSM (Administrator):
   nssm stop DevWatch
   nssm remove DevWatch confirm
`);
}
