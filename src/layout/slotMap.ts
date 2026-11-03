import type { LayoutKind } from '../domain/types';

/** 칸 자리: [행, 열, 행 칸 수, 열 칸 수] (1부터) */
export type SlotArea = [number, number, number, number];

/** 레이아웃별 칸 배치 (TileGrid와 같은 번호 순서): 칸 고르기 창에서 화면 모양 그대로 그린다 */
export const SLOT_MAP: Record<LayoutKind, { cols: string[]; rows: string[]; areas: SlotArea[] }> = {
  single: { cols: ['1fr'], rows: ['1fr'], areas: [[1, 1, 1, 1]] },
  split2: { cols: ['1fr', '1fr'], rows: ['1fr'], areas: [[1, 1, 1, 1], [1, 2, 1, 1]] },
  oneTwo: { cols: ['1fr', '1fr'], rows: ['1fr', '1fr'], areas: [[1, 1, 1, 1], [2, 1, 1, 1], [1, 2, 2, 1]] },
  quad: { cols: ['1fr', '1fr'], rows: ['1fr', '1fr'], areas: [[1, 1, 1, 1], [2, 1, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1]] },
  oneThree: { cols: ['3fr', '1fr'], rows: ['1fr', '1fr', '1fr'], areas: [[1, 1, 3, 1], [1, 2, 1, 1], [2, 2, 1, 1], [3, 2, 1, 1]] },
  oneFive: {
    cols: ['1fr', '1fr', '1fr'],
    rows: ['1fr', '1fr', '1fr'],
    areas: [[1, 1, 2, 2], [1, 3, 1, 1], [2, 3, 1, 1], [3, 1, 1, 1], [3, 2, 1, 1], [3, 3, 1, 1]],
  },
  six: { cols: ['1fr', '1fr', '1fr'], rows: ['1fr', '1fr'], areas: [0, 1, 2, 3, 4, 5].map((s): SlotArea => [(s % 2) + 1, Math.floor(s / 2) + 1, 1, 1]) },
  nine: { cols: ['1fr', '1fr', '1fr'], rows: ['1fr', '1fr', '1fr'], areas: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((s): SlotArea => [(s % 3) + 1, Math.floor(s / 3) + 1, 1, 1]) },
};
