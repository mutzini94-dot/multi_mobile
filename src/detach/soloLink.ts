import { makeCreator } from '../domain/creatorInput';
import { makeChatPage, makeDonatePage, makeWebPage, isStream } from '../domain/pages';
import type { Creator, SlotItem } from '../domain/types';
import { fromBase64Url, toBase64Url } from '../share/jointLink';

/**
 * 분리 창 주소: 같은 앱을 `#solo=<base64url(JSON)>`로 열면 칸 하나만 보여 주는 분리 창이 된다.
 * { v: 1, id, item, sound, donateFor? } — 후원 페이지 칸은 처음 따라갈 크리에이터를 함께 담는다.
 */
export interface SoloPayload {
  id: string; // 분리 창 id (메인 화면과 주고받는 메시지의 주소)
  item: SlotItem; // 방송·웹페이지·후원 페이지
  sound: boolean; // 처음 소리를 켤지 (분리 전 소리가 나던 칸)
  donateFor?: Creator | null; // 후원 페이지·채팅 칸이 처음 따라갈 크리에이터
  videoId?: string | null; // 채팅 칸: 따라갈 유튜브 방송의 라이브 영상 ID
}

const PREFIX = '#solo=';
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

type SavedCreator = Pick<Creator, 'name' | 'donateId' | 'platform' | 'channel' | 'source' | 'videoId'>;
const saveCreator = (c: Creator): SavedCreator => ({ name: c.name, donateId: c.donateId, platform: c.platform, channel: c.channel, source: c.source, ...(c.videoId ? { videoId: c.videoId } : {}) });

export function loadCreator(raw: unknown): Creator | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<SavedCreator>;
  const source: Creator['source'] = s.source === 'toonation' || s.source === 'link' ? s.source : 'manual';
  const r = makeCreator({ name: String(s.name ?? ''), donateId: String(s.donateId ?? ''), platform: s.platform as Creator['platform'], channel: String(s.channel ?? '') }, source);
  if (!r.ok) return null;
  const videoId = typeof s.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(s.videoId) ? s.videoId : undefined;
  return { ...r.value, ...(videoId && r.value.platform === 'youtube' ? { videoId } : {}) };
}

export function encodeSolo(p: SoloPayload): string {
  const item = isStream(p.item) ? saveCreator(p.item) : p.item.kind === 'web' ? { kind: 'web', url: p.item.url } : { kind: p.item.kind };
  const body = { v: 1, id: p.id, item, sound: !!p.sound, ...(p.donateFor ? { donateFor: saveCreator(p.donateFor) } : {}), ...(p.videoId ? { videoId: p.videoId } : {}) };
  return PREFIX + toBase64Url(JSON.stringify(body));
}

export function decodeSolo(hash: string): SoloPayload | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const raw = JSON.parse(fromBase64Url(hash.slice(PREFIX.length)));
    if (!raw || raw.v !== 1 || typeof raw.id !== 'string' || !ID_RE.test(raw.id) || !raw.item) return null;
    let item: SlotItem | null;
    if (raw.item.kind === 'web') {
      const w = makeWebPage(String(raw.item.url ?? ''));
      item = w.ok ? w.value : null;
    } else if (raw.item.kind === 'donate') item = makeDonatePage();
    else if (raw.item.kind === 'chat') item = makeChatPage();
    else item = loadCreator(raw.item);
    if (!item) return null;
    const videoId = typeof raw.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(raw.videoId) ? raw.videoId : null;
    return { id: raw.id, item, sound: raw.sound === true, donateFor: raw.donateFor ? loadCreator(raw.donateFor) : null, videoId };
  } catch {
    return null;
  }
}

export function soloUrl(current: string, p: SoloPayload): string {
  const u = new URL(current);
  u.hash = encodeSolo(p).slice(1);
  return u.href;
}
