import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 루트를 현재 디렉토리로 명시적 설정
  root: '.',
  // 캐시 충돌 방지를 위해 캐시 디렉토리 이름 변경 (v4.0)
  cacheDir: './.vite-cache-v4.0', 
  publicDir: 'public',
  base: './', // 상대 경로로 변경하여 경로 문제 방지
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'), 
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true, 
    sourcemap: false, 
    chunkSizeWarningLimit: 2000, 
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          utils: ['xlsx', 'lucide-react']
        }
      }
    },
  },
  server: {
    fs: {
      allow: ['.'] 
    }
  }
});