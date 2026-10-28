import type { Creator } from '../domain/types';
import { TwitchPlayer } from './TwitchPlayer';
import { YouTubePlayer } from './YouTubePlayer';
import type { PlayerHandle, StreamStatus } from './types';

export function StreamPlayer({ creator, onReady, onStatus }: { creator: Creator; onReady: (h: PlayerHandle) => void; onStatus?: (s: StreamStatus) => void }) {
  return creator.platform === 'youtube' ? (
    <YouTubePlayer key={creator.key} channel={creator.channel} videoId={creator.videoId} onReady={onReady} onStatus={onStatus} />
  ) : (
    <TwitchPlayer key={creator.key} channel={creator.channel} onReady={onReady} onStatus={onStatus} />
  );
}
