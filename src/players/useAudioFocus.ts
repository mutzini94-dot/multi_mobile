import { useEffect } from 'react';
import type { PlayerHandle } from './types';

/**
 * 선택된 칸 하나만 소리를 낸다. 주기 검사는 다른 칸을 다시 음소거만 하고,
 * 사용자가 선택된 칸을 플레이어 버튼으로 끈 것은 존중한다.
 */
export function useAudioFocus(handles: (PlayerHandle | null)[], selected: number | null, soundOn: boolean, intervalMs = 1000): void {
  useEffect(() => {
    const enforce = (initial: boolean) => {
      handles.forEach((h, i) => {
        if (!h) return;
        const shouldMute = !(soundOn && i === selected);
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
  }, [handles, selected, soundOn, intervalMs]);
}
