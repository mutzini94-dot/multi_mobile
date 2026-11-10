import { makeCreator, type CreatorInput } from '../domain/creatorInput';
import type { Creator } from '../domain/types';

/** 카드(추천 라이브·활동 위젯·퀵패널)를 창으로 끌어 넣을 때 쓰는 끌기 자료 형식 */
export const CREATOR_MIME = 'application/x-mv-creator';

/** 끌기 시작: 방송 정보를 담는다 */
export function startCreatorDrag(dt: DataTransfer, c: Creator): void {
  dt.setData(CREATOR_MIME, JSON.stringify(c));
  dt.effectAllowed = 'copy';
}

export function hasCreatorDrag(dt: DataTransfer | null): boolean {
  return !!dt && [...(dt.types ?? [])].includes(CREATOR_MIME);
}

/** 놓기: 담긴 방송 정보를 다시 확인한다 (다른 곳에서 끌어 온 잘못된 값은 버린다) */
export function readCreatorDrag(dt: DataTransfer): Creator | null {
  try {
    const raw = JSON.parse(dt.getData(CREATOR_MIME) || 'null') as Partial<Creator> | null;
    if (!raw || typeof raw !== 'object') return null;
    const made = makeCreator(raw as CreatorInput, raw.source === 'toonation' ? 'toonation' : 'manual');
    if (!made.ok) return null;
    const c: Creator = { ...made.value };
    if (typeof raw.profile === 'string' && /^https:\/\//.test(raw.profile)) c.profile = raw.profile;
    if (typeof raw.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(raw.videoId)) c.videoId = raw.videoId;
    if (raw.live && typeof raw.live === 'object') c.live = { title: String(raw.live.title ?? '').slice(0, 100), viewers: Number(raw.live.viewers) || 0 };
    return c;
  } catch {
    return null;
  }
}
