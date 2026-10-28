import { render } from '@testing-library/react';
import { applyLayout, LAYOUT_LABEL, LAYOUTS, MAX_SLOTS, SLOT_COUNT } from '../../src/layout/layouts';
import { initialViewState } from '../../src/app/viewState';
import { TileGrid } from '../../src/ui/TileGrid';
import { mkCreator } from '../helpers/fixtures';
import type { LayoutKind } from '../../src/domain/types';

test('레이아웃: 1·2·1+2·4분할에 큰 화면+3·큰 화면+5·6분할·9분할', () => {
  expect(LAYOUTS).toEqual(['single', 'split2', 'oneTwo', 'quad', 'oneThree', 'oneFive', 'six', 'nine']);
  expect(LAYOUTS.map((l) => SLOT_COUNT[l])).toEqual([1, 2, 3, 4, 4, 6, 6, 9]);
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
  ['oneThree', 4],
  ['oneFive', 6],
  ['six', 6],
  ['nine', 9],
])('TileGrid %s: 칸 %i개를 그린다', (layout, n) => {
  const state = applyLayout(initialViewState, layout);
  const { container } = render(<TileGrid state={state} onSizes={() => {}} renderTile={(slot) => <div className="t" data-slot={slot} />} />);
  expect([...container.querySelectorAll('.t')].map((e) => Number((e as HTMLElement).dataset.slot)).sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
});
