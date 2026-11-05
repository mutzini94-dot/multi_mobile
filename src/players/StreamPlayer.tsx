import type { Creator } from '../domain/types';
import { TwitchPlayer } from './TwitchPlayer';
import { YouTubePlayer } from './YouTubePlayer';
import type { PlayerHandle, StreamStatus } from './types';

/** onStarting: 트위치가 자동 재생을 시작하는 동안 true (그동안 영상 위에 겹치는 층을 숨겨야 트위치가 재생을 막지 않는다) */
export function StreamPlayer({ creator, onReady, onStatus, onStarting }: { creator: Creator; onReady: (h: PlayerHandle) => void; onStatus?: (s: StreamStatus) => void; onStarting?: (waiting: boolean) => void }) {
  return creator.platform === 'youtube' ? (
    <YouTubePlayer key={creator.key} channel={creator.channel} videoId={creator.videoId} onReady={onReady} onStatus={onStatus} />
  ) : (
    <TwitchPlayer key={creator.key} channel={creator.channel} onReady={onReady} onStatus={onStatus} onStarting={onStarting} />
  );
}
