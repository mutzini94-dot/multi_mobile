import type { LayoutKind } from '../domain/types';
import { LAYOUT_LABEL } from '../layout/layouts';
import { SLOT_MAP } from '../layout/slotMap';

interface Props {
  layouts: LayoutKind[]; // 칸이 하나(또는 가장 적게) 늘어나는 레이아웃들
  onPick(layout: LayoutKind, at: number): void;
  onClose(): void;
}

/** 창 추가: 늘어난 레이아웃 모양에서 새 빈 칸을 놓을 자리를 고른다 (지금 칸들은 순서대로 나머지 자리에) */
export function AddWindowDialog({ layouts, onPick, onClose }: Props) {
  return (
    <div className="modal-backdrop modal-backdrop--top" onClick={onClose}>
      <div className="modal slot-picker add-window" role="dialog" aria-label="창 추가" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>창 추가</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            취소
          </button>
        </div>
        <p>새 창을 놓을 자리를 누르세요. 지금 띄운 창들은 순서대로 나머지 자리로 옮겨집니다.</p>
        <div className="add-window__list">
          {layouts.map((l) => {
            const map = SLOT_MAP[l];
            return (
              <section key={l} className="add-window__layout">
                <h3>{LAYOUT_LABEL[l]}</h3>
                <div className="slot-picker__grid" style={{ gridTemplateColumns: map.cols.join(' '), gridTemplateRows: map.rows.join(' ') }}>
                  {map.areas.map(([row, col, rowSpan, colSpan], i) => (
                    <button
                      key={i}
                      type="button"
                      className="slot-picker__slot slot-picker__slot--empty add-window__slot"
                      aria-label={`${LAYOUT_LABEL[l]} · ${i + 1}번 자리에 추가`}
                      style={{ gridArea: `${row} / ${col} / span ${rowSpan} / span ${colSpan}` }}
                      onClick={() => onPick(l, i)}
                    >
                      <span className="slot-picker__num">{i + 1}</span>
                      <span className="add-window__plus" aria-hidden="true">
                        +
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
