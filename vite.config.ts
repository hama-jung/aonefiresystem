import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 루트를 현재 디렉토리로 강제 설정
  root: '.',
  // 캐시 디렉토리를 변경하여 기존 캐시 무효화 시도
  cacheDir: './.vite-cache-new',
  publicDir: 'public',
  base: './', // 상대 경로 베이스
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'), 
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    fs: {
      // src 폴더가 있더라도 접근을 제한적으로 허용하지 않고 루트 기준만 허용
      allow: ['.'] 
    }
  }
});