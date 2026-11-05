'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pickWindowLayout, sanitizeWindowLayout, WINDOW_LAYOUT_KEYS } = require('../lib/windowLayout');

test('백업할 창 배치: 메인·PIP·분리 창 크기와 최대화·항상 위', () => {
  const prefs = { windowBounds: { x: 10, y: 20, width: 1400, height: 860 }, windowMaximized: true, pipBounds: null, soloBounds: { x: 0, y: 0, width: 720, height: 444 }, alwaysOnTop: false, port: 47230, trayNoticeShown: true };
  const l = pickWindowLayout((k) => prefs[k]);
  assert.deepStrictEqual(Object.keys(l).sort(), [...WINDOW_LAYOUT_KEYS].sort());
  assert.strictEqual(l.port, undefined, '포트 등 다른 설정은 담지 않는다');
  assert.deepStrictEqual(l.windowBounds, prefs.windowBounds);
});

test('되살릴 창 배치는 모양을 확인하고 맞는 것만 남긴다', () => {
  const s = sanitizeWindowLayout({ windowBounds: { x: 1, y: 2, width: 800, height: 600 }, windowMaximized: 'yes', pipBounds: { x: 'a' }, soloBounds: null, alwaysOnTop: true, port: 1 });
  assert.deepStrictEqual(s, { windowBounds: { x: 1, y: 2, width: 800, height: 600 }, soloBounds: null, alwaysOnTop: true });
  assert.deepStrictEqual(sanitizeWindowLayout(null), {});
  assert.deepStrictEqual(sanitizeWindowLayout({ windowBounds: { x: 0, y: 0, width: 99999, height: 600 } }), {}, '말이 안 되는 크기는 버린다');
});
