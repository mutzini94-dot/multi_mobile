import { makeCreator, type CreatorInput, type Result } from '../domain/creatorInput';
import type { Creator } from '../domain/types';
import type { KV } from '../storage/safeStorage';

/** 즐겨찾기 출처. 나중에 투네이션 공식 API 구현으로 갈아 끼운다. */
export interface FavoritesSource {
  list(): Creator[];
  add(c: Creator): Creator[];
  remove(key: string): Creator[];
  move(key: string, delta: -1 | 1): Creator[]; // 목록 순서 바꾸기
  exportJson(): string; // 다른 PC로 옮기기
  importJson(text: string): Result<number>; // 가져온 개수 (같은 채널은 덮어쓰기)
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
    move(key, delta) {
      const list = read();
      const i = list.findIndex((x) => x.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j], list[i]];
      return write(list);
    },
    exportJson() {
      const favorites = read().map(({ name, donateId, platform, channel }) => ({ name, donateId, platform, channel }));
      return JSON.stringify({ version: 1, favorites }, null, 2);
    },
    importJson(text) {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return { ok: false, error: '파일 형식이 올바르지 않습니다' };
      }
      const items = raw && typeof raw === 'object' && Array.isArray((raw as { favorites?: unknown }).favorites) ? (raw as { favorites: unknown[] }).favorites : null;
      if (!items) return { ok: false, error: '멀티뷰 즐겨찾기 파일이 아닙니다' };
      const list = read();
      let count = 0;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const r = makeCreator(item as CreatorInput, 'manual');
        if (!r.ok) continue;
        const idx = list.findIndex((x) => x.key === r.value.key);
        if (idx >= 0) list[idx] = r.value;
        else list.push(r.value);
        count++;
      }
      write(list);
      return { ok: true, value: count };
    },
  };
}
