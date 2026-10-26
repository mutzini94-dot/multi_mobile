import { makeCreator, normalizeChannel, normalizeDonateId } from '../../src/domain/creatorInput';

const UC = 'UC' + 'a'.repeat(22);

test.each([
  [UC, UC],
  [`https://www.youtube.com/channel/${UC}`, UC],
  [`  https://youtube.com/channel/${UC}/live `, UC],
])('유튜브 채널 %s → %s', (input, out) => {
  expect(normalizeChannel('youtube', input)).toEqual({ ok: true, value: out });
});

test('유튜브 핸들은 거부', () => {
  expect(normalizeChannel('youtube', '@foo')).toEqual({
    ok: false,
    error: '유튜브는 채널 ID(UC로 시작)를 입력해 주세요',
  });
});

test.each([
  ['Foo_Bar', 'foo_bar'],
  ['https://www.twitch.tv/Foo_Bar', 'foo_bar'],
  ['twitch.tv/foo_bar?x=1', 'foo_bar'],
])('트위치 %s → %s', (input, out) => {
  expect(normalizeChannel('twitch', input)).toEqual({ ok: true, value: out });
});

test('트위치 너무 짧은 이름 거부', () => {
  expect(normalizeChannel('twitch', 'ab').ok).toBe(false);
});

test.each([
  ['abc123', 'abc123'],
  ['https://toon.at/donate/abc123', 'abc123'],
  ['toon.at/donate/abc123/', 'abc123'],
])('후원 아이디 %s → %s', (input, out) => {
  expect(normalizeDonateId(input)).toEqual({ ok: true, value: out });
});

test.each(['', '../x', 'a?b', 'a#b', 'a b'])('잘못된 후원 아이디 %s 거부', (input) => {
  expect(normalizeDonateId(input).ok).toBe(false);
});

test('makeCreator는 key를 채우고 이름 공백을 거부', () => {
  const r = makeCreator({ name: ' 크리에이터A ', donateId: 'abc', platform: 'twitch', channel: 'Foo_Bar' }, 'manual');
  expect(r).toEqual({
    ok: true,
    value: { key: 'twitch:foo_bar', name: '크리에이터A', donateId: 'abc', platform: 'twitch', channel: 'foo_bar', source: 'manual' },
  });
  expect(makeCreator({ name: ' ', donateId: 'abc', platform: 'twitch', channel: 'foo_bar' }, 'manual').ok).toBe(false);
});

test('makeCreator는 알 수 없는 플랫폼을 거부', () => {
  expect(makeCreator({ name: 'a', donateId: 'abc', platform: 'kick' as never, channel: 'foo_bar' }, 'link').ok).toBe(false);
});
