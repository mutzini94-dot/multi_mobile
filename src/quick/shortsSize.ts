import type { KV } from '../storage/safeStorage';

/** 퀵패널 '추천 라이브 탐색' 창 너비: 사용자가 조절한 값을 기억한다 */
export const SHORTS_WIDTH_KEY = 'mv.shortsWidth.v1';
export const SHORTS_DEFAULT_WIDTH = 380;
export const SHORTS_MIN_WIDTH = 300;

/** 화면 너비에 맞춰 최소~최대 사이로 (퀵패널과 여백 몫은 남긴다) */
export function clampShortsWidth(w: number, viewport: number): number {
  const max = Math.max(SHORTS_MIN_WIDTH, viewport - 160);
  return Math.round(Math.min(max, Math.max(SHORTS_MIN_WIDTH, w)));
}

export function readShortsWidth(kv: KV): number | null {
  const n = Number(kv.get(SHORTS_WIDTH_KEY));
  return Number.isFinite(n) && n >= SHORTS_MIN_WIDTH ? n : null;
}
