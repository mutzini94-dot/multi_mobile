import { render } from '@testing-library/react';
import { addWindow, applyLayout, growLayouts, LAYOUT_LABEL, LAYOUTS, MAX_SLOTS, SLOT_COUNT } from '../../src/layout/layouts';
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
