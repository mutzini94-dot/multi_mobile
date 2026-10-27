import type { Creator, LayoutKind, ViewState } from '../domain/types';
import { applyLayout, visibleCount } from '../layout/layouts';

export const initialViewState: ViewState = {
  layout: 'quad',
  slots: [null, null, null, null],
  sizes: {},
  selected: null,
  soundOn: true,
};

export type ViewAction =
  | { type: 'setLayout'; layout: LayoutKind }
  | { type: 'assign'; slot: number; creator: Creator }
  | { type: 'clear'; slot: number }
  | { type: 'select'; slot: number }
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
    case 'clear': {
      if (!inRange(state, action.slot)) return state;
      const slots = state.slots.slice();
      slots[action.slot] = null;
      return { ...state, slots, selected: state.selected === action.slot ? null : state.selected };
    }
    case 'select':
      if (!inRange(state, action.slot) || !state.slots[action.slot]) return state;
      return { ...state, selected: action.slot, soundOn: true };
    case 'toggleSound':
      return { ...state, soundOn: !state.soundOn };
    case 'setSizes':
      return { ...state, sizes: { ...state.sizes, [action.group]: action.sizes } };
    case 'replace':
      return action.state;
  }
}
