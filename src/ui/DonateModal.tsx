import { useLayoutEffect, useRef } from 'react';
import type { Creator } from '../domain/types';
import type { DonateBounds } from '../desktop/desktopApi';

interface Props {
  creator: Creator;
  onClose(): void;
  onPip(): void;
  onBounds(rect: DonateBounds): void; // 설치형 앱이 후원 페이지(WebContentsView)를 본문 자리에 놓는다
}

/** 설치형 전용: 앱 가운데 모달 후원창의 틀. 후원 페이지 자체는 앱이 본문 자리에 덮어 그린다. */
export function DonateModal({ creator, onClose, onPip, onBounds }: Props) {
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
    <div className="modal-backdrop donate-modal-backdrop" onClick={onClose}>
      <div className="donate-modal" role="dialog" aria-label="후원창" onClick={(e) => e.stopPropagation()}>
        <div className="donate-modal__head">
          <span className="donate-modal__title">{creator.name}에게 후원</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onPip} title="항상 위에 떠 있는 작은 창으로 보기">
            PIP 모드
          </button>
          <button type="button" className="btn btn--icon" aria-label="후원창 닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="donate-modal__body" ref={bodyRef} />
      </div>
    </div>
  );
}
