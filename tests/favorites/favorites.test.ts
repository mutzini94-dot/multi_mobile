import { FAVORITES_KEY, localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { Creator } from '../../src/domain/types';

const creator = (over: Partial<Creator> = {}): Creator => ({
  key: 'twitch:foo_bar', name: 'A', donateId: 'abc', platform: 'twitch', channel: 'foo_bar', source: 'manual', ...over,
});

const memKV = () => safeStorage(undefined);

test("add 후 list에 나오고, 저장된 항목은 source가 'manual'이다", () => {
  const fav = localFavorites(memKV());
  fav.add(creator({ source: 'toonation' }));
  expect(fav.list()).toEqual([creator()]);
});

test('같은 key를 add하면 교체되고 개수는 그대로다', () => {
  const fav = localFavorites(memKV());
  fav.add(creator());
  fav.add(creator({ name: 'B' }));
  expect(fav.list()).toHaveLength(1);
  expect(fav.list()[0].name).toBe('B');
});

test('remove(key)로 지워진다', () => {
  const fav = localFavorites(memKV());
  fav.add(creator());
  expect(fav.remove('twitch:foo_bar')).toEqual([]);
  expect(fav.list()).toEqual([]);
});

test('저장값이 깨진 JSON이면 빈 목록', () => {
  const kv = memKV();
  kv.set(FAVORITES_KEY, '{oops');
  expect(localFavorites(kv).list()).toEqual([]);
});

test('저장값 중 검증을 통과하지 못하는 항목은 건너뛴다', () => {
  const kv = memKV();
  kv.set(FAVORITES_KEY, JSON.stringify([
    { name: 'A', donateId: 'abc', platform: 'twitch', channel: 'foo_bar' },
    { name: 'X', donateId: '../evil', platform: 'twitch', channel: 'foo_bar2' },
    null,
  ]));
  expect(localFavorites(kv).list().map((c) => c.name)).toEqual(['A']);
});

describe('즐겨찾기 관리', () => {
  const three = () => {
    const fav = localFavorites(memKV());
    fav.add(creator({ key: 'twitch:aaaa', channel: 'aaaa', name: 'A' }));
    fav.add(creator({ key: 'twitch:bbbb', channel: 'bbbb', name: 'B' }));
    fav.add(creator({ key: 'twitch:cccc', channel: 'cccc', name: 'C' }));
    return fav;
  };

  test('move: 위·아래로 한 창씩, 끝에서는 그대로', () => {
    const fav = three();
    expect(fav.move('twitch:cccc', -1).map((c) => c.name)).toEqual(['A', 'C', 'B']);
    expect(fav.move('twitch:aaaa', -1).map((c) => c.name)).toEqual(['A', 'C', 'B']);
    expect(fav.move('twitch:aaaa', 1).map((c) => c.name)).toEqual(['C', 'A', 'B']);
  });

  test('내보내기 → 가져오기 (다른 PC로 옮기기): 검증을 통과한 항목만, 같은 채널은 덮어쓰기', () => {
    const json = three().exportJson();
    const other = localFavorites(memKV());
    other.add(creator({ key: 'twitch:bbbb', channel: 'bbbb', name: '옛B' }));
    expect(other.importJson(json)).toEqual({ ok: true, value: 3 });
    expect(other.list().map((c) => c.name)).toEqual(['B', 'A', 'C']);
  });

  test('가져오기: 형식이 틀리면 오류, 잘못된 항목은 건너뛴다', () => {
    const fav = localFavorites(memKV());
    expect(fav.importJson('{bad').ok).toBe(false);
    expect(fav.importJson('{"x":1}').ok).toBe(false);
    expect(fav.importJson(JSON.stringify({ version: 1, favorites: [{ name: 'A', donateId: 'a1', platform: 'twitch', channel: 'aaaa' }, { name: 'X', donateId: '../x', platform: 'twitch', channel: 'xxxx' }] }))).toEqual({ ok: true, value: 1 });
  });
});
