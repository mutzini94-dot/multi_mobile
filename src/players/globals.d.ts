// 사용하는 최소한의 YouTube IFrame API / Twitch Embed API 타입
interface YTPlayer {
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
}
interface TwitchPlayer {
  setMuted(muted: boolean): void;
  getMuted(): boolean;
  addEventListener(event: string, cb: () => void): void;
}
interface Window {
  YT?: { Player: new (el: HTMLElement, opts: { events: { onReady: () => void } }) => YTPlayer };
  onYouTubeIframeAPIReady?: () => void;
  Twitch?: {
    Player: {
      new (el: HTMLElement, opts: { channel: string; parent: string[]; muted: boolean; autoplay: boolean; width: string; height: string }): TwitchPlayer;
      READY: string;
    };
  };
}
