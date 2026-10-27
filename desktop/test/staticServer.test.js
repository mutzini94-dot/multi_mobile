'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startStaticServer } = require('../lib/staticServer');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-static-'));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>mv</title>');
  fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'console.log(1)');
  fs.writeFileSync(path.join(path.dirname(root), 'mv-secret.txt'), 'secret');
  return root;
}

test('index.html, 정적 파일, content-type, 127.0.0.1에서만 대기', async () => {
  const srv = await startStaticServer(fixture());
  try {
    assert.strictEqual(srv.host, '127.0.0.1');
    const home = await fetch(`http://127.0.0.1:${srv.port}/`);
    assert.strictEqual(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.match(await home.text(), /<title>mv<\/title>/);
    const js = await fetch(`http://127.0.0.1:${srv.port}/assets/app.js?v=1`);
    assert.strictEqual(js.status, 200);
    assert.match(js.headers.get('content-type'), /javascript/);
  } finally {
    await srv.close();
  }
});

test('없는 파일은 404, 상위 폴더 접근은 막는다', async () => {
  const srv = await startStaticServer(fixture());
  try {
    assert.strictEqual((await fetch(`http://127.0.0.1:${srv.port}/nope.js`)).status, 404);
    for (const p of ['/..%2fmv-secret.txt', '/%2e%2e/mv-secret.txt', '/assets/..%5c..%5cmv-secret.txt']) {
      const r = await fetch(`http://127.0.0.1:${srv.port}${p}`);
      assert.ok(r.status === 404 || r.status === 400, `${p} → ${r.status}`);
      assert.doesNotMatch(await r.text(), /secret/);
    }
  } finally {
    await srv.close();
  }
});

test('GET/HEAD 외의 요청은 405', async () => {
  const srv = await startStaticServer(fixture());
  try {
    assert.strictEqual((await fetch(`http://127.0.0.1:${srv.port}/`, { method: 'POST' })).status, 405);
  } finally {
    await srv.close();
  }
});
