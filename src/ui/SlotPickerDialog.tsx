import type { LayoutKind, SlotItem } from '../domain/types';
import { SLOT_MAP } from '../layout/slotMap';

interface Props {
  layout: LayoutKind;
  slots: (SlotItem | null)[]; // 지금 보이는 창들
  name: string; // 넣을 방송 이름
  onPick(slot: number): void;
  onClose(): void;
}

/** 방송을 넣을 창 고르기: 지금 레이아웃 모양 그대로 창마다 번호와 현재 내용을 보여 준다 */
export function SlotPickerDialog({ layout, slots, name, onPick, onClose }: Props) {
  const map = SLOT_MAP[layout];
  return (
    <div className="modal-backdrop modal-backdrop--top" onClick={onClose}>
      <div className="modal slot-picker" role="dialog" aria-label="넣을 창 고르기" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>넣을 창 고르기</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            취소
          </button>
        </div>
        <p>
          <strong>{name}</strong> 방송을 넣을 창을 누르세요.
        </p>
        <div className="slot-picker__grid" style={{ gridTemplateColumns: map.cols.join(' '), gridTemplateRows: map.rows.join(' ') }}>
          {map.areas.map(([row, col, rowSpan, colSpan], i) => {
            const item = slots[i] ?? null;
            const current = item ? item.name : '빈 창';
            return (
              <button
                key={i}
                type="button"
                className={`slot-picker__slot${item ? '' : ' slot-picker__slot--empty'}`}
                aria-label={`${i + 1}번 창 · ${current}`}
                style={{ gridArea: `${row} / ${col} / span ${rowSpan} / span ${colSpan}` }}
                onClick={() => onPick(i)}
              >
                <span className="slot-picker__num">{i + 1}</span>
                <span className="slot-picker__name">{current}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
