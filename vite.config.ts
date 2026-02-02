import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 루트를 현재 디렉토리로 명시적 설정
  root: '.',
  // 캐시 충돌 방지를 위해 캐시 디렉토리 이름 변경 (강제 초기화 효과 - 버전 업)
  cacheDir: './.vite-cache-v3.5', 
  publicDir: 'public',
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'), 
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true, // 빌드 전 dist 폴더 비우기
    sourcemap: false, // 메모리 부족 방지
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