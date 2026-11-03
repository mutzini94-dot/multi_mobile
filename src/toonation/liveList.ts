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
  category?: string; // 카테고리 (게임·토크 등, 목록에 나온 이름)
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
    categoryName: (q.category ?? '').trim(),
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

/** 방송 시작 시각: 경과 초(streamElapsedTime)로, 없으면 시작 시각(한국 시간, 시간대 표시 없음) */
function startedAt(l: { streamElapsedTime?: unknown; streamStartTime?: unknown }): { startedAt?: number } {
  const sec = Number(l.streamElapsedTime);
  if (Number.isFinite(sec) && sec > 0) return { startedAt: Date.now() - sec * 1000 };
  const t = Date.parse(`${String(l.streamStartTime ?? '')}+09:00`);
  return Number.isFinite(t) ? { startedAt: t } : {};
}

/** 라이브 목록 API 항목 한 개 → LiveItem (재생 못 하는 플랫폼·잘못된 항목은 null) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLiveItem(l: any): LiveItem | null {
  const platform = PLATFORM_OF[Number(l?.platformType)];
  if (!platform) return null;
  const made = makeCreator(
    { name: decodeHtml(String(l.creatorName ?? '')).trim().slice(0, 30), donateId: String(l.linkTag ?? ''), platform, channel: String(l.channel ?? '') },
    'toonation',
  );
  if (!made.ok) return null;
  const profile = httpsUrl(l.creatorProfileImageUrl);
  return {
    creator: {
      ...made.value,
      ...(profile ? { profile } : {}),
      ...(platform === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(String(l.v ?? '')) ? { videoId: String(l.v) } : {}),
      live: { title: decodeHtml(String(l.title ?? '')).slice(0, 100), viewers: Number(l.viewers) || 0, ...startedAt(l) },
    },
    thumbnail: httpsUrl(l.thumbnailImage).replace('{width}x{height}', '320x180'),
    category: String(l.categoryName ?? ''),
  };
}

export async function fetchLiveList(q: LiveQuery, fetchImpl: typeof fetch = fetch): Promise<LivePage> {
  const r = await fetchImpl(liveListUrl(q), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = ((await r.json()) ?? {}).data ?? {};
  const items: LiveItem[] = [];
  for (const l of Array.isArray(d.content) ? d.content : []) {
    const item = toLiveItem(l);
    if (item) items.push(item);
  }
  return { items, page: q.page, totalPages: Number(d.totalPages) || 1, total: Number(d.totalElements) || items.length };
}

/** 인기라이브 (toon.at/donator?live 첫 탭): 추천 채널 묶음과 LIVE TOP 50 */
export interface PopularLive {
  groups: { name: string; items: LiveItem[] }[];
  top: LiveItem[];
}

const STREAM_API = 'https://live-streaming.toon.at/api/stream';

async function getData(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const r = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return ((await r.json()) ?? {}).data;
}

const toItems = (list: unknown): LiveItem[] => (Array.isArray(list) ? list.map(toLiveItem).filter((i): i is LiveItem => !!i) : []);

export async function fetchPopularLive(fetchImpl: typeof fetch = fetch): Promise<PopularLive> {
  const recom = await getData(`${STREAM_API}/recom-stream-main`, fetchImpl);
  const top = await getData(`${STREAM_API}/top-stream-list`, fetchImpl);
  const groups = (Array.isArray(recom) ? recom : [])
    .map((g) => ({ name: `추천 ${decodeHtml(String(g?.groupNameKr ?? '')).trim()} 채널`, items: toItems(g?.lives) }))
    .filter((g) => g.items.length > 0);
  return { groups, top: toItems(top) };
}
