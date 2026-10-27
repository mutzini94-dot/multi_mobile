/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 설치형 빌드 결과(desktop/web, desktop/dist)와 확장은 개발 서버가 감시하지 않는다 (잠긴 설치 파일에서 watch 오류)
  server: { watch: { ignored: ['**/desktop/**', '**/extension/**'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'], // extension/test 는 node --test로 따로 실행
  },
});
