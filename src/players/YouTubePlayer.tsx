import { useEffect, useRef } from 'react';
import { loadScript } from './loadScript';
import type { PlayerHandle } from './types';

let apiReady: Promise<void> | null = null;

function whenYouTubeApiReady(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiReady) {
    apiReady = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
    });
    loadScript('https://www.youtube.com/iframe_api').catch(() => {
      apiReady = null;
    });
  }
  return apiReady;
}

export function YouTubePlayer({ channel, videoId, onReady }: { channel: string; videoId?: string; onReady: (h: PlayerHandle) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let alive = true;
    whenYouTubeApiReady().then(() => {
      if (!alive || !ref.current || !window.YT) return;
      const player = new window.YT.Player(ref.current, {
        events: {
          onReady: () => {
            if (!alive) return;
            onReadyRef.current({
              setMuted: (m) => (m ? player.mute() : player.unMute()),
              isMuted: () => player.isMuted(),
              setVolume: (v) => player.setVolume(v),
              setPaused: (p) => (p ? player.pauseVideo() : player.playVideo()),
              // 화질 지정(setPlaybackQuality)은 유튜브가 없앴으므로 제공하지 않는다
            });
          },
        },
      });
    });
    return () => {
      alive = false;
    };
  }, [channel]);

  return (
    <iframe
      ref={ref}
      title={`YouTube ${channel}`}
      // 라이브 영상 ID를 알면 그 영상으로 (채널 라이브 임베드가 '볼 수 없음'이 되는 채널이 있다)
      src={
        videoId
          ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&autoplay=1&mute=1`
          : `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channel)}&enablejsapi=1&autoplay=1&mute=1`
      }
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      style={{ width: '100%', height: '100%', border: 0 }}
    />
  );
}
