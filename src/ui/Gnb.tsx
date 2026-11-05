import type { LayoutKind } from '../domain/types';
import type { RemoteMode } from '../app/remoteMode';
import { LAYOUT_LABEL, LAYOUTS } from '../layout/layouts';
import logoUrl from '../assets/logo.png';


/** 레이아웃 아이콘 모양(미니 그리드) */
const ICON_CELLS: Record<LayoutKind, string[]> = {
  wideSide: ['a', 'b'],
  single: ['a'],
  split2: ['a', 'b'],
  oneTwo: ['a', 'b', 'c'],
  quad: ['a', 'b', 'c', 'd'],
  oneThree: ['a', 'b', 'c', 'd'],
  oneFive: ['a', 'b', 'c', 'd', 'e', 'f'],
  six: ['a', 'b', 'c', 'd', 'e', 'f'],
  nine: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
};

interface Props {
  layout: LayoutKind;
  onLayout(l: LayoutKind): void;
  canDonate: boolean;
  onDonate(): void;
  onSettings?(): void;
  onPresets?(): void; // 화면 구성 저장·불러오기
  account?: { cash: number | null; onHistory(): void } | null; // 투네이션 로그인: 캐시 잔액 · 내 후원 내역
  onMini?(): void; // 미니 모드 (방송이 있을 때만)
  sound?: { on: boolean; onToggle(): void }; // 전체 음소거·해제 (단축키 M과 같은 상태)
  onLive?(): void; // 추천 라이브 (투네이션 라이브 목록)
  onReloadAll?(): void; // 전체 새로고침 (모든 칸)
  mode?: { value: RemoteMode; onChange(m: RemoteMode): void }; // 상단 스위치: 크리에이터 리모컨 ↔ 후원 리모컨
}

export function Gnb({ layout, onLayout, canDonate, onDonate, onSettings, onPresets, account, onMini, sound, onLive, onReloadAll, mode }: Props) {
  const creator = mode?.value === 'creator';
  return (
    <header className="gnb">
      <span className="gnb__logo">
        <img className="gnb__logo-img" src={logoUrl} alt="투네이션 후원 브라우저" />
      </span>
      {mode && (
        <div className="gnb__mode" role="radiogroup" aria-label="리모컨 전환">
          {(
            [
              ['creator', '크리에이터 리모컨'],
              ['donor', '후원 리모컨'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={mode.value === k} className="gnb__mode-btn" onClick={() => mode.onChange(k)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {/* 크리에이터 리모컨일 때는 리모컨이 자기 메뉴를 가진다 */}
      {!creator && (
        <>
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
          {onLive && (
            <button type="button" className="btn btn--ghost gnb__live" aria-label="추천 라이브" title="투네이션에서 지금 방송 중인 라이브" onClick={onLive}>
              <span className="gnb__live-dot" aria-hidden="true" />
              추천 라이브
            </button>
          )}
          {onReloadAll && (
            <button type="button" className="btn btn--ghost" aria-label="전체 새로고침" title="모든 칸의 방송·페이지를 다시 불러오기" onClick={onReloadAll}>
              ⟳ 전체 새로고침
            </button>
          )}
          {sound && (
            <button
              type="button"
              className={`btn btn--ghost gnb__mute${sound.on ? '' : ' gnb__mute--on'}`}
              aria-label={sound.on ? '전체 음소거' : '음소거 해제'}
              aria-pressed={!sound.on}
              title={sound.on ? '모든 칸 소리 끄기 (M)' : '소리 다시 켜기 (M)'}
              onClick={sound.onToggle}
            >
              {sound.on ? '🔊 전체 음소거' : '🔇 음소거 해제'}
            </button>
          )}
          {onMini && (
            <button type="button" className="btn btn--ghost" aria-label="미니 모드" title="선택한 방송 하나만 작게 보기" onClick={onMini}>
              미니
            </button>
          )}
          {onPresets && (
            <button type="button" className="btn btn--ghost" aria-label="화면 구성" title="화면 구성 저장·불러오기" onClick={onPresets}>
              구성
            </button>
          )}
          {onSettings && (
            <button type="button" className="btn btn--icon gnb__settings" aria-label="설정" title="설정" onClick={onSettings}>
              ⚙
            </button>
          )}
          {account && (
            <button
              type="button"
              className="btn btn--ghost gnb__cash"
              aria-label={account.cash === null ? '내 후원 내역' : `내 후원 내역 · 캐시 ${account.cash.toLocaleString('ko-KR')}`}
              title="내 후원 내역"
              onClick={account.onHistory}
            >
              {account.cash === null ? '후원 내역' : `캐시 ${account.cash.toLocaleString('ko-KR')}`}
            </button>
          )}
          <button type="button" className="btn btn--donate" disabled={!canDonate} onClick={onDonate}>
            후원하기
          </button>
        </>
      )}
    </header>
  );
}
