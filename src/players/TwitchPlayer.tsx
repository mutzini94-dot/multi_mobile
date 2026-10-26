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
