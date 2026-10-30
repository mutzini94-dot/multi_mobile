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

test('원하는 포트로 열고, 이미 쓰는 중이면 빈 포트로 대신 연다', async () => {
  const root = fixture();
  const a = await startStaticServer(root, { port: 0 });
  try {
    const b = await startStaticServer(root, { port: a.port }); // 같은 포트 → 쓰는 중
    try {
      assert.notStrictEqual(b.port, a.port);
      assert.strictEqual((await fetch(`http://127.0.0.1:${b.port}/`)).status, 200);
    } finally {
      await b.close();
    }
    const freePort = a.port;
    await a.close();
    const c = await startStaticServer(root, { port: freePort }); // 비었으면 그 포트 그대로
    assert.strictEqual(c.port, freePort);
    await c.close();
  } catch (e) {
    await a.close().catch(() => {});
    throw e;
  }
});

test('원하는 포트가 잠깐 쓰이는 중이면 몇 번 다시 시도해 그 포트로 연다 (방금 닫힌 이전 실행 등)', async () => {
  const root = fixture();
  const a = await startStaticServer(root, { port: 0 });
  const wanted = a.port;
  setTimeout(() => a.close(), 300); // 0.3초 뒤 비워진다
  const b = await startStaticServer(root, { port: wanted, retries: 5, retryDelayMs: 150 });
  try {
    assert.strictEqual(b.port, wanted);
    assert.strictEqual(b.fallback, false);
  } finally {
    await b.close();
  }
});

test('끝까지 쓰는 중이면 빈 포트로 열고 fallback 표시', async () => {
  const root = fixture();
  const a = await startStaticServer(root, { port: 0 });
  try {
    const b = await startStaticServer(root, { port: a.port, retries: 2, retryDelayMs: 50 });
    assert.notStrictEqual(b.port, a.port);
    assert.strictEqual(b.fallback, true);
    await b.close();
  } finally {
    await a.close();
  }
});
