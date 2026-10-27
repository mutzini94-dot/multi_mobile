import { HOST_KEY, loadHost, saveHost } from '../../src/host/hostProfile';
import { safeStorage } from '../../src/storage/safeStorage';

const input = { name: ' 나 ', donateId: 'toon.at/donate/myTag', platform: 'twitch' as const, channel: 'https://twitch.tv/My_Ch' };

test('저장하면 정규화된 호스트를 돌려주고, 다시 읽을 수 있다', () => {
  const kv = safeStorage(undefined);
  const r = saveHost(kv, input);
  expect(r).toEqual({ ok: true, value: { key: 'twitch:my_ch', name: '나', donateId: 'myTag', platform: 'twitch', channel: 'my_ch', source: 'manual' } });
  expect(loadHost(kv)).toEqual(r.ok && r.value);
});

test('잘못된 입력은 저장하지 않고 오류', () => {
  const kv = safeStorage(undefined);
  const r = saveHost(kv, { ...input, donateId: '../x' });
  expect(r.ok).toBe(false);
  expect(loadHost(kv)).toBeNull();
});

test('저장값이 없거나 깨졌으면 null', () => {
  const kv = safeStorage(undefined);
  expect(loadHost(kv)).toBeNull();
  kv.set(HOST_KEY, '{bad');
  expect(loadHost(kv)).toBeNull();
});
