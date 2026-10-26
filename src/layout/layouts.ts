import type { LayoutKind, ViewState } from '../domain/types';

export const SLOT_COUNT: Record<LayoutKind, number> = { single: 1, split2: 2, oneTwo: 3, quad: 4 };

export const LAYOUT_LABEL: Record<LayoutKind, string> = { single: '1화면', split2: '2분할', oneTwo: '1+2', quad: '4분할' };

/** 칸 수에 맞게 자르거나 null로 채운다. 넘치는 방송은 버린다. */
export function applyLayout(state: ViewState, layout: LayoutKind): ViewState {
  const count = SLOT_COUNT[layout];
  const slots = Array.from({ length: count }, (_, i) => state.slots[i] ?? null);
  const selected = state.selected !== null && state.selected < count ? state.selected : null;
  return { ...state, layout, slots, selected, sizes: {} };
}
