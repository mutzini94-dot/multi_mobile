import { donatedToCheck, findDonatedLive, mergeLive } from '../../src/activity/liveTargets';
import type { LivePage, LiveQuery } from '../../src/toonation/liveList';
import type { DonationRecord } from '../../src/toonation/history';
import { mkCreator } from '../helpers/fixtures';

const rec = (tag: string, creator: string, at = 1): DonationRecord => ({ at, tag, creator, cash: 1000 });
const live = (n: number, over = {}) => ({ ...mkCreator(n, { source: 'toonation', ...over }), live: { title: '방송', viewers: 10 } });
const page = (creators: ReturnType<typeof live>[], total = creators.length): LivePage => ({
  items: creators.map((creator) => ({ creator, thumbnail: '', category: '' })),
  page: 1,
  totalPages: 1,
  total,
});

test('donatedToCheck: 후원 많이 한 순, 즐겨찾기는 빼고', () => {
  const h = [rec('a', '에이'), rec('a', '에이'), rec('a', '에이'), rec('b', '비'), rec('c', '씨')];
  expect(donatedToCheck(h, new Set(['c']))).toEqual([
    { tag: 'a', name: '에이', count: 3 },
    { tag: 'b', name: '비', count: 1 },
  ]);
});

test('donatedToCheck: 상위 20명, 아이디가 없거나 이상하면 뺀다', () => {
  const h = Array.from({ length: 21 }, (_, i) => rec(`t${i}`, `n${i}`));
  h.push(rec('', '빈'), rec('a b', '공백'));
  expect(donatedToCheck(h, new Set())).toHaveLength(20);
});

test('findDonatedLive: 이름으로 찾아 후원 아이디가 같은 라이브만', async () => {
  const load = vi.fn(async (q: LiveQuery) => (q.q === '에이' ? page([live(1, { name: '에이', donateId: 'a' }), live(2, { name: '에이2', donateId: 'zz' })]) : page([])));
  const r = await findDonatedLive([{ tag: 'a', name: '에이', count: 3 }], load);
  expect(r).toHaveLength(1);
  expect(r[0].creator.donateId).toBe('a');
  expect(r[0].reason).toEqual({ kind: 'donated', count: 3 });
  expect(load).toHaveBeenCalledWith(expect.objectContaining({ q: '에이', size: 50, page: 1 }));
});

test('findDonatedLive: 1페이지가 50건으로 꽉 찼는데 없으면 2페이지까지, 덜 찼으면 1페이지만', async () => {
  const fifty = Array.from({ length: 50 }, (_, i) => live(100 + i, { donateId: `x${i}` }));
  const load = vi.fn(async (q: LiveQuery) => (q.page === 1 ? page(fifty, 80) : page([live(1, { donateId: 'a' })])));
  expect(await findDonatedLive([{ tag: 'a', name: '흔한', count: 1 }], load)).toHaveLength(1);
  expect(load).toHaveBeenCalledTimes(2);

  const few = vi.fn(async () => page([live(5, { donateId: 'q' })]));
  expect(await findDonatedLive([{ tag: 'a', name: '드문', count: 1 }], few)).toEqual([]);
  expect(few).toHaveBeenCalledTimes(1);
});

test('findDonatedLive: 실패한 요청은 건너뛰고 나머지는 돌려준다', async () => {
  const load = vi.fn(async (q: LiveQuery) => {
    if (q.q === '실패') throw new Error('HTTP 500');
    return page([live(2, { donateId: 'b' })]);
  });
  const r = await findDonatedLive(
    [
      { tag: 'a', name: '실패', count: 2 },
      { tag: 'b', name: '비', count: 1 },
    ],
    load,
  );
  expect(r.map((t) => t.creator.donateId)).toEqual(['b']);
});

test('findDonatedLive: 동시 요청은 3개까지', async () => {
  let running = 0;
  let peak = 0;
  const load = async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
    return page([]);
  };
  await findDonatedLive(Array.from({ length: 8 }, (_, i) => ({ tag: `t${i}`, name: `n${i}`, count: 1 })), load);
  expect(peak).toBe(3);
});

test('mergeLive: 즐겨찾기 먼저, 겹치면 즐겨찾기만, 그룹 안은 시청자 많은 순', () => {
  const favA = { ...mkCreator(1), live: { title: '', viewers: 5 } };
  const favB = { ...mkCreator(2), live: { title: '', viewers: 50 } };
  const offFav = mkCreator(3);
  const donatedA = { creator: { ...mkCreator(1), live: { title: '', viewers: 5 } }, reason: { kind: 'donated' as const, count: 2 } };
  const donatedC = { creator: { ...mkCreator(4), live: { title: '', viewers: 900 } }, reason: { kind: 'donated' as const, count: 1 } };
  const r = mergeLive([favA, favB, offFav], [donatedC, donatedA]);
  expect(r.map((t) => [t.creator.key, t.reason.kind])).toEqual([
    ['twitch:chan_2', 'favorite'],
    ['twitch:chan_1', 'favorite'],
    ['twitch:chan_4', 'donated'],
  ]);
});
