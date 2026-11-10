import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 안드로이드 앱 (Capacitor): 웹 빌드(dist)를 앱 안에 넣어 http://localhost 에서 띄운다.
 * - http://localhost: 투네이션 후원 페이지가 frame-ancestors로 허용하는 주소라 후원 페이지를 앱 안 창에 띄울 수 있고,
 *   트위치 임베드의 parent=localhost 와도 맞는다 (localhost는 http여도 보안 컨텍스트)
 */
const config: CapacitorConfig = {
  appId: 'at.toon.multiview',
  appName: 'TOO 멀티뷰',
  webDir: 'dist',
  server: { androidScheme: 'http' },
  android: { allowMixedContent: false, backgroundColor: '#f4f6f9' },
};

export default config;
