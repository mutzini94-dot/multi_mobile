/**
 * 웹 버전: 서비스 워커를 등록해 앱처럼 설치(홈 화면에 추가)할 수 있게 한다.
 * 설치형(Electron)·개발 서버(localhost)·분리 창에서는 등록하지 않는다 (개발 중 저장본이 화면을 가리지 않게).
 */
export function registerServiceWorker(win: Window = window): void {
  const nav = win.navigator as Navigator & { serviceWorker?: ServiceWorkerContainer };
  if (!nav.serviceWorker || !win.isSecureContext) return;
  const host = win.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || win.location.protocol === 'file:') return;
  win.addEventListener('load', () => {
    nav.serviceWorker!.register('/sw.js').catch(() => {});
  });
}

/** 알림 띄우기: 안드로이드 크롬은 new Notification()을 막아 서비스 워커로 띄워야 한다 */
export async function showAppNotification(title: string, options: NotificationOptions & { data?: unknown }): Promise<void> {
  const N = globalThis.Notification;
  if (!N || N.permission !== 'granted') return;
  const sw = (globalThis.navigator as Navigator & { serviceWorker?: ServiceWorkerContainer })?.serviceWorker;
  try {
    const reg = sw ? await Promise.race([sw.getRegistration(), new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500))]) : undefined;
    if (reg) {
      await reg.showNotification(title, { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', ...options });
      return;
    }
  } catch {
    // 아래 방식으로
  }
  try {
    new N(title, { icon: '/icons/icon-192.png', ...options });
  } catch {
    // 이 브라우저는 알림을 띄울 수 없다
  }
}
