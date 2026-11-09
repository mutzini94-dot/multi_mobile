import { useEffect, useRef, useState, type PointerEvent } from 'react';

export interface TileDragState {
  from: number;
  over: number | null; // 커서 아래의 놓을 수 있는 칸 (.tile[data-drop])
  x: number;
  y: number;
  shift: boolean; // Shift를 누르고 있다 (놓으면 자리 바꾸기 대신 고정)
  outside: boolean; // 커서가 창 밖에 있다 (놓으면 onOutside = 새 창으로 분리)
}

interface Press extends TileDragState {
  x0: number;
  y0: number;
  started: boolean; // 기준 거리 이상 움직여 끌기가 시작됨
  canDrag: boolean; // false면 눌러도 선택만
}

/** 이만큼 움직여야 끌기로 본다 (그보다 작으면 짧게 누른 것 = 칸 선택) */
export const DRAG_THRESHOLD = 6;

/** 창 밖인지 (끄는 동안에는 창 밖 좌표도 계속 들어온다) */
const isOutside = (x: number, y: number) => x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight;

/** 이 좌표 아래의 칸 번호 (분리 창을 메인 창에 끌어 놓을 때) */
export function slotAtPoint(x: number, y: number): number | null {
  for (const el of document.elementsFromPoint?.(x, y) ?? []) {
    const tile = el.closest<HTMLElement>('.tile[data-slot]');
    if (tile) return Number(tile.dataset.slot);
  }
  return null;
}

/**
 * 커서 아래 칸 중 놓을 수 있는 칸 번호 (끄는 동안 플레이어 레이어는 포인터를 받지 않는다).
 * 놓을 수 있는지는 화면 표시(data-drop)가 아니라 규칙(canDropOn)으로 바로 판단한다 — 끌기가 시작되는 첫 움직임에도 맞게.
 */
function dropSlotAt(x: number, y: number, from: number, canDropOn: (from: number, to: number) => boolean): number | null {
  for (const el of document.elementsFromPoint?.(x, y) ?? []) {
    const tile = el.closest<HTMLElement>('.tile[data-slot]');
    if (!tile) continue;
    const to = Number(tile.dataset.slot);
    return to !== from && canDropOn(from, to) ? to : null;
  }
  return null;
}

/**
 * 칸 끌어서 자리 옮기기. 칸 위쪽 바·⠿·영상 위 잡는 층 어디서든 누를 수 있다.
 * 기준 거리 이상 움직이면 끌기(놓으면 onDrop), 그대로 떼면 짧게 누른 것(onTap = 그 칸 선택). Esc는 취소.
 * HTML5 drag & drop 대신 포인터 이벤트로 직접 처리한다 (버튼에서의 기본 드래그는 동작이 브라우저마다 다르다).
 */
export function useTileDrag(
  onDrop: (from: number, to: number, mods: { shift: boolean }) => void,
  onTap: (slot: number) => void,
  canDropOn: (from: number, to: number) => boolean,
  onCancel?: (from: number) => void,
  onOutside?: (from: number, x: number, y: number) => void, // 창 밖에 놓음
) {
  const [press, setPress] = useState<Press | null>(null);
  const pressRef = useRef<Press | null>(null);
  pressRef.current = press;
  const cb = useRef({ onDrop, onTap, canDropOn, onCancel, onOutside });
  cb.current = { onDrop, onTap, canDropOn, onCancel, onOutside };

  const pressing = press !== null;
  useEffect(() => {
    if (!pressing) return;
    const move = (e: globalThis.PointerEvent) =>
      setPress((p) => {
        if (!p) return p;
        const started = p.started || (p.canDrag && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) >= DRAG_THRESHOLD);
        if (!started) return p;
        return { ...p, started, x: e.clientX, y: e.clientY, shift: e.shiftKey, outside: isOutside(e.clientX, e.clientY), over: dropSlotAt(e.clientX, e.clientY, p.from, cb.current.canDropOn) };
      });
    const up = (e: globalThis.PointerEvent) => {
      const p = pressRef.current;
      if (p?.started) {
        // 놓은 순간의 커서 위치로 다시 확인 (마지막 움직임 뒤 바로 놓은 경우)
        const out = isOutside(e.clientX, e.clientY); // 창 밖에서 놓으면 마지막으로 지나간 칸이 아니라 창 밖
        const to = out ? null : dropSlotAt(e.clientX, e.clientY, p.from, cb.current.canDropOn) ?? p.over;
        if (to !== null && to !== p.from) cb.current.onDrop(p.from, to, { shift: e.shiftKey });
        else if (cb.current.onOutside && out) cb.current.onOutside(p.from, e.clientX, e.clientY);
        else cb.current.onCancel?.(p.from); // 놓을 곳이 아니면 제자리로
      } else if (p) cb.current.onTap(p.from);
      setPress(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const p = pressRef.current;
      if (p?.started) cb.current.onCancel?.(p.from);
      setPress(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
    };
  }, [pressing]);

  const start = (from: number, e: PointerEvent, { canDrag = true }: { canDrag?: boolean } = {}) => {
    if (e.button > 0) return; // 왼쪽 버튼·터치만 (button이 없는 환경도 허용)
    e.preventDefault(); // 끌다가 글자가 선택되지 않게
    e.stopPropagation();
    setPress({ from, over: null, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, started: false, canDrag, shift: e.shiftKey, outside: false });
  };

  // 화면에는 실제로 끌기가 시작된 뒤에만 '끄는 중'으로 보인다
  const drag: TileDragState | null = press?.started ? { from: press.from, over: press.over, x: press.x, y: press.y, shift: press.shift, outside: press.outside } : null;
  return { drag, start };
}
