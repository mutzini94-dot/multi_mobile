/** 짧은 진동 (안드로이드 등 지원하는 휴대폰만, 나머지는 아무 일도 없다) */
export function haptic(ms = 10): void {
  try {
    (navigator as Navigator & { vibrate?(p: number): boolean }).vibrate?.(ms);
  } catch {
    // 막힌 환경
  }
}
