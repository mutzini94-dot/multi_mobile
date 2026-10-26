import { useLayoutEffect, useState, type MutableRefObject, type RefObject } from 'react';
import type { Creator, ViewState } from '../domain/types';
import { StreamPlayer } from '../players/StreamPlayer';
import type { PlayerHandle } from '../players/types';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  state: ViewState;
  stageRef: RefObject<HTMLElement>;
  slotEls: MutableRefObject<(HTMLElement | null)[]>; // 칸마다 플레이어가 놓일 자리(Tile의 .tile__player)
  onReady(slot: number, creator: Creator, h: PlayerHandle): void;
  dragging?: boolean; // 칸 경계를 드래그하는 동안: iframe이 포인터를 삼키지 않게 한다
}

const sameRects = (a: Record<number, Rect>, b: Record<number, Rect>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => {
    const x = a[+k];
    const y = b[+k];
    return y && x.left === y.left && x.top === y.top && x.width === y.width && x.height === y.height;
  });
};

/**
 * 플레이어를 칸 번호 key로 한 번만 마운트하고, 레이아웃이 정한 칸 자리에 절대 위치로 덮는다.
 * 레이아웃을 바꿔도 iframe이 DOM에서 옮겨지지 않으므로 방송이 다시 로딩되지 않는다.
 */
export function PlayerLayer({ state, stageRef, slotEls, onReady, dragging = false }: Props) {
  const [rects, setRects] = useState<Record<number, Rect>>({});

  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const s = stage.getBoundingClientRect();
      const next: Record<number, Rect> = {};
      slotEls.current.forEach((el, i) => {
        if (!el || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        next[i] = { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
      });
      setRects((prev) => (sameRects(prev, next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    slotEls.current.forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [state.layout, state.slots, state.sizes, stageRef, slotEls]);

  return (
    <div className={`player-layer${dragging ? ' player-layer--dragging' : ''}`}>
      {state.slots.map((creator, slot) => {
        if (!creator) return null;
        const r = rects[slot] ?? { left: 0, top: 0, width: 0, height: 0 };
        return (
          <div key={`${slot}:${creator.key}`} className="player-layer__item" style={{ left: r.left, top: r.top, width: r.width, height: r.height }}>
            <StreamPlayer creator={creator} onReady={(h) => onReady(slot, creator, h)} />
          </div>
        );
      })}
    </div>
  );
}
