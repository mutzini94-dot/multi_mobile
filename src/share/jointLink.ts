import { makeCreator, type CreatorInput } from '../domain/creatorInput';
import { isStream } from '../domain/pages';
import type { Creator, LayoutKind, ViewState } from '../domain/types';
import { MAX_SLOTS, SLOT_COUNT, visibleSlots } from '../layout/layouts';

/**
 * 합동 방송 URL (서버 없음, "방송 시작하기" 순간의 구성으로 고정).
 *   #j=<base64url(JSON)>  { v: 2, host, layout, sizes, guests }
 * 호스트는 1번 칸에 고정되고, 이 합방의 후원은 호스트에게만 간다.
 */
const PREFIX = '#j=';

interface JointPayload {
  v: 2;
  host: CreatorInput;
  layout: LayoutKind;
  sizes: Record<string, number[]>;
  guests: (CreatorInput | null)[];
}

export interface JointBroadcast {
  host: Creator;
  state: ViewState;
}

export function toBase64Url(text: string): string {
  let bin = '';
  new TextEncoder().encode(text).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(data: string): string {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

const toInput = ({ name, donateId, platform, channel }: Creator): CreatorInput => ({ name, donateId, platform, channel });

export function encodeJoint(host: Creator, state: ViewState): string {
  const payload: JointPayload = {
    v: 2,
    host: toInput(host),
    layout: state.layout,
    sizes: state.sizes,
    // 1번 칸은 호스트, 나머지는 지금 보이는 게스트 칸만
    guests: visibleSlots(state)
      .slice(1)
      .map((c) => (isStream(c) ? toInput(c) : null)), // 후원 페이지·웹페이지 칸은 빈 칸으로
  };
  return PREFIX + toBase64Url(JSON.stringify(payload));
}

export function buildJointUrl(host: Creator, state: ViewState, base: string): string {
  const url = new URL(base);
  url.hash = encodeJoint(host, state).slice(1);
  return url.toString();
}

function cleanSizes(raw: unknown): Record<string, number[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === '__proto__' || !Array.isArray(v) || !v.every((n) => typeof n === 'number' && Number.isFinite(n))) return {};
    out[k] = v;
  }
  return out;
}

export function decodeJoint(hash: string): JointBroadcast | null {
  if (!hash.startsWith(PREFIX)) return null;
  let p: Partial<JointPayload>;
  try {
    p = JSON.parse(fromBase64Url(hash.slice(PREFIX.length)));
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object' || p.v !== 2) return null;
  if (typeof p.layout !== 'string' || !Object.prototype.hasOwnProperty.call(SLOT_COUNT, p.layout)) return null;
  const layout = p.layout as LayoutKind;
  if (!p.host || typeof p.host !== 'object') return null;
  const host = makeCreator(p.host, 'link');
  if (!host.ok) return null;
  if (!Array.isArray(p.guests) || p.guests.length !== SLOT_COUNT[layout] - 1) return null;
  const slots: (Creator | null)[] = [host.value];
  for (const g of p.guests) {
    if (g === null) {
      slots.push(null);
      continue;
    }
    if (typeof g !== 'object') return null;
    const r = makeCreator(g, 'link');
    if (!r.ok) return null;
    slots.push(r.value);
  }
  while (slots.length < MAX_SLOTS) slots.push(null);
  return { host: host.value, state: { layout, slots, sizes: cleanSizes(p.sizes), selected: null, soundOn: true } };
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/i;

/**
 * 시청자에게 공유할 시청 페이지 주소.
 * 공개 주소에서 연 웹이면 그 주소를, 설치형·로컬(localhost)이면 사용자가 저장한 배포 주소를 쓴다.
 */
export function publicBase(currentHref: string, saved: string | null): string | null {
  try {
    const cur = new URL(currentHref);
    if (/^https?:$/.test(cur.protocol) && !LOCAL_HOST.test(cur.hostname)) {
      cur.hash = '';
      return cur.toString();
    }
  } catch {
    // 아래로
  }
  if (saved && /^https?:\/\/[^\s]+$/i.test(saved)) return saved;
  return null;
}
