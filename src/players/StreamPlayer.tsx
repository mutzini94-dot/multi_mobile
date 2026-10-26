import type { Creator } from '../domain/types';
import { TwitchPlayer } from './TwitchPlayer';
import { YouTubePlayer } from './YouTubePlayer';
import type { PlayerHandle } from './types';

export function StreamPlayer({ creator, onReady }: { creator: Creator; onReady: (h: PlayerHandle) => void }) {
  return creator.platform === 'youtube' ? (
    <YouTubePlayer key={creator.key} channel={creator.channel} onReady={onReady} />
  ) : (
    <TwitchPlayer key={creator.key} channel={creator.channel} onReady={onReady} />
  );
}
