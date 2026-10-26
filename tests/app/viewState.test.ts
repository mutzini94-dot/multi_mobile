import { initialViewState, viewReducer } from '../../src/app/viewState';
import { applyLayout, SLOT_COUNT } from '../../src/layout/layouts';
import { mkCreator } from '../helpers/fixtures';
import type { ViewState } from '../../src/domain/types';

const full: ViewState = {
  layout: 'quad',
  slots: [mkCreator(1), mkCreator(2), mkCreator(3), mkCreator(4)],
  sizes: { root: [30, 70] },
  selected: 3,
  soundOn: true,
};

test('SLOT_COUNT', () => {
  expect(SLOT_COUNT).toEqual({ single: 1, split2: 2, oneTwo: 3, quad: 4 });
});

test('quad→split2: 앞 2칸만 남는다', () => {
  const s = applyLayout(full, 'split2');
  expect(s.slots).toEqual([mkCreator(1), mkCreator(2)]);
});

test('split2→quad: 기존 칸 유지, 뒤는 null', () => {
  const s = applyLayout(applyLayout(full, 'split2'), 'quad');
  expect(s.slots).toEqual([mkCreator(1), mkCreator(2), null, null]);
});

test('선택된 칸(3번)이 사라지면 selected는 null', () => {
  expect(applyLayout(full, 'oneTwo').selected).toBeNull();
});

test('선택된 칸이 남으면 selected 유지', () => {
  expect(applyLayout({ ...full, selected: 1 }, 'split2').selected).toBe(1);
});

test('레이아웃을 바꾸면 sizes는 {}로 초기화', () => {
  expect(applyLayout(full, 'quad').sizes).toEqual({});
});

test('initialViewState', () => {
  expect(initialViewState).toEqual({ layout: 'quad', slots: [null, null, null, null], sizes: {}, selected: null, soundOn: true });
});

test('assign하면 그 칸이 선택된다', () => {
  const s = viewReducer(initialViewState, { type: 'assign', slot: 2, creator: mkCreator(1) });
  expect(s.slots[2]).toEqual(mkCreator(1));
  expect(s.selected).toBe(2);
});

test('빈 칸 select는 무시한다', () => {
  const s = viewReducer({ ...full, slots: [mkCreator(1), null, null, null], selected: 0 }, { type: 'select', slot: 1 });
  expect(s.selected).toBe(0);
});

test('선택된 칸을 clear하면 selected는 null', () => {
  const s = viewReducer(full, { type: 'clear', slot: 3 });
  expect(s.slots[3]).toBeNull();
  expect(s.selected).toBeNull();
});

test('select로 다른 칸을 고르면 soundOn은 true', () => {
  const s = viewReducer({ ...full, soundOn: false }, { type: 'select', slot: 0 });
  expect(s.selected).toBe(0);
  expect(s.soundOn).toBe(true);
});

test('toggleSound', () => {
  expect(viewReducer(full, { type: 'toggleSound' }).soundOn).toBe(false);
});

test('setSizes는 해당 그룹만 바꾼다', () => {
  const s = viewReducer(full, { type: 'setSizes', group: 'col-left', sizes: [40, 60] });
  expect(s.sizes).toEqual({ root: [30, 70], 'col-left': [40, 60] });
});

test('범위를 벗어난 slot은 무시', () => {
  expect(viewReducer(full, { type: 'assign', slot: 9, creator: mkCreator(9) })).toBe(full);
  expect(viewReducer(full, { type: 'select', slot: -1 })).toBe(full);
});

test('replace는 상태를 통째로 바꾼다', () => {
  expect(viewReducer(initialViewState, { type: 'replace', state: full })).toBe(full);
});
