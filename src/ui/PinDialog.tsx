import type { Creator } from '../domain/types';

interface Props {
  streams: { slot: number; creator: Creator }[]; // 지금 보이는 방송 창
  current: string | null; // 지금 고정한 방송 (creator.key)
  onPick(c: Creator | null): void; // null = 선택한 방송 따라가기
  onClose(): void;
}

/** 📌 후원 페이지·채팅·시그니처 창을 고정할 방송 고르기 */
export function PinDialog({ streams, current, onPick, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--small pin-dialog" role="dialog" aria-label="고정할 방송 고르기" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>고정할 방송 고르기</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        <p>고정하면 다른 방송 창을 선택해도 이 창은 고른 방송을 계속 보여 줍니다. 방송 창의 ⠿를 끌어다 이 창에 놓아도 고정됩니다.</p>
        <ul className="pin-dialog__list">
          {streams.length === 0 && <li className="muted">화면에 방송 창이 없습니다</li>}
          {streams.map(({ slot, creator }) => (
            <li key={creator.key}>
              <button type="button" className={`pin-dialog__item${current === creator.key ? ' pin-dialog__item--on' : ''}`} aria-label={`${slot + 1}번 창 · ${creator.name}`} onClick={() => onPick(creator)}>
                <span className="pin-dialog__num">{slot + 1}</span>
                <span>{creator.name}</span>
                {current === creator.key && <span className="pin-dialog__mark">📌 고정됨</span>}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={`btn btn--ghost pin-dialog__follow${current ? '' : ' pin-dialog__follow--on'}`} onClick={() => onPick(null)}>
          선택한 방송 따라가기
        </button>
      </div>
    </div>
  );
}
