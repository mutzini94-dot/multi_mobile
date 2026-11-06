import type { LayoutKind } from '../domain/types';
import type { RemoteMode } from '../app/remoteMode';
import { LAYOUT_LABEL, LAYOUTS } from '../layout/layouts';
import logoUrl from '../assets/logo.png';
import { IconCoin, IconHeart, IconHelp, IconUser, IconLive, IconMini, IconMute, IconPresets, IconReload, IconSettings, IconVolume } from './icons';


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
  onHelp?(): void; // 도움말 (자주 묻는 질문·단축키·둘러보기)
  onLogin?(): void; // 투네이션 로그인 (로그인 전에만)
  loggingIn?: boolean; // 로그인 창이 열려 있는 동안
  onPresets?(): void; // 화면 구성 저장·불러오기
  account?: { cash: number | null; onHistory(): void } | null; // 투네이션 로그인: 캐시 잔액 · 내 후원 내역
  onMini?(): void; // 미니 모드 (방송이 있을 때만)
  sound?: { on: boolean; onToggle(): void }; // 전체 음소거·해제 (단축키 M과 같은 상태)
  onLive?(): void; // 추천 라이브 (투네이션 라이브 목록)
  onReloadAll?(): void; // 전체 새로고침 (모든 칸)
  mode?: { value: RemoteMode; onChange(m: RemoteMode): void }; // 상단 스위치: 크리에이터 리모컨 ↔ 후원 리모컨
}

export function Gnb({ layout, onLayout, canDonate, onDonate, onSettings, onHelp, onLogin, loggingIn, onPresets, account, onMini, sound, onLive, onReloadAll, mode }: Props) {
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
                data-tip={LAYOUT_LABEL[l]}
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
          <div className="gnb__tools" role="toolbar" aria-label="도구">
            {onLive && (
              <button type="button" className="gnb__tool gnb__tool--live" aria-label="추천 라이브" data-tip="추천 라이브" onClick={onLive}>
                <IconLive />
              </button>
            )}
            {onReloadAll && (
              <button type="button" className="gnb__tool" aria-label="전체 새로고침" data-tip="전체 새로고침" onClick={onReloadAll}>
                <IconReload />
              </button>
            )}
            {sound && (
              <button
                type="button"
                className={`gnb__tool gnb__mute${sound.on ? '' : ' gnb__mute--on'}`}
                aria-label={sound.on ? '전체 음소거' : '음소거 해제'}
                aria-pressed={!sound.on}
                data-tip={sound.on ? '전체 음소거 (M)' : '음소거 해제 (M)'}
                onClick={sound.onToggle}
              >
                {sound.on ? <IconVolume /> : <IconMute />}
              </button>
            )}
            {onMini && (
              <button type="button" className="gnb__tool" aria-label="미니 모드" data-tip="미니 모드" onClick={onMini}>
                <IconMini />
              </button>
            )}
            {onPresets && (
              <button type="button" className="gnb__tool" aria-label="화면 구성" data-tip="화면 구성 저장·불러오기" onClick={onPresets}>
                <IconPresets />
              </button>
            )}
            {onHelp && (
              <button type="button" className="gnb__tool" aria-label="도움말" data-tip="도움말 · 단축키 (?)" onClick={onHelp}>
                <IconHelp />
              </button>
            )}
            {onSettings && (
              <button type="button" className="gnb__tool" aria-label="설정" data-tip="설정" onClick={onSettings}>
                <IconSettings />
              </button>
            )}
          </div>
          {!account && onLogin && (
            <button type="button" className="gnb__login" aria-label="로그인" data-tip="투네이션 로그인" onClick={onLogin} disabled={loggingIn}>
              <IconUser />
              {loggingIn ? '로그인 중…' : '로그인'}
            </button>
          )}
          {account && (
            <button
              type="button"
              className="gnb__cash"
              aria-label={account.cash === null ? '내 후원 내역' : `내 후원 내역 · 캐시 ${account.cash.toLocaleString('ko-KR')}`}
              data-tip="내 후원 내역"
              onClick={account.onHistory}
            >
              <IconCoin />
              {account.cash === null ? '후원 내역' : account.cash.toLocaleString('ko-KR')}
            </button>
          )}
          <button type="button" className="btn btn--donate gnb__donate" aria-label="후원하기" disabled={!canDonate} onClick={onDonate}>
            <IconHeart />
            후원하기
          </button>
        </>
      )}
    </header>
  );
}
