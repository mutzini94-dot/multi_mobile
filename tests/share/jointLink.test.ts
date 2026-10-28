import { buildJointUrl, decodeJoint, encodeJoint, publicBase } from '../../src/share/jointLink';
import { mkCreator } from '../helpers/fixtures';
import type { ViewState } from '../../src/domain/types';
import { makeDonatePage } from '../../src/domain/pages';

const host = mkCreator(9, { name: '호스트님', donateId: 'hostTag' });
const state: ViewState = {
  layout: 'oneTwo',
  slots: [host, mkCreator(2, { name: '게스트B' }), null, mkCreator(4)], // 4번 칸은 레이아웃에서 숨겨진 칸
  sizes: { 'oneTwo:root': [60, 40] },
  selected: 1,
  soundOn: false,
};

const b64 = (obj: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return '#j=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const payload = (over: Record<string, unknown> = {}) => ({
  v: 2,
  layout: 'split2',
  sizes: {},
  host: { name: 'H', donateId: 'hostTag', platform: 'twitch', channel: 'host_ch' },
  guests: [{ name: 'G', donateId: 'g1', platform: 'twitch', channel: 'guest_ch' }],
  ...over,
});

test('왕복: 호스트는 1번 칸, 보이는 게스트 칸만 담기고 4칸으로 채워진다', () => {
  const hash = encodeJoint(host, state);
  expect(hash.startsWith('#j=')).toBe(true);
  const out = decodeJoint(hash)!;
  expect(out.host).toEqual({ ...host, source: 'link' });
  expect(out.state.layout).toBe('oneTwo');
  expect(out.state.slots.map((c) => c?.name ?? null)).toEqual(['호스트님', '게스트B', null, null]);
  expect(out.state.slots[0]).toEqual(out.host);
  expect(out.state.sizes).toEqual({ 'oneTwo:root': [60, 40] });
  expect(out.state.selected).toBeNull();
  expect(out.state.soundOn).toBe(true);
});

test('buildJointUrl은 주어진 시청 페이지 주소에 해시를 붙인다', () => {
  expect(buildJointUrl(host, state, 'https://mv.example.com/watch?x=1#old').startsWith('https://mv.example.com/watch?x=1#j=')).toBe(true);
});

test('예전 #s= 링크, 깨진 값, 버전 불일치는 null', () => {
  expect(decodeJoint('#s=abc')).toBeNull();
  expect(decodeJoint('#j=@@@')).toBeNull();
  expect(decodeJoint(b64(payload({ v: 1 })))).toBeNull();
});

test('호스트가 없거나 잘못되면 null (후원 대상이 확실해야 함)', () => {
  expect(decodeJoint(b64(payload({ host: null })))).toBeNull();
  expect(decodeJoint(b64(payload({ host: { name: 'H', donateId: '../evil', platform: 'twitch', channel: 'host_ch' } })))).toBeNull();
});

test('게스트 수가 레이아웃과 맞지 않거나 게스트가 잘못되면 null', () => {
  expect(decodeJoint(b64(payload({ guests: [] })))).toBeNull();
  expect(decodeJoint(b64(payload({ guests: [{ name: 'G', donateId: 'g1', platform: 'kick', channel: 'x' }] })))).toBeNull();
  expect(decodeJoint(b64(payload({ layout: 'single', guests: [] })))).not.toBeNull();
});

describe('publicBase (시청 페이지 주소)', () => {
  test('공개 주소에서 연 웹이면 그 주소(해시 제외)', () => {
    expect(publicBase('https://mv.example.com/app/?a=1#j=x', null)).toBe('https://mv.example.com/app/?a=1');
  });
  test('localhost·127.0.0.1이면 저장한 주소, 없으면 null', () => {
    expect(publicBase('http://localhost:5230/', null)).toBeNull();
    expect(publicBase('http://127.0.0.1:1363/', 'https://mv.example.com/')).toBe('https://mv.example.com/');
  });
  test('저장한 주소가 http(s)가 아니면 무시', () => {
    expect(publicBase('http://localhost:5230/', 'javascript:alert(1)')).toBeNull();
  });
});

test('후원 페이지·웹페이지 칸은 합방 링크에 담지 않는다 (빈 칸)', () => {
  const host = mkCreator(1);
  const state: ViewState = { layout: 'split2', slots: [host, makeDonatePage(), null, null], sizes: {}, selected: null, soundOn: true };
  expect(decodeJoint(encodeJoint(host, state))!.state.slots.map((s) => s && s.name)).toEqual([host.name, null, null, null]);
});
