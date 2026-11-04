import type { WatchEntry } from '../activity/watchLog';
import type { Creator } from '../domain/types';

/** 퀵패널 한 칸: 크리에이터와 방송 중인지 (null = 모름) */
export interface QuickItem {
  creator: Creator;
  live: boolean | null;
}

/** 즐겨찾기: 투네이션 즐겨찾기(라이브 정보가 있다) 먼저, 직접 추가한 즐겨찾기는 겹치지 않는 것만 */
export function quickFavorites(toonation: Creator[], local: Creator[]): Creator[] {
  const seen = new Set(toonation.map((c) => c.key));
  return [...toonation, ...local.filter((c) => !seen.has(c.key))];
}

/** 최근 본 방송: 최근 순, 같은 방송은 한 번 */
export function quickRecent(log: WatchEntry[], limit = 20): Creator[] {
  const seen = new Set<string>();
  const out: Creator[] = [];
  for (const e of log) {
    if (seen.has(e.creator.key)) continue;
    seen.add(e.creator.key);
    out.push(e.creator);
    if (out.length >= limit) break;
  }
  return out;
}

/** 방송 중인 크리에이터를 위로 (그 밖의 순서는 그대로) */
export function withLive(list: Creator[], isLive: (key: string) => boolean | null): QuickItem[] {
  const items = list.map((creator) => ({ creator, live: isLive(creator.key) }));
  return [...items.filter((i) => i.live), ...items.filter((i) => !i.live)];
}

/** 꺼져 있던 방송이 켜진 것 (처음 보는 것·모름은 알리지 않는다) */
export function startedLive(prev: Record<string, boolean>, next: Record<string, boolean>): string[] {
  return Object.keys(next).filter((k) => next[k] && prev[k] === false);
}
