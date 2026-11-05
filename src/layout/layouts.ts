import type { LayoutKind, ViewState } from '../domain/types';

export const SLOT_COUNT: Record<LayoutKind, number> = { wideSide: 2, single: 1, split2: 2, oneTwo: 3, quad: 4, oneThree: 4, oneFive: 6, six: 6, nine: 9 };

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
};

/** 상단 레이아웃 버튼 순서 */
export const LAYOUTS: LayoutKind[] = ['wideSide', 'single', 'split2', 'oneTwo', 'quad', 'oneThree', 'oneFive', 'six', 'nine'];

/** 칸은 항상 MAX_SLOTS개를 보관하고, 레이아웃은 그중 앞의 몇 칸을 보여줄지만 정한다. */
export const MAX_SLOTS = 9;

export function visibleCount(state: Pick<ViewState, 'layout'>): number {
  return SLOT_COUNT[state.layout];
}

/**
 * 칸마다 플레이어 키: 칸 번호가 아니라 방송(같은 방송이 여럿이면 순번)으로 정한다.
 * 칸 자리를 바꿔도 키가 그대로라 플레이어(iframe)를 다시 만들지 않는다.
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
 * 레이아웃만 바꾼다. 화면에서 빠지는 칸의 방송은 지우지 않고 보관해 두었다가(숨김·음소거)
 * 다시 칸을 늘리면 그대로 보여준다. 칸 크기 비율은 레이아웃별로 따로 기억한다(TileGrid가 레이아웃별 키 사용).
 * 선택된 칸이 숨겨지면 선택을 푼다 (숨은 방송에서 소리가 나지 않게).
 */
export function applyLayout(state: ViewState, layout: LayoutKind): ViewState {
  const count = SLOT_COUNT[layout];
  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => state.slots[i] ?? null);
  const selected = state.selected !== null && state.selected < count ? state.selected : null;
  return { ...state, layout, slots, selected };
}

/** 창 추가: 지금보다 칸이 많은 레이아웃 중 가장 적게 늘어나는 것들 (버튼 순서대로) */
export function growLayouts(layout: LayoutKind): LayoutKind[] {
  const now = SLOT_COUNT[layout];
  const bigger = LAYOUTS.filter((l) => SLOT_COUNT[l] > now);
  if (!bigger.length) return [];
  const next = Math.min(...bigger.map((l) => SLOT_COUNT[l]));
  return bigger.filter((l) => SLOT_COUNT[l] === next);
}

/**
 * 창 추가: 레이아웃을 넓히고 고른 자리(at)를 빈 칸으로 둔다.
 * 지금 보이는 칸은 순서대로 나머지 자리에, 늘어난 다른 자리는 빈 칸. 숨겨 두었던 방송은 그 뒤에 보관한다.
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
