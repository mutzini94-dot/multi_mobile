import { useCallback, useState } from 'react';
import type { Creator } from '../domain/types';
import type { KV } from '../storage/safeStorage';

/** 즐겨찾기 그룹 ("게임", "주식 방송"): 직접 추가한 것과 투네이션 즐겨찾기 모두 이 앱 안에서만 묶는다 */
export const GROUPS_KEY = 'mv.groups.v1';
const MAX_GROUPS = 20;

interface Saved {
  names: string[];
  of: Record<string, string>; // groupKey → 그룹 이름
}

export const groupKey = (c: Creator) => `${c.key}|${c.donateId}`;
const cleanName = (n: string) => n.trim().replace(/\s+/g, ' ');
const validName = (n: string) => n.length >= 1 && n.length <= 20;

function load(kv: KV): Saved {
  try {
    const r = JSON.parse(kv.get(GROUPS_KEY) ?? 'null');
    if (!r || typeof r !== 'object' || !Array.isArray(r.names)) return { names: [], of: {} };
    const names = [...new Set((r.names as unknown[]).filter((n): n is string => typeof n === 'string').map(cleanName).filter(validName))].slice(0, MAX_GROUPS);
    const of: Record<string, string> = {};
    for (const [k, v] of Object.entries((r.of ?? {}) as Record<string, unknown>)) if (k !== '__proto__' && typeof v === 'string' && names.includes(v)) of[k] = v;
    return { names, of };
  } catch {
    return { names: [], of: {} };
  }
}

export interface FavoriteGroups {
  names: string[];
  groupOf(c: Creator): string | undefined;
  /** name이 없는 그룹이면 새로 만든다. null이면 그룹에서 뺀다 */
  assign(c: Creator, name: string | null): void;
  remove(name: string): void;
}

export function useFavoriteGroups(kv: KV): FavoriteGroups {
  const [saved, setSaved] = useState(() => load(kv));
  const write = useCallback(
    (next: Saved) => {
      kv.set(GROUPS_KEY, JSON.stringify(next));
      setSaved(next);
    },
    [kv],
  );
  return {
    names: saved.names,
    groupOf: (c) => saved.of[groupKey(c)],
    assign: (c, name) => {
      const of = { ...saved.of };
      if (name === null) {
        delete of[groupKey(c)];
        write({ names: saved.names, of });
        return;
      }
      const n = cleanName(name);
      if (!validName(n) || (!saved.names.includes(n) && saved.names.length >= MAX_GROUPS)) return;
      of[groupKey(c)] = n;
      write({ names: saved.names.includes(n) ? saved.names : [...saved.names, n], of });
    },
    remove: (name) => {
      write({ names: saved.names.filter((n) => n !== name), of: Object.fromEntries(Object.entries(saved.of).filter(([, v]) => v !== name)) });
    },
  };
}
