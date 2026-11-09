/*
 * 투네이션 후원 브라우저 서비스 워커 (앱처럼 설치 · 빠른 시작 · 방송 시작 알림)
 * - 화면(HTML)은 네트워크 먼저: 새 버전을 바로 받고, 끊겼을 때만 저장해 둔 화면
 * - 빌드 파일(/assets/ 해시 이름)·글꼴·아이콘은 저장본 먼저
 * - 다른 사이트(방송·투네이션 API)는 건드리지 않는다
 */
const CACHE = 'mv-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/fonts/pretendard.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          }),
      ),
    );
  }
});

// 방송 시작 알림을 누르면 열려 있는 앱으로 (없으면 새로 연다)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const key = e.notification.data && e.notification.data.key;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        if (key) client.postMessage({ type: 'mv-open-live', key });
        return client.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});
