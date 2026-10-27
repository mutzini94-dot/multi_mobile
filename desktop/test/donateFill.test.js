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
