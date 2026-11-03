import { useEffect, useRef } from 'react';
import { loadScript } from './loadScript';
import type { PlayerHandle, StreamStatus } from './types';

export function TwitchPlayer({ channel, onReady, onStatus }: { channel: string; onReady: (h: PlayerHandle) => void; onStatus?: (s: StreamStatus) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

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
        // 방송 종료 감지: 채널이 오프라인이 되거나 방송이 끝나면 ended, 다시 켜지면 live
        const status = (s: StreamStatus) => () => alive && onStatusRef.current?.(s);
        if (Player.ONLINE) player.addEventListener(Player.ONLINE, status('live'));
        if (Player.OFFLINE) player.addEventListener(Player.OFFLINE, status('ended'));
        if (Player.ENDED) player.addEventListener(Player.ENDED, status('ended'));
        player.addEventListener(Player.READY, () => {
          if (!alive) return;
          onReadyRef.current({
            setMuted: (m) => player.setMuted(m),
            isMuted: () => player.getMuted(),
            setVolume: (v) => player.setVolume(v / 100),
            setPaused: (p) => (p ? player.pause() : player.play()),
            isPaused: () => !!player.isPaused?.(),
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
