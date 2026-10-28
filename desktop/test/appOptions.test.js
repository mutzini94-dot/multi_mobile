'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createAppOptions, APP_OPTION_DEFAULTS } = require('../lib/appOptions');

function setup(saved = {}, packaged = true) {
  const store = { ...APP_OPTION_DEFAULTS, ...saved };
  const login = [];
  const opts = createAppOptions({
    prefs: { get: (k) => store[k], set: (k, v) => (store[k] = v) },
    setLoginItem: (s) => login.push(s),
    packaged,
  });
  return { opts, store, login };
}

test('기본값: 닫으면 트레이로 · 자동 업데이트 켜짐, 시작 시 실행 꺼짐', () => {
  assert.deepStrictEqual(APP_OPTION_DEFAULTS, { autoLaunch: false, closeToTray: true, autoUpdate: true });
  assert.deepStrictEqual(setup().opts.all(), { autoLaunch: false, closeToTray: true, autoUpdate: true });
});

test('Windows 시작 시 실행: 저장하고 로그인 항목을 바꾼다 (트레이로 숨겨서 시작)', () => {
  const { opts, store, login } = setup();
  assert.strictEqual(opts.set('autoLaunch', true), true);
  assert.strictEqual(store.autoLaunch, true);
  assert.deepStrictEqual(login.at(-1), { openAtLogin: true, args: ['--hidden'] });
});

test('개발 실행에서는 로그인 항목을 건드리지 않는다', () => {
  const { opts, login } = setup({}, false);
  opts.set('autoLaunch', true);
  opts.applyLoginItem();
  assert.deepStrictEqual(login, []);
});

test('모르는 옵션·불린이 아닌 값은 무시', () => {
  const { opts, store } = setup();
  assert.strictEqual(opts.set('evil', true), false);
  assert.strictEqual(opts.set('closeToTray', 'yes'), false);
  assert.strictEqual(store.closeToTray, true);
});
