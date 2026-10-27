import { useEffect, useRef } from 'react';
import { loadScript } from './loadScript';
import type { PlayerHandle } from './types';

export function TwitchPlayer({ channel, onReady }: { channel: string; onReady: (h: PlayerHandle) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    loadScript('https://player.twitch.tv/js/embed/v1.js')
      .then(() => {
        if (!alive || !el || !window.Twitch) return;
        const Player = window.Twitch.Player;
        const player = new Player(el, {
          channel,
          parent: [window.location.hostname],
          muted: true,
          autoplay: true,
          width: '100%',
          height: '100%',
        });
        player.addEventListener(Player.READY, () => {
          if (!alive) return;
          onReadyRef.current({
            setMuted: (m) => player.setMuted(m),
            isMuted: () => player.getMuted(),
            setVolume: (v) => player.setVolume(v / 100),
            setPaused: (p) => (p ? player.pause() : player.play()),
            setLowQuality: (low) => {
              if (!low) return player.setQuality('auto');
              // 가장 낮은 화질: 'auto'·'chunked'(원본)를 뺀 목록의 마지막 (트위치는 높은 화질부터 준다)
              const groups = (player.getQualities?.() ?? []).map((q) => q.group).filter((g) => g && g !== 'auto' && g !== 'chunked');
              if (groups.length) player.setQuality(groups[groups.length - 1]);
            },
          });
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (el) el.innerHTML = '';
    };
  }, [channel]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}
