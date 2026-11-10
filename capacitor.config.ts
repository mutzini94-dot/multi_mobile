import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 안드로이드 앱 (Capacitor): 웹 빌드(dist)를 앱 안에 넣어 http://localhost 에서 띄운다.
 * - index.html의 viewport에 viewport-fit=cover를 두지 않는다: 두면 Capacitor가 상태 표시줄 여백을 웹에 맡기는데(값이 0으로 와) 상단이 겹친다
 * - http://localhost: 투네이션 후원 페이지가 frame-ancestors로 허용하는 주소라 후원 페이지를 앱 안 창에 띄울 수 있고,
 *   트위치 임베드의 parent=localhost 와도 맞는다 (localhost는 http여도 보안 컨텍스트)
 */
const config: CapacitorConfig = {
  appId: 'at.toon.multiview',
  appName: 'TOO 멀티뷰',
  webDir: 'dist',
  server: { androidScheme: 'http' },
  android: { allowMixedContent: false, backgroundColor: '#ffffff' },
  // 상태 표시줄·내비게이션 바: 앱이 그 높이만큼 비워 두고(웹 화면이 겹치지 않게) 흰 바탕에 어두운 아이콘
  plugins: { SystemBars: { style: 'LIGHT', insetsHandling: 'css' } },
};

export default config;
