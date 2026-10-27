'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createHandlers } = require('../lib/handlers');
const { NotLoggedInError } = require('../lib/toonation');

const UC = 'UC' + 'd'.repeat(22);

function fakeClient({ account = null, favorites = [], fail } = {}) {
  return {
    getAccount: async () => account,
    getFavorites: async () => {
      if (fail) throw fail;
      return structuredClone(favorites);
    },
  };
}

test('status: 계정 이름·프로필만', async () => {
  const h = createHandlers({ client: fakeClient({ account: { name: '나', profile: 'https://p', cash: 1000 } }), openLogin: () => {}, resolveYouTube: async () => '' });
  assert.deepStrictEqual(await h.status(), { ok: true, data: { account: { name: '나', profile: 'https://p' } } });
});

test('status: 로그아웃이면 account null', async () => {
  const h = createHandlers({ client: fakeClient(), openLogin: () => {}, resolveYouTube: async () => '' });
  assert.deepStrictEqual(await h.status(), { ok: true, data: { account: null } });
});

test('favorites: 필요한 필드만, 유튜브 핸들은 UC로', async () => {
  const h = createHandlers({
    client: fakeClient({ favorites: [{ tag: 't', name: 'A', profile: 'https://p', certified: true, channels: [{ platform: 'twitch', key: 'aaaa', url: 'x' }, { platform: 'youtube', key: '@aa', url: 'y' }] }] }),
    openLogin: () => {},
    resolveYouTube: async (key) => (key === '@aa' ? UC : ''),
    checkLive: async () => new Map(),
  });
  assert.deepStrictEqual(await h.favorites(), {
    ok: true,
    data: [{ tag: 't', name: 'A', profile: 'https://p', channels: [{ platform: 'twitch', key: 'aaaa' }, { platform: 'youtube', key: '@aa', ytId: UC }] }],
  });
});

test('favorites: 로그아웃이면 NOT_LOGGED_IN, 그 밖의 오류는 메시지', async () => {
  const a = createHandlers({ client: fakeClient({ fail: new NotLoggedInError() }), openLogin: () => {}, resolveYouTube: async () => '' });
  assert.deepStrictEqual(await a.favorites(), { ok: false, error: 'NOT_LOGGED_IN' });
  const b = createHandlers({ client: fakeClient({ fail: new Error('HTTP 500 /x') }), openLogin: () => {}, resolveYouTube: async () => '' });
  assert.deepStrictEqual(await b.favorites(), { ok: false, error: 'HTTP 500 /x' });
});

test('login: 로그인 창을 연다', async () => {
  let opened = 0;
  const h = createHandlers({ client: fakeClient(), openLogin: () => opened++, resolveYouTube: async () => '' });
  assert.deepStrictEqual(await h.login(), { ok: true, data: {} });
  assert.strictEqual(opened, 1);
});

test('favorites: 채널마다 라이브 여부·제목·시청자 수를 붙인다 (치지직 채널은 조회하지 않음)', async () => {
  let asked = null;
  const h = createHandlers({
    client: fakeClient({ favorites: [{ tag: 't', name: 'A', profile: '', channels: [{ platform: 'twitch', key: 'aaaa' }, { platform: 'youtube', key: UC }, { platform: 'chzzk', key: 'f'.repeat(32) }] }] }),
    openLogin: () => {},
    resolveYouTube: async () => '',
    checkLive: async (refs) => {
      asked = refs.map((r) => `${r.platform}:${r.key}`);
      return new Map([['twitch:aaaa', { live: true, title: '방송 중', viewers: 120 }], [`youtube:${UC}`, { live: false, title: '', viewers: 0 }]]);
    },
  });
  const r = await h.favorites();
  assert.deepStrictEqual(asked, ['twitch:aaaa', `youtube:${UC}`]);
  assert.deepStrictEqual(r.data[0].channels, [
    { platform: 'twitch', key: 'aaaa', live: true, title: '방송 중', viewers: 120 },
    { platform: 'youtube', key: UC, live: false },
    { platform: 'chzzk', key: 'f'.repeat(32) },
  ]);
});

test('favorites: 라이브 조회가 실패해도 목록은 돌려준다', async () => {
  const h = createHandlers({
    client: fakeClient({ favorites: [{ tag: 't', name: 'A', profile: '', channels: [{ platform: 'twitch', key: 'aaaa' }] }] }),
    openLogin: () => {},
    resolveYouTube: async () => '',
    checkLive: async () => { throw new Error('gql down'); },
  });
  const r = await h.favorites();
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.data[0].channels, [{ platform: 'twitch', key: 'aaaa' }]);
});
