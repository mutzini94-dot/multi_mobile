import { safeStorage } from '../../src/storage/safeStorage';
import { creatorKey } from '../../src/domain/types';

test('backing 저장소가 정상이면 그대로 읽고 쓴다', () => {
  const kv = safeStorage(window.localStorage);
  kv.set('a', '1');
  expect(kv.get('a')).toBe('1');
  expect(window.localStorage.getItem('a')).toBe('1');
});

test('backing이 throw하면 메모리로 대체한다', () => {
  const broken = {
    getItem() { throw new Error('x'); },
    setItem() { throw new Error('x'); },
  } as unknown as Storage;
  const kv = safeStorage(broken);
  kv.set('a', '1');
  expect(kv.get('a')).toBe('1');
});

test('creatorKey 형식', () => {
  expect(creatorKey('twitch', 'abc')).toBe('twitch:abc');
});
