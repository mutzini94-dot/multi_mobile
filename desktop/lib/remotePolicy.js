'use strict';
// 크리에이터 리모컨(caprisontoon/remote01 웹 리모컨)을 설치형으로 띄울 때의 규칙.
// 이 주소·세션의 화면만 설치형 전용 브리지(window.toona, remote-preload.js)를 받는다.

const REMOTE_BASE = 'https://caprisontoon.github.io/remote01/';
/** src/app/remoteMode.ts 의 CREATOR_REMOTE_URL 과 같아야 한다 */
const REMOTE_URL = `${REMOTE_BASE}?autologin=1`;
const REMOTE_PARTITION = 'persist:remote';
const WIDGET_MIN = { width: 150, height: 150 };
const WIDGET_ID_RE = /^\w{1,40}$/;

function isRemoteUrl(u) {
  try {
    const x = new URL(String(u || ''));
    return x.protocol === 'https:' && x.host === 'caprisontoon.github.io' && x.pathname.startsWith('/remote01/');
  } catch {
    return false;
  }
}

function allowRemoteWebview(params) {
  return !!params && params.partition === REMOTE_PARTITION && isRemoteUrl(params.src);
}

/** 분리된 위젯 창 주소 (리모컨은 #/widget/<id> 를 보고 follower 창이 된다) */
function widgetUrl(id) {
  return WIDGET_ID_RE.test(String(id || '')) ? `${REMOTE_URL}#/widget/${id}` : null;
}

/** 위젯 분리 요청 값을 창 크기로 (숫자가 아니면 무시) */
function detachBounds(o) {
  if (!o || ![o.screenX, o.screenY, o.width, o.height].every((n) => Number.isFinite(n))) return null;
  return {
    x: Math.round(o.screenX),
    y: Math.round(o.screenY),
    width: Math.max(Math.round(o.width), WIDGET_MIN.width),
    height: Math.max(Math.round(o.height), WIDGET_MIN.height),
  };
}

/** 메인 창 안에 넣을 때는 우리 창 테두리가 이미 있으니 리모컨의 창 버튼(최소화·최대화·닫기)과 끌기 영역을 숨긴다 */
const EMBED_CSS = `
header div:has(> button[aria-label="최소화"]) { display: none !important; }
.app-drag, .app-drag * { -webkit-app-region: no-drag !important; }
.drag-grip { visibility: hidden !important; }
`;

module.exports = { REMOTE_BASE, REMOTE_URL, REMOTE_PARTITION, WIDGET_MIN, isRemoteUrl, allowRemoteWebview, widgetUrl, detachBounds, EMBED_CSS };
