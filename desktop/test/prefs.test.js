'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPrefs } = require('../lib/prefs');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mv-prefs-')), 'prefs.json');

test('기본값을 돌려주고, 저장하면 파일에 남아 다음 실행에서 읽힌다', () => {
  const file = tmp();
  const a = createPrefs(file, { port: 47230, alwaysOnTop: false });
  assert.strictEqual(a.get('port'), 47230);
  a.set('alwaysOnTop', true);
  a.set('windowBounds', { x: 1, y: 2, width: 800, height: 600 });
  a.flush();
  const b = createPrefs(file, { port: 47230, alwaysOnTop: false });
  assert.strictEqual(b.get('alwaysOnTop'), true);
  assert.deepStrictEqual(b.get('windowBounds'), { x: 1, y: 2, width: 800, height: 600 });
});

test('파일이 깨졌으면 기본값으로 시작한다', () => {
  const file = tmp();
  fs.writeFileSync(file, '{oops');
  assert.strictEqual(createPrefs(file, { port: 1 }).get('port'), 1);
});
