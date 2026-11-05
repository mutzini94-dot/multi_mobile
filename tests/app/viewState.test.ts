import { initialViewState, viewReducer } from '../../src/app/viewState';
import { makeActivityPage } from '../../src/domain/pages';
import { applyLayout, SLOT_COUNT, MAX_SLOTS, visibleSlots } from '../../src/layout/layouts';
import { mkCreator } from '../helpers/fixtures';
import type { ViewState } from '../../src/domain/types';

const full: ViewState = {
  layout: 'quad',
  slots: [mkCreator(1), mkCreator(2), mkCreator(3), mkCreator(4), null, null, null, null, null],
  sizes: { root: [30, 70] },
  selected: 3,
  soundOn: true,
};

test('SLOT_COUNT', () => {
  expect(SLOT_COUNT).toEqual({ wideSide: 2, single: 1, split2: 2, oneTwo: 3, quad: 4, oneThree: 4, oneFive: 6, six: 6, nine: 9 });
});

test('quad→split2: 보이는 칸은 앞 2칸, 나머지 방송은 지우지 않고 보관', () => {
  const s = applyLayout(full, 'split2');
  expect(visibleSlots(s)).toEqual([mkCreator(1), mkCreator(2)]);
  expect(s.slots).toEqual(full.slots);
});

test('quad→single→quad: 방송이 그대로 돌아온다 (초기화되지 않음)', () => {
  const s = applyLayout(applyLayout(full, 'single'), 'quad');
  expect(s.slots).toEqual(full.slots);
});

test('MAX_SLOTS와 칸 수가 모자란 상태는 null로 채움', () => {
  expect(MAX_SLOTS).toBe(9);
  const s = applyLayout({ ...full, slots: [mkCreator(1)] }, 'quad');
  expect(s.slots).toEqual([mkCreator(1), null, null, null, null, null, null, null, null]);
});

test('선택된 칸(3번)이 사라지면 selected는 null', () => {
  expect(applyLayout(full, 'oneTwo').selected).toBeNull();
});

test('선택된 칸이 남으면 selected 유지', () => {
  expect(applyLayout({ ...full, selected: 1 }, 'split2').selected).toBe(1);
});

test('레이아웃을 바꿔도 칸 크기 비율은 유지 (레이아웃별로 따로 기억)', () => {
  expect(applyLayout(full, 'split2').sizes).toEqual({ root: [30, 70] });
});

test('숨겨진 칸에는 assign·select 하지 않는다', () => {
  const s = applyLayout(full, 'split2');
  expect(viewReducer({ ...s, selected: 0 }, { type: 'select', slot: 3 }).selected).toBe(0);
  expect(viewReducer(s, { type: 'assign', slot: 3, creator: mkCreator(9) })).toBe(s);
});

test('initialViewState', () => {
  expect(initialViewState).toEqual({ layout: 'quad', slots: Array(9).fill(null), sizes: {}, selected: null, soundOn: true });
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

describe('swap (칸 자리 바꾸기)', () => {
  const two: ViewState = { layout: 'quad', slots: [mkCreator(1), mkCreator(2), null, null], sizes: {}, selected: 0, soundOn: true };

  test('두 칸의 방송을 맞바꾸고, 선택은 옮겨 간 방송을 따라간다', () => {
    const s = viewReducer(two, { type: 'swap', from: 0, to: 1 });
    expect(s.slots).toEqual([mkCreator(2), mkCreator(1), null, null]);
    expect(s.selected).toBe(1);
  });

  test('빈 칸으로 옮길 수 있다', () => {
    const s = viewReducer(two, { type: 'swap', from: 1, to: 3 });
    expect(s.slots).toEqual([mkCreator(1), null, null, mkCreator(2)]);
    expect(s.selected).toBe(0);
  });

  test('선택된 칸 자리로 다른 방송이 오면 선택도 그 자리(원래 방송)를 따라간다', () => {
    const s = viewReducer(two, { type: 'swap', from: 1, to: 0 });
    expect(s.selected).toBe(1);
  });

  test('같은 칸, 숨겨진 칸, 범위 밖은 무시', () => {
    expect(viewReducer(two, { type: 'swap', from: 1, to: 1 })).toBe(two);
    const split = applyLayout(two, 'split2');
    expect(viewReducer(split, { type: 'swap', from: 0, to: 3 })).toBe(split);
    expect(viewReducer(two, { type: 'swap', from: -1, to: 2 })).toBe(two);
  });
});

describe('openFirst: 활동 위젯에서 누른 방송을 첫 번째 칸에', () => {
  const quad = (slots: ViewState['slots']): ViewState => ({ layout: 'quad', slots: [...slots, ...Array(9 - slots.length).fill(null)], sizes: {}, selected: null, soundOn: false });
  const W = makeActivityPage();

  test('첫 칸에 넣고 선택한다', () => {
    const s = viewReducer(quad([mkCreator(9), mkCreator(1), null, null]), { type: 'openFirst', creator: mkCreator(2) });
    expect(s.slots.slice(0, 4)).toEqual([mkCreator(2), mkCreator(1), null, null]);
    expect(s.selected).toBe(0);
    expect(s.soundOn).toBe(true);
  });

  test('이미 다른 칸에 있으면 첫 칸과 자리만 바꾼다 (중복 없음)', () => {
    const s = viewReducer(quad([mkCreator(9), mkCreator(2), null, null]), { type: 'openFirst', creator: mkCreator(2) });
    expect(s.slots.slice(0, 4)).toEqual([mkCreator(2), mkCreator(9), null, null]);
    expect(s.selected).toBe(0);
  });

  test('첫 칸이 활동 위젯이면 위젯은 첫 빈 칸으로', () => {
    const s = viewReducer(quad([W, mkCreator(1), null, null]), { type: 'openFirst', creator: mkCreator(2) });
    expect(s.slots.slice(0, 4)).toEqual([mkCreator(2), mkCreator(1), W, null]);
  });

  test('1화면에서 위젯뿐이면 2분할로 바꿔 방송은 첫 칸, 위젯은 둘째 칸', () => {
    const s = viewReducer({ ...quad([W]), layout: 'single' }, { type: 'openFirst', creator: mkCreator(2) });
    expect(s.layout).toBe('split2');
    expect(s.slots.slice(0, 2)).toEqual([mkCreator(2), W]);
    expect(s.selected).toBe(0);
  });
});

describe('openFirst: 숨긴 칸·분리 표시', () => {
  const base = (layout: ViewState['layout'], slots: ViewState['slots']): ViewState => ({ layout, slots: [...slots, ...Array(9 - slots.length).fill(null)], sizes: {}, selected: null, soundOn: false });

  test('숨긴 칸에 같은 방송이 있으면 그 칸을 비워 중복을 만들지 않는다', () => {
    const s = viewReducer(base('split2', [mkCreator(9), mkCreator(8), mkCreator(2)]), { type: 'openFirst', creator: mkCreator(2) });
    expect(s.slots[0]).toEqual(mkCreator(2));
    expect(s.slots.filter((x) => x && 'key' in x && x.key === mkCreator(2).key)).toHaveLength(1);
  });

  test('첫 칸이 분리 표시면 덮어쓰지 않고 빈 칸으로 옮긴다', () => {
    const mark = { kind: 'detached' as const, key: 'detached:1', name: '분리', id: 'w1' };
    const s = viewReducer(base('quad', [mark, mkCreator(1), null, null]), { type: 'openFirst', creator: mkCreator(2) });
    expect(s.slots.slice(0, 4)).toEqual([mkCreator(2), mkCreator(1), mark, null]);
  });
});

test('pinPage: 페이지 칸을 방송에 고정·해제 (방송 칸·웹 칸은 그대로)', async () => {
  const { makeDonatePage, makeWebPage } = await import('../../src/domain/pages');
  const s0: ViewState = { layout: 'quad', slots: [mkCreator(1), makeDonatePage(), null, null, null, null, null, null, null], sizes: {}, selected: 0, soundOn: true };
  const s1 = viewReducer(s0, { type: 'pinPage', slot: 1, creator: mkCreator(1) });
  expect(s1.slots[1]).toMatchObject({ kind: 'donate', pin: { key: 'twitch:chan_1' } });
  const s2 = viewReducer(s1, { type: 'pinPage', slot: 1, creator: null });
  expect(s2.slots[1]).not.toHaveProperty('pin');
  expect(viewReducer(s0, { type: 'pinPage', slot: 0, creator: mkCreator(2) })).toBe(s0);
  const w = makeWebPage('naver.com');
  const s3: ViewState = { ...s0, slots: [w.ok ? w.value : null, ...s0.slots.slice(1)] };
  expect(viewReducer(s3, { type: 'pinPage', slot: 0, creator: mkCreator(2) })).toBe(s3);
});

test('큰 화면+1로 바꾸면 비어 있는 오른쪽 칸에 후원 페이지를 넣는다 (차 있으면 그대로)', () => {
  const s = viewReducer(initialViewState, { type: 'setLayout', layout: 'wideSide' });
  expect(s.layout).toBe('wideSide');
  expect(s.slots[0]).toBeNull();
  expect(s.slots[1]).toMatchObject({ kind: 'donate' });
  const busy = { ...initialViewState, slots: [null, mkCreator(2), ...Array(7).fill(null)] };
  expect(viewReducer(busy, { type: 'setLayout', layout: 'wideSide' }).slots[1]).toBe(busy.slots[1]);
  expect(viewReducer(initialViewState, { type: 'setLayout', layout: 'split2' }).slots[1]).toBeNull();
});
