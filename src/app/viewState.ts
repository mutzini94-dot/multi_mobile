import type { Creator, DetachedMark, LayoutKind, PageSlot, SlotItem, ViewState } from '../domain/types';
import { isStream } from '../domain/pages';
import { applyLayout, visibleCount } from '../layout/layouts';

export const initialViewState: ViewState = {
  layout: 'quad',
  slots: Array(9).fill(null), // layouts.MAX_SLOTS
  sizes: {},
  selected: null,
  soundOn: true,
};

export type ViewAction =
  | { type: 'setLayout'; layout: LayoutKind }
  | { type: 'assign'; slot: number; creator: Creator }
  | { type: 'assignPage'; slot: number; page: PageSlot | DetachedMark } // 후원 페이지·웹페이지 칸·분리 표시 (선택은 그대로)
  | { type: 'restore'; slot: number; item: SlotItem } // 분리 창에서 되돌린 내용 (숨긴 칸이어도, 선택은 그대로)
  | { type: 'clear'; slot: number }
  | { type: 'select'; slot: number }
  | { type: 'swap'; from: number; to: number } // 칸 자리 바꾸기 (빈 칸이면 옮기기)
  | { type: 'toggleSound' }
  | { type: 'setSizes'; group: string; sizes: number[] }
  | { type: 'replace'; state: ViewState };

// 지금 보이는 칸만 바꿀 수 있다
const inRange = (state: ViewState, slot: number) => Number.isInteger(slot) && slot >= 0 && slot < visibleCount(state);

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'setLayout':
      return applyLayout(state, action.layout);
    case 'assign': {
      if (!inRange(state, action.slot)) return state;
      const slots = state.slots.slice();
      slots[action.slot] = action.creator;
      return { ...state, slots, selected: action.slot, soundOn: true };
    }
    case 'assignPage': {
      if (!inRange(state, action.slot)) return state;
      const slots = state.slots.slice();
      slots[action.slot] = action.page;
      return { ...state, slots, selected: state.selected === action.slot ? null : state.selected };
    }
    case 'restore': {
      if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot >= state.slots.length) return state;
      const slots = state.slots.slice();
      slots[action.slot] = action.item;
      return { ...state, slots };
    }
    case 'clear': {
      if (!inRange(state, action.slot)) return state;
      const slots = state.slots.slice();
      slots[action.slot] = null;
      return { ...state, slots, selected: state.selected === action.slot ? null : state.selected };
    }
    case 'select':
      // 페이지 칸은 선택하지 않는다: 선택은 소리·후원 대상이라 페이지를 누를 때 방송 소리가 꺼지면 안 된다
      if (!inRange(state, action.slot) || !isStream(state.slots[action.slot])) return state;
      return { ...state, selected: action.slot, soundOn: true };
    case 'swap': {
      if (!inRange(state, action.from) || !inRange(state, action.to) || action.from === action.to) return state;
      const slots = state.slots.slice();
      [slots[action.from], slots[action.to]] = [slots[action.to], slots[action.from]];
      // 선택은 방송을 따라간다
      const selected = state.selected === action.from ? action.to : state.selected === action.to ? action.from : state.selected;
      return { ...state, slots, selected };
    }
    case 'toggleSound':
      return { ...state, soundOn: !state.soundOn };
    case 'setSizes':
      return { ...state, sizes: { ...state.sizes, [action.group]: action.sizes } };
    case 'replace':
      return action.state;
  }
}
