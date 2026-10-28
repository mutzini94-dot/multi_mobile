import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import type { PageSlot, SlotItem, ViewState } from '../domain/types';
import { isPage, isStream } from '../domain/pages';
import { playerKeys, visibleCount } from '../layout/layouts';
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
  onReady(playerKey: string, h: PlayerHandle): void; // playerKey: layouts.playerKeys
  dragging?: boolean; // 칸 경계를 드래그하는 동안: iframe이 포인터를 삼키지 않게 한다
  onSelectSlot?(slot: number): void; // 영상(iframe)을 클릭했을 때
  focused?: number | null; // 전체 화면으로 보는 칸
  focusEl?: RefObject<HTMLElement>; // 전체 화면 칸의 자리
  // 영상 위의 잡는 층: 플레이어(iframe)가 마우스를 가져가므로 그 위에 투명한 층을 깔아 끌기·선택을 받는다.
  // 아래쪽 플레이어 조작 영역은 비워 둔다.
  onGrab?(slot: number, e: ReactPointerEvent): void;
  // 끄는 중인 방송: 작은 창으로 줄어 커서(x, y: 화면 좌표)를 따라간다 — 위치·크기만 바꿔 iframe은 그대로
  floating?: { slot: number; x: number; y: number; name: string } | null;
  settling?: number[]; // 놓은 직후 제자리로 부드럽게 들어가는 칸들
  renderPage?(page: PageSlot, playerKey: string): ReactNode; // 후원 페이지·웹페이지 칸 (App의 PageView)
}

/** 끄는 동안 작은 창의 폭 (높이는 원래 칸 비율, 모르면 16:9) */
export const FLOAT_WIDTH = 260;

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
export function PlayerLayer({ state, stageRef, slotEls, onReady, dragging = false, onSelectSlot, focused = null, focusEl, onGrab, floating = null, settling = [], renderPage }: Props) {
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
        if (!item || item.dataset.kind === 'page') return; // 웹페이지는 입력 중일 수 있어 포커스를 빼앗지 않는다
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
      {/* 키 순서로 고정해 그린다: 칸 자리를 바꿔도 iframe이 문서 안에서 옮겨지지 않아 다시 로딩되지 않는다 */}
      {playerKeys(state.slots)
        .map((key, slot) => ({ key, slot, creator: state.slots[slot] }))
        .filter((p): p is { key: string; slot: number; creator: SlotItem } => !!p.key && (isStream(p.creator) || isPage(p.creator))) // 분리 표시는 그리지 않는다
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map(({ key, slot, creator }) => {
        // 레이아웃에서 빠진 칸: 지우지 않고 숨겨 둔다 (다시 칸을 늘리면 다시 불러오지 않고 보인다)
        const offscreen = slot >= visibleCount(state);
        let r = (!offscreen && rects[slot]) || { left: 0, top: 0, width: 0, height: 0 };
        const isFloating = floating?.slot === slot;
        if (isFloating && floating) {
          const stage = stageRef.current?.getBoundingClientRect();
          const width = FLOAT_WIDTH;
          const height = width * (r.width > 0 && r.height > 0 ? r.height / r.width : 9 / 16);
          r = { left: floating.x - (stage?.left ?? 0) - width / 2, top: floating.y - (stage?.top ?? 0) - height / 2, width, height };
        }
        return (
          <div
            key={key}
            className={`player-layer__item${state.selected === slot ? ' player-layer__item--selected' : ''}${isFloating ? ' player-layer__item--floating' : ''}${settling.includes(slot) ? ' player-layer__item--settling' : ''}`}
            data-slot={slot}
            data-kind={isStream(creator) ? 'stream' : 'page'}
            // 전체 화면 중 다른 칸은 숨기기만 하고 재생은 계속한다
            style={{ left: r.left, top: r.top, width: r.width, height: r.height, visibility: offscreen || (focused !== null && focused !== slot) ? 'hidden' : undefined }}
          >
            {isStream(creator) ? <StreamPlayer creator={creator} onReady={(h) => onReady(key, h)} /> : isPage(creator) ? renderPage?.(creator, key) : null}
            {/* 페이지 칸은 클릭·입력을 페이지가 받아야 하므로 잡는 층이 없다 (위쪽 바로 끈다) */}
            {onGrab && isStream(creator) && focused === null && !offscreen && <div className="player-layer__grab" onPointerDown={(e) => onGrab(slot, e)} />}
            {isFloating && floating && <span className="player-layer__drag-label">{floating.name}</span>}
            {/* 선택 강조: iframe 위에 겹쳐 그려야 영상에 가려지지 않는다 (클릭은 통과) */}
            {state.selected === slot && <span className="player-layer__highlight" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
