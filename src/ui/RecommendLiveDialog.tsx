import type { ReactNode } from 'react';

/** 상단 '추천 라이브' 창: 투네이션 라이브 목록(toon.at/donator?live)을 크게 보여 준다 */
export function RecommendLiveDialog({ children, onClose, dragging = false }: { children: ReactNode; onClose(): void; dragging?: boolean }) {
  return (
    // 카드를 칸으로 끄는 동안은 창이 비켜 준다 (뒤의 칸에 놓을 수 있게)
    <div className={`modal-backdrop${dragging ? ' modal-backdrop--dragging' : ''}`} onClick={onClose}>
      <div className="modal recommend-live" role="dialog" aria-label="추천 라이브" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>추천 라이브</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
