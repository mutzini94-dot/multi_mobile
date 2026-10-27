export interface PlayerHandle {
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  setVolume?(volume: number): void; // 0~100
  setPaused?(paused: boolean): void; // 숨긴 칸 정지
  setLowQuality?(low: boolean): void; // 낮은 화질 (트위치만 — 유튜브는 화질 지정을 지원하지 않는다)
}
