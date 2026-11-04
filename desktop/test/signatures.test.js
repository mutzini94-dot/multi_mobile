'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { ToonationClient } = require('../lib/toonation');
const { createHandlers } = require('../lib/handlers');

const SIGS = [
  { Hash: 'a-1', Name: '슈퍼맨', Cash: 20000, DonationCount: 88, Enabled: 1, IsRandom: 0, Thumbnail: 1, Message: '{닉네임}님', Volume: 50 },
  { Hash: 'rnd', Name: '랜덤', Cash: 10000, DonationCount: 0, Enabled: 0, IsRandom: 1, Thumbnail: 0 },
];

function fakeSession(calls, { donate = { Conf: { Signature: { Signatures: SIGS } } } } = {}) {
  return {
    fetch: async (url, opts) => {
      calls.push({ url, auth: opts.headers.Authorization });
      if (url.endsWith('/dapi/donator/sign_token')) return new Response('TOKEN123\n', { status: 200 });
      if (url.includes('/dapi/donate/')) return new Response(JSON.stringify(donate), { status: 200 });
      return new Response('', { status: 404 });
    },
  };
}

test('getSignatures: sign_token으로 후원 페이지 정보를 받아 시그니처 목록 (필요한 필드만, 로그인 없이도)', async () => {
  const calls = [];
  const c = new ToonationClient(fakeSession(calls));
  const list = await c.getSignatures('tjd_1');
  assert.deepStrictEqual(calls.map((x) => [x.url, x.auth]), [
    ['https://toon.at/dapi/donator/sign_token', undefined],
    ['https://toon.at/dapi/donate/tjd_1', 'Bearer TOKEN123'],
  ]);
  assert.deepStrictEqual(list, [
    { Hash: 'a-1', Name: '슈퍼맨', Cash: 20000, DonationCount: 88, Enabled: 1, IsRandom: 0, Thumbnail: 1 },
    { Hash: 'rnd', Name: '랜덤', Cash: 10000, DonationCount: 0, Enabled: 0, IsRandom: 1, Thumbnail: 0 },
  ]);
});

test('getSignatures: 시그니처가 없으면 빈 목록', async () => {
  const c = new ToonationClient(fakeSession([], { donate: { Conf: {} } }));
  assert.deepStrictEqual(await c.getSignatures('abc'), []);
});

test('handlers.signatures: 후원 아이디 검사', async () => {
  const h = createHandlers({ client: { getSignatures: async (tag) => [{ Hash: tag }] }, openLogin: () => {}, resolveYouTube: async () => '' });
  assert.deepStrictEqual(await h.signatures('ok_tag'), { ok: true, data: [{ Hash: 'ok_tag' }] });
  assert.deepStrictEqual(await h.signatures('../x'), { ok: false, error: 'BAD_TAG' });
});
