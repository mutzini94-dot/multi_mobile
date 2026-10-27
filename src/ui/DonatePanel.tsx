import { useLayoutEffect, useRef } from 'react';
import type { Creator } from '../domain/types';
import type { DonateBounds } from '../desktop/desktopApi';

interface Props {
  creator: Creator;
  onClose(): void;
  onBounds(rect: DonateBounds): void; // 설치형 앱이 후원 페이지(WebContentsView)를 이 자리에 놓는다
}

/** 설치형 앱 전용: 창 오른쪽 후원 패널의 머리글과 자리. 후원 페이지 자체는 앱이 덮어 그린다. */
export function DonatePanel({ creator, onClose, onBounds }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const onBoundsRef = useRef(onBounds);
  onBoundsRef.current = onBounds;

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      onBoundsRef.current({ x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
    };
    report();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener('resize', report);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', report);
    };
  }, []);

  return (
    <aside className="donate-panel" aria-label="후원 패널">
      <div className="donate-panel__head">
        <span className="donate-panel__title">{creator.name}에게 후원</span>
        <button type="button" className="btn btn--ghost" aria-label="후원 패널 닫기" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="donate-panel__body" ref={bodyRef} />
    </aside>
  );
}
