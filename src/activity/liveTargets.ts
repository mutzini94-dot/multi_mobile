import type { Creator } from '../domain/types';
import { summarize, type DonationRecord } from '../toonation/history';
import type { LivePage, LiveQuery } from '../toonation/liveList';

/** 활동 위젯 '지금 라이브' 한 줄: 라이브 중인 크리에이터와 목록에 들어온 이유 */
export interface LiveTarget {
  creator: Creator;
  reason: { kind: 'favorite' } | { kind: 'donated'; count: number };
}

export interface DonatedCreator {
  tag: string;
  name: string;
  count: number;
}

const TAG_RE = /^[A-Za-z0-9_-]{1,64}$/;
const PAGE_SIZE = 50;

/** 라이브를 확인할 후원 크리에이터: 후원 합계 순 상위 limit명 (즐겨찾기는 이미 라이브 상태를 알아서 뺀다) */
export function donatedToCheck(history: DonationRecord[], favoriteTags: Set<string>, limit = 20): DonatedCreator[] {
  return summarize(history)
    .creators.filter((c) => TAG_RE.test(c.tag) && !favoriteTags.has(c.tag))
    .slice(0, limit)
    .map((c) => ({ tag: c.tag, name: c.creator || c.tag, count: c.count }));
}

/** 크리에이터 이름으로 공개 라이브 목록을 찾아 후원 아이디가 같은 방송을 찾는다 (1페이지가 꽉 찼을 때만 2페이지까지) */
async function findOne(t: DonatedCreator, load: (q: LiveQuery) => Promise<LivePage>): Promise<LiveTarget | null> {
  for (let page = 1; page <= 2; page++) {
    const r = await load({ q: t.name, size: PAGE_SIZE, page, order: 'VIEWERS', platform: '' });
    const hit = r.items.find((i) => i.creator.donateId === t.tag);
    if (hit) return { creator: hit.creator, reason: { kind: 'donated', count: t.count } };
    if (r.items.length < PAGE_SIZE) break;
  }
  return null;
}

/** 후원 크리에이터 중 라이브인 사람 (동시 요청 concurrency개, 실패한 요청은 건너뛴다) */
export async function findDonatedLive(targets: DonatedCreator[], load: (q: LiveQuery) => Promise<LivePage>, concurrency = 3): Promise<LiveTarget[]> {
  const found: (LiveTarget | null)[] = Array(targets.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const i = next++;
      found[i] = await findOne(targets[i], load).catch(() => null);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return found.filter((t): t is LiveTarget => !!t);
}

const byViewers = (a: LiveTarget, b: LiveTarget) => (b.creator.live?.viewers ?? 0) - (a.creator.live?.viewers ?? 0);

/** 즐겨찾기 라이브 먼저, 그다음 후원 크리에이터 (겹치면 즐겨찾기), 각각 시청자 많은 순 */
export function mergeLive(favorites: Creator[], donated: LiveTarget[]): LiveTarget[] {
  const fav: LiveTarget[] = favorites.filter((c) => c.live).map((creator) => ({ creator, reason: { kind: 'favorite' } }));
  const seen = new Set(fav.map((t) => t.creator.key));
  const rest = donated.filter((t) => !seen.has(t.creator.key));
  return [...fav.sort(byViewers), ...rest.sort(byViewers)];
}
