import { useEffect, useRef, useState, type PointerEvent } from 'react';

export interface TileDragState {
  from: number;
  over: number | null; // 커서 아래의 놓을 수 있는 칸 (.tile[data-drop])
  x: number;
  y: number;
}

/** 커서 아래에서 놓을 수 있는 칸 번호를 찾는다 (끄는 동안 플레이어 레이어는 포인터를 받지 않는다) */
function dropSlotAt(x: number, y: number): number | null {
  for (const el of document.elementsFromPoint?.(x, y) ?? []) {
    const tile = el.closest<HTMLElement>('.tile[data-drop]');
    if (tile && tile.dataset.slot !== undefined) return Number(tile.dataset.slot);
  }
  return null;
}

/**
 * 칸 끌어서 자리 옮기기. HTML5 drag & drop 대신 포인터 이벤트로 직접 처리한다
 * (버튼에서의 기본 드래그는 브라우저마다 다르고, 끌다가 글자가 선택되는 문제가 있다).
 * 놓으면 onDrop(from, to), Esc는 취소.
 */
export function useTileDrag(onDrop: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<TileDragState | null>(null);
  const dragRef = useRef<TileDragState | null>(null);
  dragRef.current = drag;
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const active = drag !== null;
  useEffect(() => {
    if (!active) return;
    const move = (e: globalThis.PointerEvent) =>
      setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY, over: dropSlotAt(e.clientX, e.clientY) });
    const up = () => {
      const d = dragRef.current;
      if (d && d.over !== null && d.over !== d.from) onDropRef.current(d.from, d.over);
      setDrag(null);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setDrag(null);
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
  }, [active]);

  const start = (from: number, e: PointerEvent) => {
    if (e.button > 0) return; // 왼쪽 버튼·터치만 (button이 없는 환경도 허용)
    e.preventDefault(); // 끌다가 글자가 선택되지 않게
    e.stopPropagation();
    setDrag({ from, over: null, x: e.clientX, y: e.clientY });
  };

  return { drag, start };
}
