import type { Creator } from '../domain/types';
import type { LivePage, LiveQuery } from '../toonation/liveList';

/**
 * 다른 앱에서 '공유'로 보낸 방송 링크 (설치한 앱의 Web Share Target: /?url=…&text=…).
 * 유튜브·트위치 링크에서 채널·영상을 알아내고, 투네이션 라이브 목록·즐겨찾기에서 같은 방송을 찾는다
 * (후원 ID는 투네이션에 등록된 값만 쓴다 — 링크만으로 후원 대상을 짐작하지 않는다).
 */
export type SharedTarget =
  | { platform: 'twitch'; channel: string }
  | { platform: 'youtube'; videoId?: string; channel?: string; handle?: string };

const TWITCH_RESERVED = new Set(['videos', 'directory', 'search', 'settings', 'subscriptions', 'inventory', 'wallet', 'p', 'downloads', 'jobs', 'turbo']);

export function parseSharedLink(text: string): SharedTarget | null {
  const m = text.match(/https?:\/\/[^\s]+/);
  if (!m) return null;
  let u: URL;
  try {
    u = new URL(m[0]);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  const segs = u.pathname.split('/').filter(Boolean);
  if (host === 'twitch.tv') {
    const login = (segs[0] ?? '').toLowerCase();
    return /^[a-z0-9_]{3,25}$/.test(login) && !TWITCH_RESERVED.has(login) ? { platform: 'twitch', channel: login } : null;
  }
  const ID = /^[A-Za-z0-9_-]{11}$/;
  if (host === 'youtu.be') return ID.test(segs[0] ?? '') ? { platform: 'youtube', videoId: segs[0] } : null;
  if (host === 'youtube.com') {
    const v = u.searchParams.get('v');
    if (segs[0] === 'watch' && v && ID.test(v)) return { platform: 'youtube', videoId: v };
    if ((segs[0] === 'live' || segs[0] === 'shorts' || segs[0] === 'embed') && ID.test(segs[1] ?? '')) return { platform: 'youtube', videoId: segs[1] };
    if (segs[0] === 'channel' && /^UC[A-Za-z0-9_-]{22}$/.test(segs[1] ?? '')) return { platform: 'youtube', channel: segs[1] };
    if (segs[0]?.startsWith('@')) return { platform: 'youtube', handle: segs[0].slice(1) };
  }
  return null;
}

interface FindOptions {
  known: Creator[]; // 즐겨찾기·최근 본·투네이션 즐겨찾기
  lives(q: LiveQuery): Promise<LivePage>;
  fetchJson?(url: string): Promise<unknown>; // 유튜브 oEmbed (영상의 채널 이름)
}

const q = (text: string, platform: 'twitch' | 'youtube'): LiveQuery => ({ page: 1, size: 20, q: text, order: 'VIEWERS', platform });

/** 공유한 방송을 투네이션에 등록된 크리에이터로 (영상 ID는 붙여 둔다). 못 찾으면 null */
export async function findSharedCreator(t: SharedTarget, { known, lives, fetchJson }: FindOptions): Promise<Creator | null> {
  if (t.platform === 'twitch') {
    const hit = known.find((c) => c.platform === 'twitch' && c.channel === t.channel);
    if (hit) return hit;
    const r = await lives(q(t.channel, 'twitch')).catch(() => null);
    return r?.items.find((i) => i.creator.channel === t.channel)?.creator ?? null;
  }
  if (t.channel) {
    const hit = known.find((c) => c.platform === 'youtube' && c.channel === t.channel);
    if (hit) return hit;
  }
  if (t.videoId) {
    const byVideo = known.find((c) => c.platform === 'youtube' && c.videoId === t.videoId);
    if (byVideo) return byVideo;
    let author = '';
    try {
      const o = (await fetchJson?.(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${t.videoId}`)}&format=json`)) as { author_name?: string } | undefined;
      author = String(o?.author_name ?? '').trim();
    } catch {
      // 채널 이름 없이
    }
    if (author) {
      const named = known.find((c) => c.platform === 'youtube' && c.name === author);
      if (named) return { ...named, videoId: t.videoId };
      const r = await lives(q(author, 'youtube')).catch(() => null);
      const hit = r?.items.find((i) => i.creator.videoId === t.videoId) ?? r?.items.find((i) => i.creator.name === author);
      if (hit) return { ...hit.creator, videoId: t.videoId };
    }
    return null;
  }
  if (t.handle) {
    const r = await lives(q(t.handle, 'youtube')).catch(() => null);
    return r?.items.length === 1 ? r.items[0].creator : null;
  }
  return null;
}
