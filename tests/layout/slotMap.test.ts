import { SLOT_MAP } from '../../src/layout/slotMap';
import { LAYOUTS, SLOT_COUNT } from '../../src/layout/layouts';

test('레이아웃마다 칸 수만큼 자리가 있고, 자리가 겹치지 않는다', () => {
  for (const l of LAYOUTS) {
    const m = SLOT_MAP[l];
    expect(m.areas).toHaveLength(SLOT_COUNT[l]);
    const used = new Set<string>();
    for (const [row, col, rowSpan, colSpan] of m.areas)
      for (let r = row; r < row + rowSpan; r++)
        for (let c = col; c < col + colSpan; c++) {
          expect(used.has(`${r},${c}`)).toBe(false);
          used.add(`${r},${c}`);
        }
    expect(used.size).toBe(m.rows.length * m.cols.length); // 빈자리 없이 채운다
  }
});

test('칸 번호는 실제 화면 배치와 같다 (4분할·6분할은 열 순서, 1+2는 왼쪽 위아래·오른쪽 큰 칸)', () => {
  expect(SLOT_MAP.quad.areas).toEqual([
    [1, 1, 1, 1],
    [2, 1, 1, 1],
    [1, 2, 1, 1],
    [2, 2, 1, 1],
  ]);
  expect(SLOT_MAP.oneTwo.areas[2]).toEqual([1, 2, 2, 1]);
  expect(SLOT_MAP.six.areas[2]).toEqual([1, 2, 1, 1]);
  expect(SLOT_MAP.oneFive.areas[0]).toEqual([1, 1, 2, 2]);
  expect(SLOT_MAP.nine.areas[5]).toEqual([3, 2, 1, 1]);
});
