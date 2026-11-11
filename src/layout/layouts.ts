import type { LayoutKind, ViewState } from '../domain/types';

export const SLOT_COUNT: Record<LayoutKind, number> = { wideSide: 2, single: 1, split2: 2, oneTwo: 3, quad: 4, oneThree: 4, oneFive: 6, six: 6, nine: 9, twelve: 12, sixteen: 16 };

export const LAYOUT_LABEL: Record<LayoutKind, string> = {
  wideSide: '큰 화면+1',
  single: '1화면',
  split2: '2분할',
  oneTwo: '1+2',
  quad: '4분할',
  oneThree: '큰 화면+3',
  oneFive: '큰 화면+5',
  six: '6분할',
  nine: '9분할',
  twelve: '12분할',
  sixteen: '16분할',
};

/** 상단 레이아웃 버튼 순서 */
export const LAYOUTS: LayoutKind[] = ['wideSide', 'single', 'split2', 'oneTwo', 'quad', 'oneThree', 'oneFive', 'six', 'nine', 'twelve', 'sixteen'];

/** 창은 항상 MAX_SLOTS개를 보관하고, 레이아웃은 그중 앞의 몇 창을 보여줄지만 정한다. */
export const MAX_SLOTS = 16;

export function visibleCount(state: Pick<ViewState, 'layout'>): number {
  return SLOT_COUNT[state.layout];
}

/**
 * 창마다 플레이어 키: 창 번호가 아니라 방송(같은 방송이 여럿이면 순번)으로 정한다.
 * 창 자리를 바꿔도 키가 그대로라 플레이어(iframe)를 다시 만들지 않는다.
 */
export function playerKeys(slots: ViewState['slots']): (string | null)[] {
  const seen = new Map<string, number>();
  return slots.map((c) => {
    if (!c) return null;
    const n = seen.get(c.key) ?? 0;
    seen.set(c.key, n + 1);
    return `${c.key}#${n}`;
  });
}

export function visibleSlots(state: ViewState): (ViewState['slots'][number])[] {
  return state.slots.slice(0, visibleCount(state));
}

/**
 * 레이아웃만 바꾼다. 화면에서 빠지는 창의 방송은 지우지 않고 보관해 두었다가(숨김·음소거)
 * 다시 창을 늘리면 그대로 보여준다. 창 크기 비율은 레이아웃별로 따로 기억한다(TileGrid가 레이아웃별 키 사용).
 * 선택된 창이 숨겨지면 선택을 푼다 (숨은 방송에서 소리가 나지 않게).
 */
export function applyLayout(state: ViewState, layout: LayoutKind): ViewState {
  const count = SLOT_COUNT[layout];
  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => state.slots[i] ?? null);
  const selected = state.selected !== null && state.selected < count ? state.selected : null;
  return { ...state, layout, slots, selected };
}

/** 창 추가: 지금보다 창이 많은 레이아웃 중 가장 적게 늘어나는 것들 (버튼 순서대로) */
export function growLayouts(layout: LayoutKind): LayoutKind[] {
  const now = SLOT_COUNT[layout];
  const bigger = LAYOUTS.filter((l) => SLOT_COUNT[l] > now);
  if (!bigger.length) return [];
  const next = Math.min(...bigger.map((l) => SLOT_COUNT[l]));
  return bigger.filter((l) => SLOT_COUNT[l] === next);
}

/**
 * 창 추가: 레이아웃을 넓히고 고른 자리(at)를 빈 창으로 둔다.
 * 지금 보이는 창은 순서대로 나머지 자리에, 늘어난 다른 자리는 빈 창. 숨겨 두었던 방송은 그 뒤에 보관한다.
 */
export function addWindow(state: ViewState, layout: LayoutKind, at: number): ViewState {
  const count = SLOT_COUNT[layout];
  const old = visibleCount(state);
  if (count <= old || !Number.isInteger(at) || at < 0 || at >= count) return state;
  const visible = state.slots.slice(0, old);
  const hidden = state.slots.slice(old).filter((s) => s !== null);
  const slots: ViewState['slots'] = [];
  let next = 0;
  let selected: number | null = null;
  for (let i = 0; i < count; i++) {
    if (i === at || next >= old) {
      slots.push(null);
      continue;
    }
    if (state.selected === next) selected = i;
    slots.push(visible[next++] ?? null);
  }
  const rest = [...hidden, ...Array(MAX_SLOTS).fill(null)].slice(0, MAX_SLOTS - count);
  return { ...state, layout, slots: [...slots, ...rest], selected };
}

/** 빈 창 삭제: 한 단계 작은 레이아웃 (같은 모양 계열로) */
const SHRINK: Record<LayoutKind, LayoutKind | null> = {
  sixteen: 'twelve',
  twelve: 'nine',
  nine: 'six',
  six: 'quad',
  oneFive: 'oneThree',
  oneThree: 'oneTwo',
  quad: 'oneTwo',
  oneTwo: 'split2',
  split2: 'single',
  wideSide: 'single',
  single: null,
};

/** 빈 창 at을 빼고 남는 창들: 늘어놓을 창 수보다 많으면 뒤쪽 빈 창부터 뺀다 (방송이 가려지면 null) */
function remainAfterRemove(state: ViewState, at: number, count: number): ViewState['slots'] | null {
  const rest = state.slots.slice(0, visibleCount(state)).filter((_, i) => i !== at);
  for (let i = rest.length - 1; rest.length > count && i >= 0; i--) if (rest[i] === null) rest.splice(i, 1);
  return rest.length <= count ? rest : null;
}

/** 빈 창 at을 지웠을 때의 레이아웃 (지울 수 없으면 null: 방송이 있는 창, 1화면, 줄이면 방송이 가려질 때) */
export function shrinkLayout(state: ViewState, at: number): LayoutKind | null {
  const to = SHRINK[state.layout];
  if (!to || !Number.isInteger(at) || at < 0 || at >= visibleCount(state) || state.slots[at] !== null) return null;
  return remainAfterRemove(state, at, SLOT_COUNT[to]) ? to : null;
}

/** 빈 창 삭제: 그 창을 빼고 한 단계 작은 레이아웃으로. 남은 창은 순서대로, 숨겨 둔 방송은 뒤에 보관한다 */
export function removeWindow(state: ViewState, at: number): ViewState {
  const layout = shrinkLayout(state, at);
  if (!layout) return state;
  const count = SLOT_COUNT[layout];
  const old = visibleCount(state);
  const rest = remainAfterRemove(state, at, count)!;
  const visible = [...rest, ...Array(count).fill(null)].slice(0, count);
  const hidden = state.slots.slice(old).filter((s) => s !== null);
  const slots = [...visible, ...hidden, ...Array(MAX_SLOTS).fill(null)].slice(0, MAX_SLOTS);
  const sel = state.selected !== null ? state.slots[state.selected] : null;
  const selected = sel ? visible.indexOf(sel) : -1;
  return { ...state, layout, slots, selected: selected >= 0 ? selected : null };
}
