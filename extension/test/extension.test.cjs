'use strict';
// background.js / content/bridge.js 를 vm에서 가짜 chrome API·fetch·window로 실행해 확인한다.
// 실행: node --test extension/test/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const UC = 'UC' + 'c'.repeat(22);
// vm 컨텍스트에서 만든 객체는 프로토타입이 달라 deepStrictEqual 전에 평탄화한다
const plain = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

function loadBackground(world) {
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => (listeners[name] ||= []).push(fn) });
  const rules = [];
  const tabsCreated = [];
  const local = {};
  const removed = [];
  const chrome = {
    runtime: { id: 'ext-id', onMessage: on('message') },
    tabs: { create: async (o) => { tabsCreated.push(o); return { id: 9 }; } },
    storage: {
      local: {
        get: async (k) => Object.fromEntries([].concat(k).filter((x) => x in local).map((x) => [x, structuredClone(local[x])])),
        set: async (o) => Object.assign(local, structuredClone(o)),
      },
    },
    cookies: {
      // toon.at 세션 쿠키는 https://toon.at 파티션에만 있다
      getAll: async (q) => {
        if (!world.loggedIn) return [];
        if (q.partitionKey) return [{ name: '__toonation_session_id__', value: 'SID', domain: '.toon.at', hostOnly: false, path: '/', partitionKey: q.partitionKey }];
        return q.domain === 'toon.at' ? [{ name: 'toon_login', value: 'T', domain: 'toon.at', hostOnly: true, path: '/donator' }] : [];
      },
      remove: async (d) => {
        removed.push(d);
        world.loggedIn = false;
        return d;
      },
    },
    declarativeNetRequest: {
      updateSessionRules: async ({ removeRuleIds = [], addRules = [] }) => {
        rules.splice(0, rules.length, ...rules.filter((r) => !removeRuleIds.includes(r.id)), ...addRules);
      },
    },
  };
  const json = (o) => ({ ok: true, status: 200, url: '', text: async () => JSON.stringify(o), clone() { return this; } });
  const html = (s) => ({ ok: true, status: 200, url: '', text: async () => s, clone() { return this; } });
  const fetch = async (url) => {
    world.fetched.push(String(url));
    if (url.includes('/dapi/donator/common')) return json({ Account: world.loggedIn ? { DisplayName: '나', TitleHash: 'h', Cash: 1200 } : null });
    if (url.includes('/dapi/donator/mypage/donation_history')) {
      if (!world.loggedIn) return html('<html>login</html>');
      const page = Number(new URL(url).searchParams.get('page'));
      return json({ Data: world.history[page - 1] || [], PageInfo: { PageCount: world.history.length } });
    }
    if (url.includes('/dapi/donator/favorites/')) {
      if (!world.loggedIn) return html('<html>login</html>');
      return json({ list: world.favorites, PageInfo: { PageCount: 1 } });
    }
    if (url === 'https://gql.twitch.tv/gql') {
      return json({ data: { users: [{ login: 'aaaa', displayName: 'A', stream: world.twitchLive ? { title: '방송 중', viewersCount: 120 } : null }] } });
    }
    if (url.startsWith('https://www.youtube.com/channel/') && url.endsWith('/live')) return html('<html></html>');
    if (url.startsWith('https://www.youtube.com/@')) return html(`<link rel="canonical" href="https://www.youtube.com/channel/${UC}">`);
    throw new Error(`unexpected fetch ${url}`);
  };
  const ctx = { chrome, fetch, console, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, structuredClone, Promise };
  ctx.self = ctx;
  ctx.importScripts = (...files) => files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8'), ctx, { filename: 'background.js' });
  const send = (msg, sender = { id: 'ext-id', tab: { id: 1 }, origin: 'http://localhost:5230' }) =>
    new Promise((resolve) => {
      const ret = listeners.message[0](msg, sender, (r) => resolve(plain(r)));
      if (ret !== true) resolve(undefined);
    });
  return { send, rules, tabsCreated, removed };
}

const world = (o = {}) => ({ loggedIn: false, favorites: [], fetched: [], twitchLive: false, history: [], ...o });

test('status: 로그아웃 상태', async () => {
  const { send } = loadBackground(world());
  assert.deepStrictEqual(await send({ type: 'status' }), { ok: true, data: { account: null } });
});

test('status: 로그인 상태면 계정 이름, toon.at 요청에 세션 쿠키 규칙', async () => {
  const { send, rules } = loadBackground(world({ loggedIn: true }));
  const r = await send({ type: 'status' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data.account.name, '나');
  const rule = rules.find((x) => x.id === 1);
  assert.ok(rule.action.requestHeaders.some((h) => h.header === 'cookie' && h.value === '__toonation_session_id__=SID'));
  assert.deepStrictEqual(plain(rule.condition.initiatorDomains), ['ext-id']);
});

test('favorites: 필요한 필드만, 유튜브 핸들은 UC로 변환', async () => {
  const { send } = loadBackground(world({
    loggedIn: true,
    favorites: [{ tag: 'tagA', name: 'A', profile_default: 'https://img/a.png', channel: [{ url: 'https://twitch.tv/aaaa' }, { url: 'https://www.youtube.com/@aa' }], secret: 'x' }],
  }));
  const r = await send({ type: 'favorites' });
  assert.deepStrictEqual(r, {
    ok: true,
    data: [{ tag: 'tagA', name: 'A', profile: 'https://img/a.png', channels: [{ platform: 'twitch', key: 'aaaa', live: false }, { platform: 'youtube', key: '@aa', ytId: UC, live: false }] }],
  });
});

test('favorites: 라이브 중인 채널에 제목·시청자 수를 붙인다', async () => {
  const { send } = loadBackground(world({
    loggedIn: true,
    twitchLive: true,
    favorites: [{ tag: 'tagA', name: 'A', channel: [{ url: 'https://twitch.tv/aaaa' }] }],
  }));
  const r = await send({ type: 'favorites' });
  assert.deepStrictEqual(r.data[0].channels, [{ platform: 'twitch', key: 'aaaa', live: true, title: '방송 중', viewers: 120 }]);
});

test('favorites: 로그아웃이면 NOT_LOGGED_IN', async () => {
  const { send } = loadBackground(world());
  assert.deepStrictEqual(await send({ type: 'favorites' }), { ok: false, error: 'NOT_LOGGED_IN' });
});

test('history: 후원 내역을 모아 필요한 필드만 (Time은 KST 문자열)', async () => {
  const recent = new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const w = world({ loggedIn: true, history: [[{ Time: recent, LinkTag: 'tg', StreamerName: '스트리머', Cash: '3000', Message: '비밀', Name: '나' }], [{ Time: '2020-01-01 00:00:00', LinkTag: 'old', StreamerName: '옛날', Cash: 1 }]] });
  const { send } = loadBackground(w);
  const r = await send({ type: 'history' });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.data.map(({ tag, creator, cash }) => ({ tag, creator, cash })), [{ tag: 'tg', creator: '스트리머', cash: 3000 }]);
  assert.ok(r.data[0].at > 0);
});

test('status: 캐시 잔액을 함께', async () => {
  const { send } = loadBackground(world({ loggedIn: true }));
  assert.deepStrictEqual((await send({ type: 'status' })).data.account.cash, 1200);
});

test('login: 공식 로그인 창을 연다', async () => {
  const { send, tabsCreated } = loadBackground(world());
  assert.deepStrictEqual(await send({ type: 'login' }), { ok: true, data: {} });
  assert.deepStrictEqual(plain(tabsCreated), [{ url: 'https://toon.at/donator/login?callback=/donator' }]);
});

test('logout: toon.at 로그인 쿠키(파티션 포함)를 지운다', async () => {
  const w = world({ loggedIn: true });
  const { send, removed } = loadBackground(w);
  assert.deepStrictEqual(await send({ type: 'logout' }), { ok: true, data: {} });
  assert.deepStrictEqual(plain(removed).sort((a, b) => a.name.localeCompare(b.name)), [
    { url: 'https://toon.at/', name: '__toonation_session_id__', partitionKey: { topLevelSite: 'https://toon.at' } },
    { url: 'https://toon.at/donator', name: 'toon_login' },
  ]);
  assert.deepStrictEqual(await send({ type: 'status' }), { ok: true, data: { account: null } });
});

test('탭이 아닌 곳이나 다른 확장의 메시지는 무시', async () => {
  const { send } = loadBackground(world({ loggedIn: true }));
  assert.strictEqual(await send({ type: 'status' }, { id: 'ext-id' }), undefined);
  assert.strictEqual(await send({ type: 'status' }, { id: 'other', tab: { id: 1 } }), undefined);
});

test('알 수 없는 요청', async () => {
  const { send } = loadBackground(world());
  assert.deepStrictEqual(await send({ type: 'cookies' }), { ok: false, error: 'UNKNOWN_REQUEST' });
});

// ---------------------------------------------------------------- content/bridge.js

function loadBridge(response) {
  const listeners = [];
  const posted = [];
  const sent = [];
  const win = {
    location: { origin: 'http://localhost:5230' },
    addEventListener: (t, fn) => t === 'message' && listeners.push(fn),
    postMessage: (data, origin) => posted.push({ data, origin }),
  };
  win.window = win;
  const chrome = { runtime: { sendMessage: async (m) => { sent.push(m); return response; } } };
  const ctx = vm.createContext({ window: win, location: win.location, chrome, Promise, String });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'content/bridge.js'), 'utf8'), ctx);
  const dispatch = (ev) => listeners.forEach((fn) => fn(ev));
  return { win, posted, sent, dispatch };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test('bridge: 같은 페이지의 요청을 중계하고 응답을 돌려준다', async () => {
  const b = loadBridge({ ok: true, data: { account: null } });
  b.dispatch({ source: b.win, origin: 'http://localhost:5230', data: { source: 'mv-page', id: 'r1', type: 'status' } });
  await tick();
  assert.deepStrictEqual(plain(b.sent), [{ type: 'status' }]);
  assert.deepStrictEqual(plain(b.posted), [{ data: { source: 'mv-ext', id: 'r1', ok: true, data: { account: null } }, origin: 'http://localhost:5230' }]);
});

test('bridge: 다른 창·다른 출처·모르는 요청은 무시', async () => {
  const b = loadBridge({ ok: true, data: {} });
  b.dispatch({ source: {}, origin: 'http://localhost:5230', data: { source: 'mv-page', id: 'a', type: 'status' } });
  b.dispatch({ source: b.win, origin: 'https://evil.example', data: { source: 'mv-page', id: 'b', type: 'status' } });
  b.dispatch({ source: b.win, origin: 'http://localhost:5230', data: { source: 'mv-page', id: 'c', type: 'cookies' } });
  b.dispatch({ source: b.win, origin: 'http://localhost:5230', data: { source: 'mv-ext', id: 'd', type: 'status' } });
  await tick();
  assert.deepStrictEqual(b.sent, []);
  assert.deepStrictEqual(b.posted, []);
});

test('bridge: 확장 오류는 ok:false로 돌려준다', async () => {
  const ctxFail = loadBridge(null);
  ctxFail.dispatch({ source: ctxFail.win, origin: 'http://localhost:5230', data: { source: 'mv-page', id: 'e', type: 'favorites' } });
  await tick();
  assert.deepStrictEqual(plain(ctxFail.posted[0].data), { source: 'mv-ext', id: 'e', ok: false, error: 'NO_RESPONSE' });
});

test('manifest: 필요한 권한만, 멀티뷰 주소에서만 중계', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.strictEqual(m.manifest_version, 3);
  assert.deepStrictEqual(m.permissions.sort(), ['cookies', 'declarativeNetRequestWithHostAccess', 'storage']);
  assert.deepStrictEqual(m.host_permissions.sort(), ['https://gql.twitch.tv/*', 'https://toon.at/*', 'https://www.youtube.com/*']);
  assert.deepStrictEqual(m.content_scripts, [{ matches: ['http://localhost:5230/*', 'http://127.0.0.1:5230/*'], js: ['content/bridge.js'], run_at: 'document_start' }]);
  assert.strictEqual(m.externally_connectable, undefined);
});
