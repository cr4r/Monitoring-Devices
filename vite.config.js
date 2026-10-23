import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/',
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-chart': ['chart.js'],
          'vendor-jspdf': ['jspdf'],
          'vendor-html2canvas': ['html2canvas'],
          'vendor-swal': ['sweetalert2'],
          'vendor-papa': ['papaparse'],
        },
      },
    },
  },
});
