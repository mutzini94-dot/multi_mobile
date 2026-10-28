'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { allowWebview, hardenWebPreferences, isWebUrl, WEB_PARTITION, DONATE_PARTITION } = require('../lib/webviewPolicy');

test('칸 webview는 http(s) 주소와 정해진 두 세션만 허용', () => {
  assert.strictEqual(allowWebview({ src: 'https://www.naver.com/', partition: WEB_PARTITION }), true);
  assert.strictEqual(allowWebview({ src: 'https://toon.at/donate/abc', partition: DONATE_PARTITION }), true);
  assert.strictEqual(allowWebview({ src: 'file:///C:/Windows/win.ini', partition: WEB_PARTITION }), false);
  assert.strictEqual(allowWebview({ src: 'javascript:alert(1)', partition: WEB_PARTITION }), false);
  assert.strictEqual(allowWebview({ src: 'https://a.com/', partition: '' }), false, '기본 세션(앱 화면과 같은 세션)은 안 됨');
  assert.strictEqual(allowWebview({ src: 'https://a.com/', partition: 'persist:other' }), false);
  // 웹페이지 칸에서 투네이션 로그인 세션을 쓰면 안 된다 (후원 페이지 칸만)
  assert.strictEqual(allowWebview({ src: 'https://evil.example/', partition: DONATE_PARTITION }), false);
});

test('webview 설정: preload·node 통합을 빼고 격리', () => {
  const prefs = { preload: 'C:/x.js', preloadURL: 'file:///x.js', nodeIntegration: true, contextIsolation: false, sandbox: false, webSecurity: false };
  hardenWebPreferences(prefs);
  assert.strictEqual(prefs.preload, undefined);
  assert.strictEqual(prefs.preloadURL, undefined);
  assert.strictEqual(prefs.nodeIntegration, false);
  assert.strictEqual(prefs.contextIsolation, true);
  assert.strictEqual(prefs.sandbox, true);
  assert.strictEqual(prefs.webSecurity, true);
});

test('isWebUrl', () => {
  assert.strictEqual(isWebUrl('http://a.b/'), true);
  assert.strictEqual(isWebUrl('mailto:x@y'), false);
  assert.strictEqual(isWebUrl(''), false);
});
