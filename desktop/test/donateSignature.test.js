'use strict';
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { selectSignatureScript, selectSignature } = require('../lib/donateFill');

test('시그니처 고르기 스크립트: 올바른 JS, 이름·아이디는 문자열로만 들어간다', () => {
  const code = selectSignatureScript('딱밤 "</script>`${x}`', 'tjd_1');
  assert.doesNotThrow(() => new vm.Script(code));
  assert.ok(code.includes(JSON.stringify('딱밤 "</script>`${x}`')));
  assert.ok(code.includes(JSON.stringify('/donate/tjd_1')));
});

test('시그니처 고르기 스크립트: 잘못된 이름·아이디는 거부', () => {
  for (const [n, t] of [['', 'a'], ['x'.repeat(51), 'a'], ['딱밤', '../x'], [5, 'a']]) assert.throws(() => selectSignatureScript(n, t));
});

const view = (results) => {
  const calls = [];
  return { calls, webContents: { executeJavaScript: async (code) => { calls.push(code); const r = results.shift(); if (r instanceof Error) throw r; return r; } } };
};

test('selectSignature: 탭 열기·전체보기·검색처럼 단계가 남으면 다시 실행하고, ok면 끝', async () => {
  const v = view([new Error('loading'), 'waiting', 'tab', 'popup', 'searched', 'ok']);
  assert.strictEqual(await selectSignature(() => v, '딱밤', 'tjd', { tries: 10, interval: 1 }), 'ok');
  assert.strictEqual(v.calls.length, 6);
});

test('selectSignature: 시그니처 탭이 없으면 바로 실패, 끝내 못 고르면 timeout, 후원창이 없으면 no-view', async () => {
  assert.strictEqual(await selectSignature(() => view(['no-signature-tab']), '딱밤', 'tjd', { tries: 10, interval: 1 }), 'no-signature-tab');
  assert.strictEqual(await selectSignature(() => view(Array(5).fill('waiting')), '딱밤', 'tjd', { tries: 3, interval: 1 }), 'timeout');
  assert.strictEqual(await selectSignature(() => null, '딱밤', 'tjd', { tries: 2, interval: 1 }), 'no-view');
});
