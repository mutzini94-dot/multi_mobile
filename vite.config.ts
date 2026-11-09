/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

/** 화면에 보여 줄 빌드 버전: 커밋 번호(Vercel이 주는 값, 없으면 git) · 빌드 시각(한국 시간) */
function buildId(): string {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      sha = 'dev';
    }
  }
  const at = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
  return `${sha.slice(0, 7)} · ${at}`;
}

export default defineConfig({
  plugins: [react()],
  define: { __APP_BUILD__: JSON.stringify(buildId()) },
  // 설치형 빌드 결과(desktop/web, desktop/dist)와 확장은 개발 서버가 감시하지 않는다 (잠긴 설치 파일에서 watch 오류)
  server: { watch: { ignored: ['**/desktop/**', '**/extension/**'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'], // extension/test 는 node --test로 따로 실행
  },
});
