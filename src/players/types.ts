/** 방송 상태: 재생 중 · 끝남 · 재생할 수 없음(유튜브 오류: 끝났거나 재생 제한) */
export type StreamStatus = 'live' | 'ended' | 'unavailable';

export interface PlayerHandle {
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  setVolume?(volume: number): void; // 0~100
  setPaused?(paused: boolean): void; // 숨긴 칸 정지 · 트위치 일시정지 버튼
  isPaused?(): boolean; // 플레이어 안에서 직접 멈췄는지 (트위치)
  setLowQuality?(low: boolean): void; // 낮은 화질 (트위치만 — 유튜브는 화질 지정을 지원하지 않는다)
  videoId?(): string | null; // 유튜브: 지금 재생 중인 라이브 영상 ID (채팅 칸)
}
