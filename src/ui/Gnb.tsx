import type { Creator, LayoutKind } from '../domain/types';
import { LAYOUT_LABEL } from '../layout/layouts';

const LAYOUTS: LayoutKind[] = ['single', 'split2', 'oneTwo', 'quad'];

/** 레이아웃 아이콘 모양(미니 그리드) */
const ICON_CELLS: Record<LayoutKind, string[]> = {
  single: ['a'],
  split2: ['a', 'b'],
  oneTwo: ['a', 'b', 'c'],
  quad: ['a', 'b', 'c', 'd'],
};

/** 합동 방송 상태에 따라 바뀌는 상단 영역 */
export type GnbJoint =
  | { kind: 'normal'; onOpen(): void }
  | { kind: 'hosting'; started: boolean; onEditHost(): void; onStart(): void; onShowUrl(): void; onEnd(): void }
  | { kind: 'viewer'; host: Creator; onRestore(): void };

interface Props {
  layout: LayoutKind;
  onLayout(l: LayoutKind): void;
  canDonate: boolean;
  onDonate(): void;
  joint: GnbJoint;
}

export function Gnb({ layout, onLayout, canDonate, onDonate, joint }: Props) {
  return (
    <header className="gnb">
      {joint.kind === 'viewer' ? (
        <>
          <span className="gnb__logo">{joint.host.name}의 합방</span>
          {/* 합방 URL은 누구나 만들 수 있으므로 후원이 어디로 가는지 항상 보여준다 */}
          <span className="gnb__target" aria-label="후원 대상">
            <span className="gnb__target-label">후원 대상</span>
            <b>{joint.host.name}</b>
            <span className="muted">toon.at/donate/{joint.host.donateId}</span>
          </span>
          <button type="button" className="btn btn--ghost" onClick={joint.onRestore}>
            원래 구성으로
          </button>
        </>
      ) : (
        <span className="gnb__logo">
          멀티뷰 후원
          {joint.kind === 'hosting' && (
            <span className={`gnb__status${joint.started ? ' gnb__status--live' : ''}`}>{joint.started ? '합방 방송 중' : '합방 준비 중'}</span>
          )}
        </span>
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
      {joint.kind === 'normal' && (
        <button type="button" className="btn btn--ghost" onClick={joint.onOpen}>
          합방 방송 개설
        </button>
      )}
      {joint.kind === 'hosting' && (
        <>
          <button type="button" className="btn btn--ghost" onClick={joint.onEditHost}>
            내 방송 정보
          </button>
          <button type="button" className="btn btn--ghost" onClick={joint.onEnd}>
            합방 종료
          </button>
          {joint.started ? (
            <button type="button" className="btn btn--ghost" onClick={joint.onShowUrl}>
              방송 URL
            </button>
          ) : (
            <button type="button" className="btn btn--live" onClick={joint.onStart}>
              방송 시작하기
            </button>
          )}
        </>
      )}
      <button type="button" className="btn btn--donate" disabled={!canDonate} onClick={onDonate}>
        후원하기
      </button>
    </header>
  );
}
