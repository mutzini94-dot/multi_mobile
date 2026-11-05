'use strict';
// 백업에 담는 설치형 창 배치: 메인 창·PIP 후원창·분리 창 크기와 위치, 최대화, 항상 위.
// 되살릴 때는 모양을 확인해 맞는 값만 쓴다 (화면 밖이면 windowBounds.restoreBounds가 기본 위치로 바꾼다).

const BOUNDS_KEYS = ['windowBounds', 'pipBounds', 'soloBounds'];
const BOOL_KEYS = ['windowMaximized', 'alwaysOnTop'];
const WINDOW_LAYOUT_KEYS = [...BOUNDS_KEYS, ...BOOL_KEYS];
const MAX_SIZE = 20000;

function pickWindowLayout(get) {
  const out = {};
  for (const k of WINDOW_LAYOUT_KEYS) out[k] = get(k) ?? null;
  return out;
}

const okBounds = (b) =>
  b && typeof b === 'object' && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(b[k])) && b.width > 0 && b.height > 0 && b.width <= MAX_SIZE && b.height <= MAX_SIZE && Math.abs(b.x) <= MAX_SIZE * 2 && Math.abs(b.y) <= MAX_SIZE * 2;

function sanitizeWindowLayout(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of BOUNDS_KEYS) {
    if (raw[k] === null) out[k] = null;
    else if (okBounds(raw[k])) out[k] = { x: Math.round(raw[k].x), y: Math.round(raw[k].y), width: Math.round(raw[k].width), height: Math.round(raw[k].height) };
  }
  for (const k of BOOL_KEYS) if (typeof raw[k] === 'boolean') out[k] = raw[k];
  return out;
}

module.exports = { pickWindowLayout, sanitizeWindowLayout, WINDOW_LAYOUT_KEYS };
