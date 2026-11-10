import { useEffect, useRef } from 'react';
import type { PlayerHandle } from './types';

/**
 * 창마다 정지(숨긴 창 정지 설정)와 낮은 화질(선택하지 않은 창 낮은 화질 설정)을 적용한다.
 * 값이 바뀔 때만 명령하고, 처음 상태(재생 중·자동 화질)와 같으면 건드리지 않는다.
 */
export function usePlaybackPolicy(handles: (PlayerHandle | null)[], paused: boolean[], low: boolean[]): void {
  const applied = useRef(new WeakMap<PlayerHandle, { paused: boolean; low: boolean }>());
  useEffect(() => {
    handles.forEach((h, i) => {
      if (!h) return;
      const prev = applied.current.get(h) ?? { paused: false, low: false };
      const next = { paused: !!paused[i], low: !!low[i] };
      try {
        if (h.setPaused && prev.paused !== next.paused) h.setPaused(next.paused);
        if (h.setLowQuality && prev.low !== next.low) h.setLowQuality(next.low);
      } catch {
        // 아직 준비되지 않은 플레이어
      }
      applied.current.set(h, next);
    });
  });
}
