'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createWebStore } = require('../lib/webStore');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mv-webstore-')), 'webstore.json');

test('웹 화면 저장값 사본: 저장하고 다시 읽는다 (mv. 로 시작하는 문자열만)', () => {
  const file = tmp();
  const s = createWebStore(file);
  assert.strictEqual(s.load(), null);
  assert.strictEqual(s.save({ savedAt: 5, data: { 'mv.settings.v1': '{"theme":"dark"}', 'other': 'x', 'mv.bad': 3 } }), true);
  assert.deepStrictEqual(createWebStore(file).load(), { savedAt: 5, data: { 'mv.settings.v1': '{"theme":"dark"}' } });
});

test('이상한 값은 저장하지 않고, 깨진 파일은 null', () => {
  const file = tmp();
  const s = createWebStore(file);
  assert.strictEqual(s.save(null), false);
  assert.strictEqual(s.save({ savedAt: 'x', data: {} }), false);
  assert.strictEqual(s.save({ savedAt: 1, data: { 'mv.big': 'x'.repeat(5_000_001) } }), false);
  fs.writeFileSync(file, '{oops');
  assert.strictEqual(s.load(), null);
});
