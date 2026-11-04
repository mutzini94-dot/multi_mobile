import { quickFavorites, quickRecent, startedLive, withLive } from '../../src/quick/quickPanel';
import { mkCreator } from '../helpers/fixtures';

test('즐겨찾기: 투네이션 즐겨찾기 먼저, 직접 추가한 즐겨찾기 중 같은 방송은 한 번만', () => {
  const toon = [mkCreator(1, { source: 'toonation' }), mkCreator(2, { source: 'toonation' })];
  const local = [mkCreator(2), mkCreator(3)];
  expect(quickFavorites(toon, local).map((c) => c.key)).toEqual(['twitch:chan_1', 'twitch:chan_2', 'twitch:chan_3']);
});

test('최근 본: 최근 순, 같은 방송은 한 번, 개수 제한', () => {
  const log = [
    { at: 5, creator: mkCreator(1) },
    { at: 4, creator: mkCreator(2) },
    { at: 3, creator: mkCreator(1) },
    { at: 2, creator: mkCreator(3) },
  ];
  expect(quickRecent(log).map((c) => c.key)).toEqual(['twitch:chan_1', 'twitch:chan_2', 'twitch:chan_3']);
  expect(quickRecent(log, 2)).toHaveLength(2);
});

test('방송 중인 크리에이터를 위로 (나머지 순서는 그대로)', () => {
  const live = new Set(['twitch:chan_3', 'twitch:chan_1']);
  const items = withLive([mkCreator(1), mkCreator(2), mkCreator(3), mkCreator(4)], (k) => (k === 'twitch:chan_4' ? null : live.has(k)));
  expect(items.map((i) => [i.creator.key, i.live])).toEqual([
    ['twitch:chan_1', true],
    ['twitch:chan_3', true],
    ['twitch:chan_2', false],
    ['twitch:chan_4', null],
  ]);
});

test('방송 시작: 꺼져 있던 것이 켜졌을 때만 (처음 보는 것·모름은 알리지 않는다)', () => {
  expect(startedLive({ a: false, b: true, c: false }, { a: true, b: true, c: false, d: true })).toEqual(['a']);
  expect(startedLive({}, { a: true })).toEqual([]);
});

test('같은 크리에이터(같은 후원 아이디)의 여러 채널은 한 번만, 방송 중인 채널을 남긴다', () => {
  const yt = mkCreator(1, { donateId: 'same', platform: 'youtube', key: 'youtube:UCa', channel: 'UCa' });
  const tw = mkCreator(2, { donateId: 'same', key: 'twitch:a', channel: 'a' });
  const other = mkCreator(3);
  const items = withLive([yt, tw, other], (k) => k === 'twitch:a');
  expect(items.map((i) => i.creator.key)).toEqual(['twitch:a', 'twitch:chan_3']);
});
