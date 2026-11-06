import { isStream } from '../domain/pages';
import type { Creator, SlotItem } from '../domain/types';
import type { KV } from '../storage/safeStorage';

/** 시청 기록: 칸에 띄운 방송 (최근 것이 앞) */
export const WATCH_LOG_KEY = 'mv.watchLog.v1';
const MAX = 100;
const MERGE_MS = 30 * 60_000; // 같은 방송을 30분 안에 다시 띄우면 시각만 갱신

export interface WatchEntry {
  at: number;
  creator: Creator; // 다시 띄울 수 있을 만큼 (라이브 정보·영상 ID는 빼고)
}

const validCreator = (c: unknown): c is Creator => {
  const x = c as Creator | null;
  return !!x && typeof x === 'object' && ['key', 'name', 'donateId', 'channel'].every((k) => typeof x[k as keyof Creator] === 'string') && (x.platform === 'youtube' || x.platform === 'twitch');
};

export function readWatchLog(kv: KV): WatchEntry[] {
  try {
    const raw = JSON.parse(kv.get(WATCH_LOG_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((e): e is WatchEntry => !!e && Number.isFinite(e.at) && validCreator(e.creator)).slice(0, MAX);
  } catch {
    return [];
  }
}

export function recordWatch(kv: KV, creator: Creator, now: number): WatchEntry[] {
  const { live: _live, videoId: _videoId, ...kept } = creator;
  // 30분 안에 띄운 같은 방송은 지우고 맨 앞에 다시 (사이에 다른 방송을 봤어도)
  const log = readWatchLog(kv).filter((e) => !(e.creator.key === creator.key && now - e.at < MERGE_MS));
  const next = [{ at: now, creator: kept }, ...log].slice(0, MAX);
  kv.set(WATCH_LOG_KEY, JSON.stringify(next));
  return next;
}

/** 최근 본 목록에서 지우기: 그 크리에이터의 기록을 모두 (같은 후원 아이디의 다른 채널 기록까지) */
export function forgetWatch(kv: KV, creator: Creator): WatchEntry[] {
  const same = (c: Creator) => c.key === creator.key || (!!creator.donateId && c.donateId === creator.donateId);
  const next = readWatchLog(kv).filter((e) => !same(e.creator));
  kv.set(WATCH_LOG_KEY, JSON.stringify(next));
  return next;
}

/** next에 새로 들어온 방송 (prev에 같은 방송이 없던 것) */
export function newlyPlaced(prev: (SlotItem | null)[], next: (SlotItem | null)[]): Creator[] {
  const had = new Set(prev.filter(isStream).map((c) => c.key));
  return next.filter(isStream).filter((c) => !had.has(c.key));
}
