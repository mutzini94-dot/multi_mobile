import type { Creator, DetachedMark, LayoutKind, PageSlot, SlotItem, ViewState } from '../domain/types';
import { isPinnable, isStream, withSidePage } from '../domain/pages';
import { addWindow, applyLayout, removeWindow, visibleCount, visibleSlots } from '../layout/layouts';

export const initialViewState: ViewState = {
  layout: 'quad',
  slots: Array(9).fill(null), // layouts.MAX_SLOTS
  sizes: {},
  selected: null,
  soundOn: true,
};

export type ViewAction =
  | { type: 'setLayout'; layout: LayoutKind }
  | { type: 'removeWindow'; slot: number } // 빈 창 삭제: 그 창을 빼고 한 단계 작은 레이아웃으로
  | { type: 'addWindow'; layout: LayoutKind; at: number } // 창 추가: 레이아웃을 넓히고 고른 자리를 빈 창으로
  | { type: 'assign'; slot: number; creator: Creator }
  | { type: 'assignPage'; slot: number; page: PageSlot | DetachedMark } // 후원 페이지·웹페이지 창·분리 표시 (선택은 그대로)
  | { type: 'restore'; slot: number; item: SlotItem } // 분리 창에서 되돌린 내용 (숨긴 창이어도, 선택은 그대로)
  | { type: 'clear'; slot: number }
  | { type: 'select'; slot: number }
  | { type: 'swap'; from: number; to: number } // 창 자리 바꾸기 (빈 창이면 옮기기)
  | { type: 'openFirst'; creator: Creator } // 활동 위젯에서 누른 방송을 첫 번째 창에
  | { type: 'pinPage'; slot: number; creator: Creator | null } // 후원 페이지·채팅·시그니처 창을 방송에 고정 (null = 선택한 방송 따라가기)
  | { type: 'toggleSound' }
  | { type: 'setSizes'; group: string; sizes: number[] }
  | { type: 'replace'; state: ViewState };

// 지금 보이는 창만 바꿀 수 있다
const inRange = (state: ViewState, slot: number) => Number.isInteger(slot) && slot >= 0 && slot < visibleCount(state);

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'removeWindow':
      return removeWindow(state, action.slot);
    case 'addWindow':
      return addWindow(state, action.layout, action.at);
    case 'setLayout':
      return withSidePage(applyLayout(state, action.layout));
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
      // 페이지 창은 선택하지 않는다: 선택은 소리·후원 대상이라 페이지를 누를 때 방송 소리가 꺼지면 안 된다
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
    case 'openFirst': {
      // 이미 보이는 창에 있으면 첫 창과 자리만 바꾼다
      const at = visibleSlots(state).findIndex((s) => isStream(s) && s.key === action.creator.key);
      if (at > 0) return { ...viewReducer(state, { type: 'swap', from: at, to: 0 }), selected: 0, soundOn: true };
      // 숨긴 창에 같은 방송이 있으면 비운다 (레이아웃을 되돌렸을 때 같은 방송이 두 창에 뜨지 않게)
      let s = { ...state, slots: state.slots.map((x) => (isStream(x) && x.key === action.creator.key ? null : x)) };
      const first = s.slots[0];
      if (first && !isStream(first) && (first.kind === 'activity' || first.kind === 'detached')) {
        // 첫 창이 활동 위젯·분리 표시면 첫 빈 창(없으면 둘째 창)으로 옮긴다. 1화면이면 2분할로
        if (visibleCount(s) < 2) s = applyLayout(s, 'split2');
        const empty = visibleSlots(s).findIndex((x, i) => i > 0 && !x);
        const to = empty > 0 ? empty : 1;
        const slots = s.slots.slice();
        slots[to] = first;
        s = { ...s, slots };
      }
      return viewReducer(s, { type: 'assign', slot: 0, creator: action.creator });
    }
    case 'pinPage': {
      const page = state.slots[action.slot];
      if (!isPinnable(page)) return state;
      const slots = state.slots.slice();
      const { pin: _old, ...rest } = page;
      if (action.creator) {
        const { live: _live, videoId: _videoId, ...pin } = action.creator; // 라이브 정보는 저장하지 않는다
        slots[action.slot] = { ...rest, pin };
      } else slots[action.slot] = rest;
      return { ...state, slots };
    }
    case 'toggleSound':
      return { ...state, soundOn: !state.soundOn };
    case 'setSizes':
      return { ...state, sizes: { ...state.sizes, [action.group]: action.sizes } };
    case 'replace':
      return action.state;
  }
}
