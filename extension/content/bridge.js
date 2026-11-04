'use strict';
// 멀티뷰 페이지 ↔ 연동 확장 중계. manifest의 matches(멀티뷰 주소)에서만 실행된다.
// 페이지: window.postMessage({ source: 'mv-page', id, type }) → 확장 응답을 { source: 'mv-ext', id, ok, data | error }로 돌려준다.
(() => {
  const TYPES = ['status', 'login', 'logout', 'favorites', 'history', 'search', 'bookmark', 'signatures'];
  const reply = (id, res) => window.postMessage({ source: 'mv-ext', id, ...res }, location.origin);

  window.addEventListener('message', (e) => {
    // 같은 페이지 자신이 보낸 요청만 (iframe·다른 창·다른 출처는 무시)
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.source !== 'mv-page' || typeof d.id !== 'string' || !TYPES.includes(d.type)) return;
    // 값: 검색어·후원 아이디(문자열) 또는 즐겨찾기 { tag, on }만 넘긴다
    const p = d.payload;
    const payload = typeof p === 'string' ? p.slice(0, 60) : p && typeof p === 'object' ? { tag: String(p.tag ?? ''), on: !!p.on } : undefined;
    chrome.runtime.sendMessage({ type: d.type, payload }).then(
      (res) => reply(d.id, res && typeof res === 'object' ? res : { ok: false, error: 'NO_RESPONSE' }),
      (err) => reply(d.id, { ok: false, error: String((err && err.message) || err) }),
    );
  });
})();
