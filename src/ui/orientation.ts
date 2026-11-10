/**
 * 휴대폰 전체 화면: 가로 화면으로 돌린다 (Screen Orientation API).
 * 안드로이드 크롬 등은 전체 화면일 때만 허용하고, 아이폰 사파리는 지원하지 않아 조용히 넘어간다.
 */
type Orientation = { lock?(o: 'landscape' | 'portrait'): Promise<void>; unlock?(): void };

const orientation = (): Orientation | undefined => (typeof window !== 'undefined' ? (window.screen as Screen & { orientation?: Orientation }).orientation : undefined);

export function lockLandscape(): void {
  try {
    orientation()?.lock?.('landscape')?.catch(() => {});
  } catch {
    // 지원하지 않음
  }
}

/** 세로 방송 전체 화면: 세로 그대로 */
export function lockPortrait(): void {
  try {
    orientation()?.lock?.('portrait')?.catch(() => {});
  } catch {
    // 지원하지 않음
  }
}

export function unlockOrientation(): void {
  try {
    orientation()?.unlock?.();
  } catch {
    // 지원하지 않음
  }
}
