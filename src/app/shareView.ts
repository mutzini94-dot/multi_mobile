import type { ViewState } from '../domain/types';
import { fromBase64Url, toBase64Url } from '../detach/base64url';
import { SLOT_COUNT } from '../layout/layouts';
import { parseView, serializeView } from './lastView';

/**
 * 화면 구성 공유 링크: 지금 보이는 창(방송·페이지)과 화면 모양을 주소 뒤 #view=에 담는다.
 * 받는 쪽은 마지막 화면과 같은 검사(parseView)를 거쳐 연다. 창 크기·선택·소리는 담지 않는다.
 */
export const VIEW_HASH = '#view=';

export function shareUrl(href: string, state: ViewState): string {
  const v = serializeView(state);
  const slots = v.slots.slice(0, SLOT_COUNT[v.layout]);
  while (slots.length && slots[slots.length - 1] === null) slots.pop();
  const u = new URL(href);
  u.search = '';
  u.hash = VIEW_HASH.slice(1) + toBase64Url(JSON.stringify({ v: 1, layout: v.layout, sizes: {}, slots }));
  return u.href;
}

/** 주소의 #view= 를 화면 상태로 (없거나 잘못되면 null) */
export function readSharedView(hash: string): ViewState | null {
  if (!hash.startsWith(VIEW_HASH)) return null;
  try {
    return parseView(JSON.parse(fromBase64Url(hash.slice(VIEW_HASH.length))));
  } catch {
    return null;
  }
}
