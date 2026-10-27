'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { widenForPanel, restoreFromPanel } = require('../lib/windowMath');

const area = { x: 0, y: 0, width: 1920, height: 1040 };

test('오른쪽에 공간이 있으면 오른쪽으로 넓힌다', () => {
  const r = widenForPanel({ x: 100, y: 50, width: 1200, height: 800 }, area, 460);
  assert.deepStrictEqual(r.bounds, { x: 100, y: 50, width: 1660, height: 800 });
  assert.deepStrictEqual(r.shift, { x: 0, width: 460 });
});

test('화면 오른쪽 끝이면 왼쪽으로 밀어서 넓힌다', () => {
  const r = widenForPanel({ x: 600, y: 50, width: 1200, height: 800 }, area, 460);
  assert.deepStrictEqual(r.bounds, { x: 260, y: 50, width: 1660, height: 800 });
  assert.deepStrictEqual(r.shift, { x: 340, width: 460 });
});

test('화면보다 넓어지면 화면 폭에 맞추고, 늘어난 만큼만 되돌린다', () => {
  const r = widenForPanel({ x: 0, y: 0, width: 1700, height: 800 }, area, 460);
  assert.deepStrictEqual(r.bounds, { x: 0, y: 0, width: 1920, height: 800 });
  assert.deepStrictEqual(r.shift, { x: 0, width: 220 });
});

test('닫으면 원래 위치·폭으로 돌아간다', () => {
  const open = widenForPanel({ x: 600, y: 50, width: 1200, height: 800 }, area, 460);
  assert.deepStrictEqual(restoreFromPanel(open.bounds, open.shift), { x: 600, y: 50, width: 1200, height: 800 });
});
