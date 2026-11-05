import { useEffect, useRef } from 'react';
import { loadScript } from './loadScript';
import type { PlayerHandle, StreamStatus } from './types';

/** 방송 중인데 이 시간 안에 재생이 시작되지 않으면 자동 재생이 막힌 것으로 보고 기다리기를 그만둔다 (재생 버튼은 사용자가) */
export const TWITCH_START_TIMEOUT_MS = 5000;

/** 영상 위를 다른 것(대화상자·펼친 창 등)이 덮고 있는지: 트위치는 가려진 채 시작하면 자동 재생을 막는다 */
function covered(el: HTMLElement): boolean {
  if (document.querySelector('.modal-backdrop')) return true;
  if (typeof document.elementFromPoint !== 'function') return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!top && !el.contains(top);
}

/**
 * 트위치 임베드. 트위치는 영상 위에 다른 요소가 겹쳐 있으면 자동 재생을 막는다 (한 번 막히면 다시 띄워도 막힌다).
 * 그래서 대화상자 등에 가려져 있으면 걷힐 때까지 기다렸다가 띄우고,
 * 시작하는 동안 onStarting(true)로 알려 앱이 영상 위 바·잡는 층을 숨긴다. 재생이 시작되면 false.
 */
export function TwitchPlayer({ channel, onReady, onStatus, onStarting }: { channel: string; onReady: (h: PlayerHandle) => void; onStatus?: (s: StreamStatus) => void; onStarting?: (waiting: boolean) => void }) {
  const onStartingRef = useRef(onStarting);
  onStartingRef.current = onStarting;
  const ref = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const starting = (w: boolean) => alive && onStartingRef.current?.(w);
    starting(true);
    // 방송 중인데 재생이 시작되지 않으면 기다리기를 그만둔다 (영상 위 바를 다시 보인다)
    const watch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => !started && starting(false), TWITCH_START_TIMEOUT_MS);
    };
    // 가려져 있으면 걷힐 때까지 기다린다
    const whenUncovered = (fn: () => void) => {
      if (!alive || !el) return;
      if (covered(el)) timer = setTimeout(() => whenUncovered(fn), 500);
      else fn();
    };
    loadScript('https://player.twitch.tv/js/embed/v1.js')
      .then(() => new Promise<void>((resolve) => whenUncovered(resolve)))
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
        // (이벤트마다 리스너 하나: 켜짐 = 방송 상태 + 재생 시작 지켜보기, 꺼짐 = 방송 상태 + 시작 대기 끝)
        if (Player.ONLINE)
          player.addEventListener(Player.ONLINE, () => {
            status('live')();
            if (!started) watch();
          });
        if (Player.OFFLINE)
          player.addEventListener(Player.OFFLINE, () => {
            status('ended')();
            clearTimeout(timer);
            starting(false);
          });
        if (Player.PLAYING)
          player.addEventListener(Player.PLAYING, () => {
            if (started) return;
            started = true;
            clearTimeout(timer);
            starting(false);
          });
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
      clearTimeout(timer);
      if (!started) onStartingRef.current?.(false);
      alive = false;
      if (el) el.innerHTML = '';
    };
  }, [channel]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}
