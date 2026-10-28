import type { Result } from './creatorInput';
import type { Creator, DonatePage, SlotItem, ViewState, WebPage } from './types';
import { visibleSlots } from '../layout/layouts';

/** 칸 내용이 방송인지 (후원 페이지·웹페이지 칸이 아닌지) */
export function isStream(item: SlotItem | null | undefined): item is Creator {
  return !!item && !('kind' in item);
}

/** 웹페이지 칸 주소: 주소만 넣으면 https://, http·https만 허용 */
export function normalizePageUrl(input: string): Result<string> {
  const raw = String(input ?? '').trim();
  if (!raw || /\s/.test(raw)) return { ok: false, error: '열 주소를 입력해 주세요 (예: naver.com)' };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname.includes('.')) throw new Error();
    return { ok: true, value: u.href };
  } catch {
    return { ok: false, error: 'http:// 또는 https:// 웹 주소만 열 수 있습니다' };
  }
}

let seq = 0;
const newKey = (kind: string) => `${kind}:${Date.now().toString(36)}${(++seq).toString(36)}`;

export function makeWebPage(input: string): Result<WebPage> {
  const r = normalizePageUrl(input);
  if (!r.ok) return r;
  const name = new URL(r.value).hostname.replace(/^www\./, '');
  return { ok: true, value: { kind: 'web', key: newKey('web'), name, url: r.value } };
}

/** 후원 페이지 칸: 선택한 방송 크리에이터의 투네이션 후원 페이지를 따라 보여준다 */
export function makeDonatePage(): DonatePage {
  return { kind: 'donate', key: newKey('donate'), name: '후원 페이지' };
}

export function donatePageUrl(c: Creator): string {
  return `https://toon.at/donate/${encodeURIComponent(c.donateId)}`;
}

/** 후원 페이지 칸의 크리에이터: 선택한 방송 > 마지막으로 따라간 방송(아직 칸에 있으면) > 보이는 첫 방송 */
export function followDonateCreator(state: ViewState, last: Creator | null): Creator | null {
  const selected = state.selected !== null ? state.slots[state.selected] : null;
  if (isStream(selected)) return selected;
  if (last && state.slots.some((s) => isStream(s) && s.key === last.key && s.donateId === last.donateId)) return last;
  return visibleSlots(state).find(isStream) ?? null;
}
