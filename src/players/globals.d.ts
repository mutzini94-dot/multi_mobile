// 사용하는 최소한의 YouTube IFrame API / Twitch Embed API 타입
interface YTPlayer {
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  pauseVideo(): void;
  playVideo(): void;
  getVideoData?(): { video_id?: string };
}
interface TwitchPlayer {
  setMuted(muted: boolean): void;
  getMuted(): boolean;
  setVolume(v: number): void; // 0~1
  pause(): void;
  play(): void;
  isPaused?(): boolean;
  setQuality(group: string): void;
  getQualities?(): { group: string }[];
  addEventListener(event: string, cb: () => void): void;
}
interface Window {
  YT?: { Player: new (el: HTMLElement, opts: { events: { onReady: () => void; onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void } }) => YTPlayer };
  onYouTubeIframeAPIReady?: () => void;
  Twitch?: {
    Player: {
      new (el: HTMLElement, opts: { channel: string; parent: string[]; muted: boolean; autoplay: boolean; width: string; height: string }): TwitchPlayer;
      READY: string;
      ONLINE?: string;
      OFFLINE?: string;
      ENDED?: string;
      PLAYING?: string;
    };
  };
}
