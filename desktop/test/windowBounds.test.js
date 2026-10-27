'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { restoreBounds } = require('../lib/windowBounds');

const areas = [{ x: 0, y: 0, width: 1920, height: 1040 }];
const fallback = { x: 10, y: 10, width: 800, height: 600 };

test('저장한 위치가 화면 안이면 그대로', () => {
  assert.deepStrictEqual(restoreBounds({ x: 100, y: 50, width: 1200, height: 800 }, areas, fallback), { x: 100, y: 50, width: 1200, height: 800 });
});

test('모니터를 빼서 화면 밖이면 기본 위치', () => {
  assert.deepStrictEqual(restoreBounds({ x: 2500, y: 100, width: 800, height: 600 }, areas, fallback), fallback);
});

test('조금만 걸쳐 있으면(100px 미만) 기본 위치, 값이 이상하면 기본 위치', () => {
  assert.deepStrictEqual(restoreBounds({ x: 1850, y: 100, width: 800, height: 600 }, areas, fallback), fallback);
  assert.deepStrictEqual(restoreBounds({ x: 'a', y: 0, width: 10, height: 10 }, areas, fallback), fallback);
  assert.deepStrictEqual(restoreBounds(null, areas, fallback), fallback);
});

test('최소 크기보다 작게 저장돼 있으면 최소 크기로', () => {
  assert.deepStrictEqual(restoreBounds({ x: 100, y: 100, width: 200, height: 100 }, areas, fallback, { width: 720, height: 480 }), { x: 100, y: 100, width: 720, height: 480 });
});
