import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // [CRITICAL] root를 현재 디렉토리('.')로 강제 지정하여 src 폴더 탐색을 방지함
  root: '.', 
  publicDir: 'public',
  base: '/',
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
        main: path.resolve(__dirname, 'index.html'), // 명시적으로 루트의 index.html을 진입점으로 지정
      },
    },
  }
});