import type { LayoutKind } from '../domain/types';
import { LAYOUT_LABEL } from '../layout/layouts';

const LAYOUTS: LayoutKind[] = ['single', 'split2', 'oneTwo', 'quad'];

/** 레이아웃 아이콘 모양(미니 그리드) */
const ICON_CELLS: Record<LayoutKind, string[]> = {
  single: ['a'],
  split2: ['a', 'b'],
  oneTwo: ['a', 'b', 'c'],
  quad: ['a', 'b', 'c', 'd'],
};

interface Props {
  layout: LayoutKind;
  onLayout(l: LayoutKind): void;
  canDonate: boolean;
  onDonate(): void;
  onShare(): void;
  sharedMode: boolean;
  onRestore(): void;
}

export function Gnb({ layout, onLayout, canDonate, onDonate, onShare, sharedMode, onRestore }: Props) {
  return (
    <header className="gnb">
      <span className="gnb__logo">멀티뷰 후원</span>
      {sharedMode && (
        <button type="button" className="btn btn--ghost" onClick={onRestore}>
          원래 구성으로
        </button>
      )}
      <div className="gnb__layouts">
        {LAYOUTS.map((l) => (
          <button
            key={l}
            type="button"
            aria-label={LAYOUT_LABEL[l]}
            title={LAYOUT_LABEL[l]}
            aria-pressed={layout === l}
            className={`layout-icon layout-icon--${l}`}
            onClick={() => onLayout(l)}
          >
            {ICON_CELLS[l].map((c) => (
              <i key={c} />
            ))}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--ghost" onClick={onShare}>
        합방 링크 만들기
      </button>
      <button type="button" className="btn btn--donate" disabled={!canDonate} onClick={onDonate}>
        후원하기
      </button>
    </header>
  );
}
