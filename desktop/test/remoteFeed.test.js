'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { extractAlertboxKey, parsePayload, toDonation, maskAccount, ToonationFeed } = require('../lib/remoteFeed');

test('알림창 URL 전체나 키만 넣어도 키를 뽑는다', () => {
  assert.strictEqual(extractAlertboxKey('https://toon.at/widget/alertbox/abcDEF123_-x'), 'abcDEF123_-x');
  assert.strictEqual(extractAlertboxKey('  abcdefgh12  '), 'abcdefgh12');
  assert.strictEqual(extractAlertboxKey('short'), null);
  assert.strictEqual(extractAlertboxKey(''), null);
  assert.strictEqual(extractAlertboxKey('https://evil/../x y'), null);
});

test('알림창 페이지에서 payload 값을 찾는다', () => {
  assert.strictEqual(parsePayload('var a = {"payload": "Zx9y8"};'), 'Zx9y8');
  assert.strictEqual(parsePayload('<html></html>'), null);
});

test('101 메시지만 후원으로 바꾸고 계정은 가린다', () => {
  assert.strictEqual(toDonation({ code: 100, content: {} }), null);
  assert.strictEqual(toDonation({ code: 101 }), null);
  const d = toDonation({ code: '101', content: { name: '홍길동', account: 'hong1234@gmail.com', amount: '1,000', message: '안녕' } }, 1000);
  assert.strictEqual(d.kind, 'text');
  assert.strictEqual(d.nickname, '홍길동');
  assert.strictEqual(d.account, 'hong***@gmail.com');
  assert.strictEqual(d.cash, 1000);
  assert.strictEqual(d.text, '안녕');
  assert.strictEqual(d.createdAt, 1000);
  assert.strictEqual(d.donorId, 'live-hong1234@gmail.com');
  const v = toDonation({ code: 101, content: { nickname: 'a', video_info: { title: '노래', url: 'https://y' } } });
  assert.strictEqual(v.kind, 'video');
  assert.strictEqual(v.title, '노래');
  assert.strictEqual(v.nickname, 'a');
  assert.strictEqual(toDonation({ code: 101, content: { roulette: { result: '꽝' } } }).item, '꽝');
  assert.strictEqual(toDonation({ code: 101, content: {} }).nickname, '익명');
  assert.strictEqual(maskAccount('abc'), 'abc***');
});

class FakeWs extends EventEmitter {
  static last = null;
  constructor(url, opts) {
    super();
    this.url = url;
    this.opts = opts;
    this.readyState = 0;
    this.pings = 0;
    FakeWs.last = this;
  }
  ping() {
    this.pings++;
  }
  terminate() {
    this.terminated = true;
  }
}
FakeWs.OPEN = 1;

function feed(fetchImpl) {
  const statuses = [];
  const donations = [];
  const raws = [];
  const f = new ToonationFeed({
    onStatus: (s) => statuses.push(s),
    onDonation: (d) => donations.push(d),
    onRaw: (r) => raws.push(r),
    fetch: fetchImpl,
    WebSocket: FakeWs,
  });
  return { f, statuses, donations, raws };
}
const page = (body, status = 200) => async (url, init) => ({ ok: status === 200, status, text: async () => body, url, init });

test('알림창 페이지를 읽고 toon.at 출처로 웹소켓을 연 뒤 후원을 넘긴다', async () => {
  let asked;
  const { f, statuses, donations, raws } = feed(async (url, init) => {
    asked = url;
    return page('{"payload":"PAY123"}')(url, init);
  });
  const p = f.connect('https://toon.at/widget/alertbox/mykey1234');
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(asked, 'https://toon.at/widget/alertbox/mykey1234');
  const ws = FakeWs.last;
  assert.strictEqual(ws.url, 'wss://ws.toon.at/PAY123');
  assert.strictEqual(ws.opts.headers.Origin, 'https://toon.at');
  ws.readyState = 1;
  ws.emit('open');
  assert.deepStrictEqual(await p, { ok: true });
  ws.emit('message', Buffer.from(JSON.stringify({ code: 101, content: { name: '철수', amount: 500 } })));
  ws.emit('message', Buffer.from('not json'));
  assert.strictEqual(donations.length, 1);
  assert.strictEqual(donations[0].nickname, '철수');
  assert.strictEqual(raws.length, 1);
  assert.deepStrictEqual(statuses.map((s) => s.state), ['off', 'connecting', 'connected', 'connected']);
  assert.strictEqual(statuses.at(-1).received, 1);
  f.disconnect();
  assert.ok(ws.terminated);
  assert.strictEqual(statuses.at(-1).state, 'off');
});

test('키가 틀리면(404·payload 없음) 다시 시도하지 않고 멈춘다', async () => {
  const a = feed(page('', 404));
  const r = await a.f.connect('mykey1234');
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(a.statuses.at(-1), { state: 'error', message: r.error, retrying: false });
  const b = feed(page('<html>'));
  assert.strictEqual((await b.f.connect('mykey1234')).ok, false);
  assert.strictEqual(b.statuses.at(-1).retrying, false);
  const c = feed(page(''));
  assert.match((await c.f.connect('x')).error, /알림창 URL/);
  for (const x of [a, b, c]) x.f.disconnect();
});
