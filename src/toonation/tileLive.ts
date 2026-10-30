import { useEffect, useRef, useState } from 'react';
import type { Creator } from '../domain/types';
import type { LivePage, LiveQuery } from './liveList';

/** 칸에 보여 줄 방송 정보 */
export interface TileLiveInfo {
  title: string;
  viewers: number;
  startedAt?: number; // ms
}

const LOOKUP_EVERY_MS = 3 * 60 * 1000;

/** 방송한 시간: "1시간 5분", "9분", "방금 시작" */
export function formatElapsed(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return '방금 시작';
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}시간 ${min % 60}분` : `${min}분`;
}

interface Options {
  streams: Creator[]; // 지금 칸에 있는 방송
  known: Creator[]; // 이미 라이브 정보를 아는 방송 (투네이션 즐겨찾기)
  load(q: LiveQuery): Promise<LivePage>; // 투네이션 라이브 목록
  enabled: boolean; // 설정: 칸에 방송 정보 표시
}

/**
 * 칸의 방송마다 제목·시청자 수·시작 시각. 투네이션 즐겨찾기에 있으면 그 정보를,
 * 아니면 투네이션 라이브 목록에서 이름으로 찾는다 (3분마다, 투네이션에 등록된 크리에이터만).
 */
export function useTileLiveInfo({ streams, known, load, enabled }: Options): Record<string, TileLiveInfo> {
  const [looked, setLooked] = useState<Record<string, TileLiveInfo | null>>({});
  const loadRef = useRef(load);
  loadRef.current = load;
  const ids = [...new Set(streams.map((c) => `${c.key}\n${c.name}\n${c.platform}`))].sort().join('|');

  useEffect(() => {
    if (!enabled || !ids) return;
    let alive = true;
    const targets = ids.split('|').map((s) => {
      const [key, name, platform] = s.split('\n');
      return { key, name, platform: platform as Creator['platform'] };
    });
    const lookup = async () => {
      const next: Record<string, TileLiveInfo | null> = {};
      for (const t of targets) {
        try {
          const r = await loadRef.current({ page: 1, size: 10, q: t.name, order: 'VIEWERS', platform: t.platform });
          const hit = r.items.find((i) => i.creator.key === t.key)?.creator.live;
          next[t.key] = hit ? { title: hit.title, viewers: hit.viewers, ...(hit.startedAt ? { startedAt: hit.startedAt } : {}) } : null;
        } catch {
          // 다음 주기에 다시
        }
      }
      if (alive) setLooked((m) => ({ ...m, ...next }));
    };
    lookup();
    const t = setInterval(lookup, LOOKUP_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [ids, enabled]);

  if (!enabled) return {};
  const out: Record<string, TileLiveInfo> = {};
  for (const c of streams) {
    const fav = known.find((k) => k.key === c.key && k.live)?.live;
    const info = looked[c.key] ?? (fav ? { title: fav.title, viewers: fav.viewers, ...(fav.startedAt ? { startedAt: fav.startedAt } : {}) } : null);
    if (info) out[c.key] = info;
  }
  return out;
}
