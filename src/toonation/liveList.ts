import { makeCreator } from '../domain/creatorInput';
import type { Creator, Platform } from '../domain/types';

/**
 * toon.at/donator?live 페이지의 라이브 목록 (공개 API, 로그인 불필요, CORS 허용).
 * GET https://live-streaming.toon.at/api/stream/live-stream-list → { data: Spring Page { content, totalPages, totalElements } }
 * platformType: 1 트위치, 2 유튜브, 8 치지직(멀티뷰에서 재생 불가라 뺀다)
 */
export interface LiveQuery {
  page: number; // 1부터
  size: number;
  q: string; // 크리에이터 이름 검색
  order: 'VIEWERS' | 'STREAM_BEGIN'; // 시청자순 · 최신순
  platform: '' | Platform;
}

export interface LiveItem {
  creator: Creator; // source 'toonation', live 포함
  thumbnail: string;
  category: string;
}

export interface LivePage {
  items: LiveItem[];
  page: number;
  totalPages: number;
  total: number;
}

const API = 'https://live-streaming.toon.at/api/stream/live-stream-list';
const PLATFORM_TYPE: Record<Platform, string> = { twitch: '1', youtube: '2' };
const PLATFORM_OF: Record<number, Platform> = { 1: 'twitch', 2: 'youtube' };

export function liveListUrl(q: LiveQuery): string {
  const p = new URLSearchParams({
    title: '',
    creatorName: q.q.trim(),
    categoryName: '',
    orderKey: q.order === 'STREAM_BEGIN' ? 'STREAM_BEGIN' : 'VIEWERS',
    isDesc: 'true',
    pageNo: String(Math.max(1, q.page | 0)),
    pageSize: String(Math.min(50, Math.max(1, q.size | 0))),
    platformType: q.platform ? PLATFORM_TYPE[q.platform] : '',
  });
  return `${API}?${p}`;
}

const decodeHtml = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e] ?? _);
const httpsUrl = (s: unknown) => (typeof s === 'string' && /^https?:\/\//.test(s) ? s.replace(/^http:/, 'https:') : '');

export async function fetchLiveList(q: LiveQuery, fetchImpl: typeof fetch = fetch): Promise<LivePage> {
  const r = await fetchImpl(liveListUrl(q), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = ((await r.json()) ?? {}).data ?? {};
  const items: LiveItem[] = [];
  for (const l of Array.isArray(d.content) ? d.content : []) {
    const platform = PLATFORM_OF[Number(l?.platformType)];
    if (!platform) continue;
    const made = makeCreator(
      { name: decodeHtml(String(l.creatorName ?? '')).trim().slice(0, 30), donateId: String(l.linkTag ?? ''), platform, channel: String(l.channel ?? '') },
      'toonation',
    );
    if (!made.ok) continue;
    const profile = httpsUrl(l.creatorProfileImageUrl);
    items.push({
      creator: {
        ...made.value,
        ...(profile ? { profile } : {}),
        ...(platform === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(String(l.v ?? '')) ? { videoId: String(l.v) } : {}),
        live: { title: decodeHtml(String(l.title ?? '')).slice(0, 100), viewers: Number(l.viewers) || 0 },
      },
      thumbnail: httpsUrl(l.thumbnailImage).replace('{width}x{height}', '320x180'),
      category: String(l.categoryName ?? ''),
    });
  }
  return { items, page: q.page, totalPages: Number(d.totalPages) || 1, total: Number(d.totalElements) || items.length };
}
