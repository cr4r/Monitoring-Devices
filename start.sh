#!/usr/bin/env bash
# ================================================================
# MonDev - Skrip Peluncur Proyek Linux / macOS (start.sh)
# ================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "========================================================"
echo "  📡 MonDev - Sistem Monitoring Device & Jaringan"
echo "========================================================"
echo ""

# 1. Periksa Node.js (Memerlukan Node.js v22+ untuk node:sqlite bawaan)
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js tidak ditemukan! Silakan pasang Node.js v22+ terlebih dahulu."
    echo "Unduh dari https://nodejs.org"
    exit 1
fi

# 2. Salin .env jika belum ada
if [ ! -f ".env" ]; then
    if [ -f ".env-example" ]; then
        echo "[INFO] Berkas .env belum ditemukan. Menyalin dari .env-example..."
        cp .env-example .env
    fi
fi

# 3. Instal dependensi jika node_modules belum ada
if [ ! -d "node_modules" ]; then
    echo "[INFO] Folder node_modules belum ada. Menjalankan npm install..."
    npm install
fi

# 4. Inisialisasi basis data jika belum ada
if [ ! -f "server/data/devwatch.db" ] && [ ! -f "data/devwatch.db" ]; then
    echo "[INFO] Database belum ditemukan. Menyemai basis data awal..."
    npm run seed
fi

# 5. Build bundle jika dist/ belum ada
if [ ! -f "dist/index.html" ]; then
    echo "[INFO] Membangun antarmuka web produksi (dist/)..."
    npm run build
fi

echo ""
echo "========================================================"
echo "  🚀 Menjalankan Server MonDev di http://localhost:3000"
echo "  Tekan Ctrl+C untuk menghentikan server."
echo "========================================================"
echo ""

# 6. Buka browser jika didukung
if command -v xdg-open &> /dev/null; then
    (sleep 2 && xdg-open http://localhost:3000) &
elif command -v open &> /dev/null; then
    (sleep 2 && open http://localhost:3000) &
fi

# 7. Jalankan server backend
exec node server/index.js
