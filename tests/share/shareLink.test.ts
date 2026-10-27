import { buildShareUrl, decodeShare, encodeShare } from '../../src/share/shareLink';
import { mkCreator } from '../helpers/fixtures';
import type { ViewState } from '../../src/domain/types';

const state: ViewState = {
  layout: 'oneTwo',
  slots: [mkCreator(1, { name: '크리에이터A' }), null, mkCreator(3)],
  sizes: { root: [60, 40] },
  selected: 2,
  soundOn: false,
};

const b64 = (obj: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return '#s=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const payload = (over: Record<string, unknown> = {}) => ({
  v: 1,
  layout: 'split2',
  sizes: {},
  slots: [{ name: 'A', donateId: 'abc', platform: 'twitch', channel: 'foo_bar' }, null],
  ...over,
});

test('한글 이름 포함 왕복, 크리에이터는 link 출처', () => {
  const hash = encodeShare(state);
  expect(hash.startsWith('#s=')).toBe(true);
  const out = decodeShare(hash)!;
  expect(out.layout).toBe('oneTwo');
  expect(out.sizes).toEqual({ root: [60, 40] });
  expect(out.slots[0]).toEqual({ ...mkCreator(1, { name: '크리에이터A' }), source: 'link' });
  expect(out.slots[1]).toBeNull();
  expect(out.selected).toBeNull();
  expect(out.soundOn).toBe(true);
});

test('buildShareUrl은 기존 hash를 교체', () => {
  const url = buildShareUrl(state, 'http://localhost:5230/?a=1#old');
  expect(url.startsWith('http://localhost:5230/?a=1#s=')).toBe(true);
});

test('링크에는 보이는 칸만 담고, 읽을 때 4칸으로 채운다', () => {
  const hidden: ViewState = { layout: 'split2', slots: [mkCreator(1), mkCreator(2), mkCreator(3), null], sizes: {}, selected: null, soundOn: true };
  const out = decodeShare(encodeShare(hidden))!;
  expect(out.slots.map((c) => c?.name ?? null)).toEqual(['크리에이터1', '크리에이터2', null, null]);
});

test("'#s='로 시작하지 않으면 null", () => expect(decodeShare('#x=abc')).toBeNull());
test('base64가 깨지면 null', () => expect(decodeShare('#s=@@@')).toBeNull());
test('JSON이 아니면 null', () => expect(decodeShare('#s=' + btoa('nope'))).toBeNull());
test('v !== 1이면 null', () => expect(decodeShare(b64(payload({ v: 2 })))).toBeNull());
test('slots 길이가 맞지 않으면 null', () => expect(decodeShare(b64(payload({ slots: [null] })))).toBeNull());
test("donateId가 '../evil'이면 null", () =>
  expect(decodeShare(b64(payload({ slots: [{ name: 'A', donateId: '../evil', platform: 'twitch', channel: 'foo_bar' }, null] })))).toBeNull());
test('layout이 알 수 없는 값이면 null', () => expect(decodeShare(b64(payload({ layout: 'grid9' })))).toBeNull());
test('sizes가 숫자 배열이 아니면 {}로 무시', () => {
  const out = decodeShare(b64(payload({ sizes: { root: ['x'] } })));
  expect(out).not.toBeNull();
  expect(out!.sizes).toEqual({});
});
