import { FAVORITES_KEY, localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { Creator } from '../../src/domain/types';

const creator = (over: Partial<Creator> = {}): Creator => ({
  key: 'twitch:foo_bar', name: 'A', donateId: 'abc', platform: 'twitch', channel: 'foo_bar', source: 'manual', ...over,
});

const memKV = () => safeStorage(undefined);

test("add 후 list에 나오고, 저장된 항목은 source가 'manual'이다", () => {
  const fav = localFavorites(memKV());
  fav.add(creator({ source: 'link' }));
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
