'use strict';
// 후원 페이지(toon.at/donate/…)를 모바일판으로 연다.
// 투네이션은 같은 HTML을 주고 페이지 스크립트가 navigator.userAgent(모바일 UA 정규식)로 모바일판을 고른다.
// 그래서 HTTP UA·client hints는 정직한 Electron UA 그대로 두고(Cloudflare Turnstile이 비교한다)
// 후원 페이지의 스크립트가 보는 userAgent만 모바일로 보이게 한다. Turnstile 등 다른 출처 iframe은 건드리지 않는다.

const DONATE_RE = /^https:\/\/toon\.at\/donate\//;

function mobileUa(chromeVersion) {
  return `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`;
}

/** 새 문서마다 페이지 스크립트보다 먼저 실행할 코드 */
function mobileUaScript(chromeVersion) {
  return `(() => {
  if (location.origin !== 'https://toon.at' || !location.pathname.startsWith('/donate/')) return;
  const ua = ${JSON.stringify(mobileUa(chromeVersion))};
  Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => ua, configurable: true });
})();`;
}

/** wc(후원 페이지를 띄우는 webContents)에 등록. 디버거를 붙일 수 없으면 PC판 그대로 두고 false */
async function useMobileDonatePage(wc, chromeVersion) {
  try {
    if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
    await wc.debugger.sendCommand('Page.enable');
    await wc.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: mobileUaScript(chromeVersion) });
    // 등록보다 먼저 후원 페이지를 열기 시작했으면 (칸 webview는 붙자마자 연다) 한 번 다시 불러 모바일판으로
    if (DONATE_RE.test(wc.getURL())) wc.reload();
    return true;
  } catch {
    return false;
  }
}

module.exports = { mobileUa, mobileUaScript, useMobileDonatePage };
