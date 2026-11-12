import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // three.js (~680 kB) แยกเป็น chunk ที่โหลดเฉพาะหน้าที่มีโมเดล 3D จึงยอมให้ใหญ่กว่าค่าเตือนปกติ
  build: { chunkSizeWarningLimit: 700 },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
    },
  },
});
