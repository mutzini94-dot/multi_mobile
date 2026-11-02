import { newlyPlaced, readWatchLog, recordWatch, WATCH_LOG_KEY } from '../../src/activity/watchLog';
import { makeChatPage } from '../../src/domain/pages';
import { safeStorage } from '../../src/storage/safeStorage';
import { mkCreator } from '../helpers/fixtures';

const MIN = 60_000;

test('처음 띄운 방송은 시청 기록 1건', () => {
  const kv = safeStorage(undefined);
  expect(recordWatch(kv, mkCreator(1), 1000)).toHaveLength(1);
  expect(readWatchLog(kv)[0]).toMatchObject({ at: 1000, creator: { key: 'twitch:chan_1' } });
});

test('같은 방송을 30분 안에 다시 띄우면 시각만 갱신, 30분이 지나면 새로 남긴다', () => {
  const kv = safeStorage(undefined);
  recordWatch(kv, mkCreator(1), 0);
  const again = recordWatch(kv, mkCreator(1), 29 * MIN);
  expect(again).toHaveLength(1);
  expect(again[0].at).toBe(29 * MIN);
  expect(recordWatch(kv, mkCreator(1), 29 * MIN + 31 * MIN)).toHaveLength(2);
});

test('최근 100건만 보관하고 최근 것이 앞', () => {
  const kv = safeStorage(undefined);
  for (let i = 0; i < 101; i++) recordWatch(kv, mkCreator(i), i);
  const log = readWatchLog(kv);
  expect(log).toHaveLength(100);
  expect(log[0].creator.key).toBe('twitch:chan_100');
});

test('라이브 정보·영상 ID는 저장하지 않는다', () => {
  const kv = safeStorage(undefined);
  recordWatch(kv, mkCreator(1, { live: { title: 't', viewers: 3 }, videoId: 'abcdefghijk' }), 1);
  const c = readWatchLog(kv)[0].creator;
  expect(c).not.toHaveProperty('live');
  expect(c).not.toHaveProperty('videoId');
});

test('깨진 저장값이면 빈 기록', () => {
  const kv = safeStorage(undefined);
  kv.set(WATCH_LOG_KEY, '{bad');
  expect(readWatchLog(kv)).toEqual([]);
  kv.set(WATCH_LOG_KEY, '[1,{"at":"x"},{"at":5,"creator":{"key":"k"}}]');
  expect(readWatchLog(kv)).toEqual([]);
});

test('newlyPlaced: 새로 들어온 방송만 (자리 바꿈·페이지 칸은 제외)', () => {
  const a = mkCreator(1);
  const b = mkCreator(2);
  expect(newlyPlaced([a, null], [a, b])).toEqual([b]);
  expect(newlyPlaced([a, b], [b, a])).toEqual([]);
  expect(newlyPlaced([null], [makeChatPage()])).toEqual([]);
});
