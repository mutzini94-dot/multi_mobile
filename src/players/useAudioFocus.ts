import { useEffect, useRef } from 'react';
import type { PlayerHandle } from './types';

/**
 * 칸마다 들릴지(audible)와 볼륨을 적용한다. 주기 검사는 들리면 안 되는 칸을 다시 음소거만 하고,
 * 사용자가 들리는 칸을 플레이어 버튼으로 끈 것은 존중한다.
 */
export function useAudioMix(handles: (PlayerHandle | null)[], audible: boolean[], volumes: number[], intervalMs = 1000): void {
  const audibleKey = audible.join(',');
  useEffect(() => {
    const enforce = (initial: boolean) => {
      handles.forEach((h, i) => {
        if (!h) return;
        const shouldMute = !audible[i];
        try {
          if (h.isMuted() !== shouldMute && (initial || shouldMute)) h.setMuted(shouldMute);
        } catch {
          // 아직 준비되지 않은 플레이어
        }
      });
    };
    enforce(true);
    const id = setInterval(() => enforce(false), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handles, audibleKey, intervalMs]);

  // 볼륨은 바뀔 때만 적용
  const applied = useRef(new WeakMap<PlayerHandle, number>());
  useEffect(() => {
    handles.forEach((h, i) => {
      const v = volumes[i];
      if (!h?.setVolume || v === undefined || applied.current.get(h) === v) return;
      try {
        h.setVolume(v);
        applied.current.set(h, v);
      } catch {
        // 아직 준비되지 않은 플레이어
      }
    });
  });
}

/** 선택된 칸 하나만 소리 (기본 방식) */
export function useAudioFocus(handles: (PlayerHandle | null)[], selected: number | null, soundOn: boolean, intervalMs = 1000): void {
  useAudioMix(
    handles,
    handles.map((_, i) => soundOn && i === selected),
    [],
    intervalMs,
  );
}
