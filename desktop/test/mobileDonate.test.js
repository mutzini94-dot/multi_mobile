'use strict';
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { mobileUa, mobileUaScript, useMobileDonatePage } = require('../lib/mobileDonate');

/** 페이지 스크립트처럼 실행해 본다 (Navigator.prototype에 원래 userAgent getter가 있는 환경) */
function run(href) {
  class Navigator {
    get userAgent() {
      return 'Desktop UA';
    }
  }
  const navigator = new Navigator();
  const ctx = { Navigator, navigator, location: new URL(href), Object };
  vm.runInNewContext(mobileUaScript('130.0.0.0'), ctx);
  return navigator.userAgent;
}

test('모바일 UA: 투네이션 페이지의 모바일 판별(Android … Mobile)에 걸리고 크롬 버전을 따른다', () => {
  const ua = mobileUa('130.0.0.0');
  assert.match(ua, /Android/);
  assert.match(ua, /Mobile Safari/);
  assert.match(ua, /Chrome\/130\.0\.0\.0/);
});

test('후원 페이지(toon.at/donate/…)에서만 페이지가 보는 UA를 모바일로', () => {
  assert.strictEqual(run('https://toon.at/donate/abc'), mobileUa('130.0.0.0'));
  assert.strictEqual(run('https://toon.at/donator/account/charge'), 'Desktop UA', '충전 등 다른 페이지는 그대로');
  assert.strictEqual(run('https://evil.example/donate/abc'), 'Desktop UA');
  assert.strictEqual(run('https://challenges.cloudflare.com/x'), 'Desktop UA', 'Turnstile 등 다른 출처는 그대로');
});

function fakeWc({ attachThrows = false, url = '' } = {}) {
  const sent = [];
  return {
    sent,
    reloads: 0,
    getURL: () => url,
    reload() {
      this.reloads++;
    },
    debugger: {
      isAttached: () => false,
      attach() {
        if (attachThrows) throw new Error('already attached');
      },
      sendCommand(method, params) {
        sent.push([method, params]);
        return Promise.resolve({});
      },
    },
  };
}

test('useMobileDonatePage: 페이지 스크립트보다 먼저 실행되게 등록 (Page.addScriptToEvaluateOnNewDocument)', async () => {
  const wc = fakeWc();
  assert.strictEqual(await useMobileDonatePage(wc, '130.0.0.0'), true);
  const add = wc.sent.find(([m]) => m === 'Page.addScriptToEvaluateOnNewDocument');
  assert.ok(add);
  assert.strictEqual(add[1].source, mobileUaScript('130.0.0.0'));
});

test('useMobileDonatePage: 디버거를 붙일 수 없으면(개발자 도구 등) PC판 그대로 두고 오류 없이 false', async () => {
  assert.strictEqual(await useMobileDonatePage(fakeWc({ attachThrows: true }), '130.0.0.0'), false);
});

test('useMobileDonatePage: 등록 전에 이미 후원 페이지를 열기 시작했으면 한 번 다시 불러 모바일판으로', async () => {
  const early = fakeWc({ url: 'https://toon.at/donate/abc' });
  await useMobileDonatePage(early, '130.0.0.0');
  assert.strictEqual(early.reloads, 1);
  const blank = fakeWc({ url: '' });
  await useMobileDonatePage(blank, '130.0.0.0');
  assert.strictEqual(blank.reloads, 0, '아직 아무것도 안 열었으면 그대로 (다음 문서부터 적용)');
});
