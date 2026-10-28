'use strict';
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { fillAmountScript } = require('../lib/donateFill');

test('후원금액 채우기 스크립트: 올바른 JS이고 천 단위 쉼표 금액을 넣는다', () => {
  const code = fillAmountScript(5000);
  assert.doesNotThrow(() => new vm.Script(code));
  assert.match(code, /"5,000"/);
});

test('잘못된 금액은 거부한다', () => {
  for (const bad of [0, -1, 1.5, NaN, 2e9, '1000']) assert.throws(() => fillAmountScript(bad));
});

const { fillMessageScript } = require('../lib/donateFill');

test('후원 메시지 채우기 스크립트: 올바른 JS, 따옴표·스크립트 문자도 문자열로만 들어간다', () => {
  const code = fillMessageScript('안녕하세요 "방송" </script>`${x}`');
  assert.doesNotThrow(() => new vm.Script(code));
  assert.ok(code.includes(JSON.stringify('안녕하세요 "방송" </script>`${x}`')));
});

test('후원 메시지 채우기: 페이지의 보이는 textarea에 넣는다 (가짜 DOM)', () => {
  let value = '';
  const ta = { tagName: 'TEXTAREA', maxLength: 10, getBoundingClientRect: () => ({ height: 20 }), focus() {}, blur() {}, dispatchEvent() {} };
  const ctx = {
    document: { querySelectorAll: (sel) => (sel === '#baselayout textarea' ? [ta] : []) },
    HTMLTextAreaElement: function () {},
    Event: function () {},
  };
  Object.defineProperty(ctx.HTMLTextAreaElement, 'prototype', { value: {} });
  Object.defineProperty(ctx.HTMLTextAreaElement.prototype, 'value', { set: function (v) { value = v; }, configurable: true });
  assert.strictEqual(vm.runInNewContext(fillMessageScript('가나다라마바사아자차카타'), ctx), true);
  assert.strictEqual(value, '가나다라마바사아자차'); // maxLength 10
});

test('잘못된 메시지는 거부한다', () => {
  for (const bad of ['', '   ', 'x'.repeat(301), 3]) assert.throws(() => fillMessageScript(bad));
});
