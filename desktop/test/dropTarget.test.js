'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { dropTarget, soloPlacement } = require('../lib/dropTarget');

const main = { bounds: { x: 0, y: 0, width: 1400, height: 860 }, visible: true };
const solos = [
  { id: 'd1', bounds: { x: 1500, y: 100, width: 720, height: 444 }, visible: true },
  { id: 'd2', bounds: { x: 1500, y: 700, width: 720, height: 444 }, visible: true },
];

test('분리 창에서 끌어 메인 창 위에 놓으면: 메인 창 안 좌표', () => {
  // d1 화면 안 (-1000, 200) = 화면 (500, 300)
  assert.deepStrictEqual(dropTarget({ source: 'd1', client: { x: -1000, y: 200 }, main, solos }), { where: 'main', x: 500, y: 300 });
});

test('끄는 창 안에서 놓으면 self, 다른 분리 창 위면 solo, 아무 창도 없으면 outside(화면 좌표)', () => {
  assert.deepStrictEqual(dropTarget({ source: 'd1', client: { x: 100, y: 100 }, main, solos }), { where: 'self' });
  assert.deepStrictEqual(dropTarget({ source: 'd1', client: { x: 50, y: 700 }, main, solos }), { where: 'solo', id: 'd2' });
  assert.deepStrictEqual(dropTarget({ source: 'main', client: { x: 1450, y: 50 }, main, solos }), { where: 'outside', x: 1450, y: 50 });
});

test('메인 창 위에 분리 창이 겹쳐 있어도 끄는 창 자신이 먼저, 숨긴·최소화한 창은 건너뛴다', () => {
  const over = [{ id: 'd1', bounds: { x: 100, y: 100, width: 400, height: 300 }, visible: true }];
  assert.deepStrictEqual(dropTarget({ source: 'd1', client: { x: 10, y: 10 }, main, solos: over }), { where: 'self' });
  assert.deepStrictEqual(dropTarget({ source: 'd1', client: { x: -50, y: 10 }, main, solos: over }), { where: 'main', x: 50, y: 110 });
  assert.deepStrictEqual(dropTarget({ source: 'd1', client: { x: -50, y: 10 }, main: { ...main, visible: false }, solos: over }), { where: 'outside', x: 50, y: 110 });
});

test('잘못된 좌표는 무시한다', () => {
  assert.strictEqual(dropTarget({ source: 'd1', client: { x: NaN, y: 1 }, main, solos }), null);
  assert.strictEqual(dropTarget({ source: 'zz', client: { x: 1, y: 1 }, main, solos }), null, '모르는 창');
});

test('새 분리 창 자리: 커서가 창 위쪽 가운데쯤, 화면 밖으로 나가지 않게', () => {
  const areas = [{ x: 0, y: 0, width: 1920, height: 1040 }];
  assert.deepStrictEqual(soloPlacement({ x: 1000, y: 500 }, { width: 720, height: 444 }, areas), { x: 640, y: 480, width: 720, height: 444 });
  assert.deepStrictEqual(soloPlacement({ x: 1900, y: 1030 }, { width: 720, height: 444 }, areas), { x: 1200, y: 596, width: 720, height: 444 });
  assert.deepStrictEqual(soloPlacement({ x: 5, y: 5 }, { width: 720, height: 444 }, areas), { x: 0, y: 0, width: 720, height: 444 });
  // 두 번째 화면 위면 그 화면 안에
  const two = [...areas, { x: 1920, y: 0, width: 1280, height: 1000 }];
  assert.deepStrictEqual(soloPlacement({ x: 3150, y: 100 }, { width: 720, height: 444 }, two), { x: 2480, y: 80, width: 720, height: 444 });
});
