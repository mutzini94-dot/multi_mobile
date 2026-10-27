import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import type { Creator, ViewState } from '../domain/types';
import { visibleCount } from '../layout/layouts';
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
  onSelectSlot?(slot: number): void; // 영상(iframe)을 클릭했을 때
  focused?: number | null; // 전체 화면으로 보는 칸
  focusEl?: RefObject<HTMLElement>; // 전체 화면 칸의 자리
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
export function PlayerLayer({ state, stageRef, slotEls, onReady, dragging = false, onSelectSlot, focused = null, focusEl }: Props) {
  const [rects, setRects] = useState<Record<number, Rect>>({});
  const onSelectRef = useRef(onSelectSlot);
  onSelectRef.current = onSelectSlot;

  // 영상 클릭 감지: iframe은 클릭 이벤트를 넘겨주지 않지만, 클릭하면 포커스가 iframe으로 옮겨가며 window가 blur된다.
  // 포커스를 가진 iframe의 칸을 선택하고, 포커스를 페이지로 되돌려 다음 클릭도 감지한다.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onBlur = () => {
      timer = setTimeout(() => {
        const el = document.activeElement;
        if (!el || el.tagName !== 'IFRAME') return;
        const item = el.closest<HTMLElement>('.player-layer__item[data-slot]');
        if (!item) return;
        onSelectRef.current?.(Number(item.dataset.slot));
        (el as HTMLElement).blur();
      }, 0);
    };
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('blur', onBlur);
      clearTimeout(timer);
    };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const s = stage.getBoundingClientRect();
      const next: Record<number, Rect> = {};
      slotEls.current.forEach((el, i) => {
        // 전체 화면 칸은 전체 화면 자리에 놓는다
        const target = focused === i && focusEl?.current ? focusEl.current : el;
        if (!target || !target.isConnected) return;
        const r = target.getBoundingClientRect();
        next[i] = { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
      });
      setRects((prev) => (sameRects(prev, next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    slotEls.current.forEach((el) => el && ro.observe(el));
    if (focusEl?.current) ro.observe(focusEl.current);
    return () => ro.disconnect();
  }, [state.layout, state.slots, state.sizes, stageRef, slotEls, focused, focusEl]);

  return (
    <div className={`player-layer${dragging ? ' player-layer--dragging' : ''}`}>
      {state.slots.map((creator, slot) => {
        if (!creator) return null;
        // 레이아웃에서 빠진 칸: 지우지 않고 숨겨 둔다 (다시 칸을 늘리면 다시 불러오지 않고 보인다)
        const offscreen = slot >= visibleCount(state);
        const r = (!offscreen && rects[slot]) || { left: 0, top: 0, width: 0, height: 0 };
        return (
          <div
            key={`${slot}:${creator.key}`}
            className={`player-layer__item${state.selected === slot ? ' player-layer__item--selected' : ''}`}
            data-slot={slot}
            // 전체 화면 중 다른 칸은 숨기기만 하고 재생은 계속한다
            style={{ left: r.left, top: r.top, width: r.width, height: r.height, visibility: offscreen || (focused !== null && focused !== slot) ? 'hidden' : undefined }}
          >
            <StreamPlayer creator={creator} onReady={(h) => onReady(slot, creator, h)} />
            {/* 선택 강조: iframe 위에 겹쳐 그려야 영상에 가려지지 않는다 (클릭은 통과) */}
            {state.selected === slot && <span className="player-layer__highlight" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
