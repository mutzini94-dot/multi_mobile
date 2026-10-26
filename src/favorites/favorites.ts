import { makeCreator, type CreatorInput } from '../domain/creatorInput';
import type { Creator } from '../domain/types';
import type { KV } from '../storage/safeStorage';

/** 즐겨찾기 출처. 나중에 투네이션 공식 API 구현으로 갈아 끼운다. */
export interface FavoritesSource {
  list(): Creator[];
  add(c: Creator): Creator[];
  remove(key: string): Creator[];
}

export const FAVORITES_KEY = 'mv.favorites.v1';

export function localFavorites(kv: KV): FavoritesSource {
  const read = (): Creator[] => {
    let raw: unknown;
    try {
      raw = JSON.parse(kv.get(FAVORITES_KEY) ?? '[]');
    } catch {
      return [];
    }
    if (!Array.isArray(raw)) return [];
    const out: Creator[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const r = makeCreator(item as CreatorInput, 'manual');
      if (r.ok) out.push(r.value);
    }
    return out;
  };
  const write = (list: Creator[]) => {
    const inputs: CreatorInput[] = list.map(({ name, donateId, platform, channel }) => ({ name, donateId, platform, channel }));
    kv.set(FAVORITES_KEY, JSON.stringify(inputs));
    return list;
  };
  return {
    list: read,
    add(c) {
      const list = read();
      const entry: Creator = { ...c, source: 'manual' };
      const idx = list.findIndex((x) => x.key === c.key);
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      return write(list);
    },
    remove(key) {
      return write(read().filter((x) => x.key !== key));
    },
  };
}
