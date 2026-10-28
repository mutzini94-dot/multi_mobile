import { makeCreator } from '../domain/creatorInput';
import type { Creator } from '../domain/types';

/** 연동 확장(extension/background.js)이 보내는 즐겨찾기 한 명. lib/toonation.js normalizeCreator 형식. */
export interface ToonationFavorite {
  tag: string;
  name: string;
  profile: string;
  channels: { platform: string; key: string | null; ytId?: string; live?: boolean; title?: string; viewers?: number }[];
}

export interface ToonationAccount {
  name: string;
  profile?: string;
  cash?: number | null; // 캐시 잔액
}

export type BridgeRequest = 'status' | 'login' | 'logout' | 'favorites' | 'history';

export interface ToonationBridge {
  request<T = unknown>(type: BridgeRequest): Promise<T>;
}

/**
 * 즐겨찾기를 유튜브·트위치 채널마다 한 줄의 Creator로 바꾼다. 치지직과 변환되지 않은 유튜브 핸들은 뺀다.
 * 라이브 중인 채널을 맨 위로 올리고, 나머지는 투네이션 즐겨찾기 순서를 유지한다.
 */
export function favoritesFromToonation(list: ToonationFavorite[]): Creator[] {
  const out: Creator[] = [];
  for (const f of Array.isArray(list) ? list : []) {
    if (!f || typeof f !== 'object' || !Array.isArray(f.channels)) continue;
    const profile = typeof f.profile === 'string' && /^https?:\/\//.test(f.profile) ? f.profile : undefined;
    for (const ch of f.channels) {
      if (!ch || (ch.platform !== 'youtube' && ch.platform !== 'twitch')) continue;
      const channel = ch.platform === 'youtube' ? (ch.key?.startsWith('UC') ? ch.key : ch.ytId) : ch.key;
      if (!channel) continue;
      const r = makeCreator(
        { name: String(f.name ?? '').trim().slice(0, 30), donateId: String(f.tag ?? ''), platform: ch.platform, channel },
        'manual',
      );
      if (r.ok && !out.some((c) => c.key === r.value.key && c.donateId === r.value.donateId)) {
        const live = ch.live ? { title: String(ch.title ?? '').slice(0, 100), viewers: Number.isFinite(Number(ch.viewers)) ? Number(ch.viewers) : 0 } : undefined;
        out.push({ ...r.value, source: 'toonation', ...(profile ? { profile } : {}), ...(live ? { live } : {}) });
      }
    }
  }
  return [...out.filter((c) => c.live), ...out.filter((c) => !c.live)];
}

let seq = 0;

/** 페이지 ↔ 연동 확장 content script(extension/content/bridge.js) 사이의 postMessage 요청/응답. */
export function createBridge(win: Window, timeoutMs = 1500): ToonationBridge {
  return {
    request<T>(type: BridgeRequest) {
      const id = `mv-${Date.now()}-${++seq}`;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          win.removeEventListener('message', onMessage);
          reject(new Error('NO_EXTENSION'));
        }, timeoutMs);
        function onMessage(e: MessageEvent) {
          const d = e.data;
          if (!d || d.source !== 'mv-ext' || d.id !== id) return;
          clearTimeout(timer);
          win.removeEventListener('message', onMessage);
          if (d.ok) resolve(d.data as T);
          else reject(new Error(String(d.error || 'ERROR')));
        }
        win.addEventListener('message', onMessage);
        win.postMessage({ source: 'mv-page', id, type }, win.location.origin);
      });
    },
  };
}
