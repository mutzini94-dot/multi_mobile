import { render } from '@testing-library/react';
import { addWindow, applyLayout, growLayouts, removeWindow, shrinkLayout, LAYOUT_LABEL, LAYOUTS, MAX_SLOTS, SLOT_COUNT } from '../../src/layout/layouts';
import { initialViewState } from '../../src/app/viewState';
import { TileGrid } from '../../src/ui/TileGrid';
import { mkCreator } from '../helpers/fixtures';
import type { LayoutKind } from '../../src/domain/types';

test('레이아웃: 맨 앞 큰 화면+1, 1·2·1+2·4분할에 큰 화면+3·큰 화면+5·6분할·9분할', () => {
  expect(LAYOUTS).toEqual(['wideSide', 'single', 'split2', 'oneTwo', 'quad', 'oneThree', 'oneFive', 'six', 'nine']);
  expect(LAYOUTS.map((l) => SLOT_COUNT[l])).toEqual([2, 1, 2, 3, 4, 4, 6, 6, 9]);
  expect(LAYOUT_LABEL.wideSide).toBe('큰 화면+1');
  expect(LAYOUT_LABEL.nine).toBe('9분할');
  expect(MAX_SLOTS).toBe(9);
});

test('9분할에서 4분할로 줄였다 다시 늘리면 숨겼던 칸이 그대로 돌아온다', () => {
  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => mkCreator(i + 1));
  const nine = { ...applyLayout(initialViewState, 'nine'), slots };
  const quad = applyLayout(nine, 'quad');
  expect(quad.slots).toHaveLength(9);
  expect(applyLayout(quad, 'nine').slots.map((c) => c?.name)).toEqual(slots.map((c) => c.name));
});

test('예전 4칸 상태도 9칸으로 늘려 보관한다', () => {
  const s = applyLayout({ ...initialViewState, slots: [mkCreator(1), null, null, null] }, 'six');
  expect(s.slots).toHaveLength(9);
});

test.each<[LayoutKind, number]>([
  ['wideSide', 2],
  ['oneThree', 4],
  ['oneFive', 6],
  ['six', 6],
  ['nine', 9],
])('TileGrid %s: 칸 %i개를 그린다', (layout, n) => {
  const state = applyLayout(initialViewState, layout);
  const { container } = render(<TileGrid state={state} onSizes={() => {}} renderTile={(slot) => <div className="t" data-slot={slot} />} />);
  expect([...container.querySelectorAll('.t')].map((e) => Number((e as HTMLElement).dataset.slot)).sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
});

test('큰 화면+1: 왼쪽 큰 칸이 처음부터 넓다 (오른쪽은 좁은 칸)', () => {
  const state = applyLayout(initialViewState, 'wideSide');
  const { container } = render(<TileGrid state={state} onSizes={() => {}} renderTile={(slot) => <div className="t" data-slot={slot} />} />);
  const panels = [...container.querySelectorAll('[data-panel]')] as HTMLElement[];
  const grow = panels.map((p) => Number(p.style.flexGrow));
  expect(grow[0]).toBeGreaterThan(grow[1] * 2);
});

test('창 추가: 지금보다 칸이 가장 적게 늘어나는 레이아웃들', () => {
  expect(growLayouts('single')).toEqual(['wideSide', 'split2']);
  expect(growLayouts('wideSide')).toEqual(['oneTwo']);
  expect(growLayouts('oneTwo')).toEqual(['quad', 'oneThree']);
  expect(growLayouts('quad')).toEqual(['oneFive', 'six']);
  expect(growLayouts('nine')).toEqual([]);
});

test('창 추가: 고른 자리는 빈 칸, 원래 칸은 순서대로 나머지 자리에 (숨겨 둔 방송은 뒤에 보관, 선택은 따라감)', () => {
  const a = mkCreator(1);
  const b = mkCreator(2);
  const hidden = mkCreator(9);
  const state = { ...applyLayout(initialViewState, 'wideSide'), slots: [a, b, hidden, null, null, null, null, null, null], selected: 1 };
  const s = addWindow(state, 'oneTwo', 0);
  expect(s.layout).toBe('oneTwo');
  expect(s.slots.slice(0, 3)).toEqual([null, a, b]);
  expect(s.slots).toHaveLength(MAX_SLOTS);
  expect(s.slots).toContain(hidden);
  expect(s.selected).toBe(2);
  const six = addWindow({ ...applyLayout(initialViewState, 'quad'), slots: [a, b, null, null, hidden, null, null, null, null] }, 'six', 5);
  expect(six.slots.slice(0, 6)).toEqual([a, b, null, null, null, null]);
  expect(six.slots.slice(6)).toContain(hidden);
});

test('빈 창 삭제: 한 단계 작은 레이아웃으로, 남은 창은 순서대로 (숨겨 둔 방송은 보관, 선택은 따라감)', () => {
  const a = mkCreator(1);
  const b = mkCreator(2);
  const hidden = mkCreator(9);
  const quad = { ...applyLayout(initialViewState, 'quad'), slots: [a, null, b, null, hidden, null, null, null, null], selected: 2 };
  expect(shrinkLayout(quad, 1)).toBe('oneTwo');
  const s = removeWindow(quad, 1);
  expect(s.layout).toBe('oneTwo');
  expect(s.slots.slice(0, 3)).toEqual([a, b, null]);
  expect(s.slots).toHaveLength(MAX_SLOTS);
  expect(s.slots).toContain(hidden);
  expect(s.selected).toBe(1);
  // 6분할에서 남은 4칸이 다 차 있어도 4분할로
  const six = { ...applyLayout(initialViewState, 'six'), slots: [a, b, mkCreator(3), mkCreator(4), null, null, null, null, null] };
  expect(removeWindow(six, 5).layout).toBe('quad');
  expect(removeWindow(six, 5).slots.slice(0, 4)).toEqual(six.slots.slice(0, 4));
});

test('빈 창 삭제를 할 수 없는 경우: 방송이 있는 칸, 1화면, 줄이면 방송이 가려질 때', () => {
  const full6 = { ...applyLayout(initialViewState, 'six'), slots: [1, 2, 3, 4, 5].map((n) => mkCreator(n)).concat([null, null, null, null] as never[]) };
  expect(shrinkLayout(full6, 5)).toBeNull();
  expect(shrinkLayout(full6, 0)).toBeNull();
  expect(shrinkLayout(applyLayout(initialViewState, 'single'), 0)).toBeNull();
  expect(removeWindow(full6, 5)).toBe(full6);
  expect(shrinkLayout(applyLayout(initialViewState, 'wideSide'), 0)).toBe('single');
});
