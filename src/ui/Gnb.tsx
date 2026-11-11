import { useEffect, useState } from 'react';
import { usePhone } from './usePhone';
import type { LayoutKind } from '../domain/types';
import type { RemoteMode } from '../app/remoteMode';
import { LAYOUT_LABEL, LAYOUTS } from '../layout/layouts';
import logoUrl from '../assets/logo.png';
import { IconChat, IconMoon, IconShare, IconCoin, IconHeart, IconHelp, IconPalette, IconUser, IconLive, IconMini, IconMute, IconPresets, IconReload, IconSettings, IconVolume } from './icons';


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
  twelve: Array.from({ length: 12 }, (_, i) => `c${i}`),
  sixteen: Array.from({ length: 16 }, (_, i) => `c${i}`),
};

interface Props {
  layout: LayoutKind;
  onLayout(l: LayoutKind): void;
  canDonate: boolean;
  onDonate(): void;
  onChat?(): void; // 휴대폰: 선택한 방송의 채팅 시트
  onHome?(): void; // 로고: 첫 화면으로 (전체보기·시트를 닫고 맨 위로)
  overview?: { on: boolean; onToggle(): void }; // 휴대폰: 모든 창을 작은 타일로 모아 보기
  sleep?: { remainingMin: number | null; onOpen(): void }; // 휴대폰 메뉴: 취침 타이머
  canChat?: boolean;
  onSettings?(): void;
  onHelp?(): void; // 도움말 (자주 묻는 질문·단축키·둘러보기)
  onSkin?(x: number, y: number): void; // 스킨 바꾸기 메뉴 (누른 버튼 아래에)
  onLogin?(): void; // 투네이션 로그인 (로그인 전에만)
  loggingIn?: boolean; // 로그인 창이 열려 있는 동안
  onPresets?(): void; // 화면 구성 저장·불러오기
  onShare?(): void; // 화면 구성 공유 (링크·QR)
  account?: { cash: number | null; onHistory(): void } | null; // 투네이션 로그인: 캐시 잔액 · 내 후원 내역
  onMini?(): void; // 미니 모드 (방송이 있을 때만)
  sound?: { on: boolean; onToggle(): void }; // 전체 음소거·해제 (단축키 M과 같은 상태)
  onLive?(): void; // 추천 라이브 (투네이션 라이브 목록)
  onReloadAll?(): void; // 전체 새로고침 (모든 창)
  mode?: { value: RemoteMode; onChange(m: RemoteMode): void }; // 상단 스위치: 크리에이터 리모컨 ↔ 후원 리모컨
}

export function Gnb(props: Props) {
  const [sheet, setSheet] = useState(false);
  const phone = usePhone();
  // 휴대폰 메뉴는 휴대폰 폭에서만: 창을 넓히면 닫는다
  useEffect(() => {
    if (!phone) setSheet(false);
  }, [phone]);
  return (
    <>
      <GnbBar {...props} onMenu={() => setSheet(true)} />
      {sheet && <PhoneSheet {...props} onClose={() => setSheet(false)} />}
    </>
  );
}

function GnbBar({ onMenu, onHome, overview, layout, onLayout, canDonate, onDonate, onChat, canChat, onSettings, onHelp, onSkin, onLogin, loggingIn, onPresets, onShare, account, onMini, sound, onLive, onReloadAll, mode }: Props & { onMenu(): void }) {
  const creator = mode?.value === 'creator';
  // 화면 모양: 평소에는 지금 모양 하나만 보이고, 누르면 9가지가 펼쳐진다
  const [layoutsOpen, setLayoutsOpen] = useState(false);
  useEffect(() => {
    if (!layoutsOpen) return;
    const close = (e: Event) => !(e.target as HTMLElement)?.closest?.('.gnb__layouts') && setLayoutsOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [layoutsOpen]);
  return (
    <header className="gnb">
      {onHome ? (
        <button type="button" className="gnb__logo gnb__logo--home" aria-label="첫 화면으로" title="첫 화면으로" onClick={onHome}>
          <img className="gnb__logo-img" src={logoUrl} alt="" />
        </button>
      ) : (
        <span className="gnb__logo">
          <img className="gnb__logo-img" src={logoUrl} alt="투네이션 후원 브라우저" />
        </span>
      )}
      {overview && (
        <button type="button" className="gnb__overview" aria-label="전체보기" title="전체보기" aria-pressed={overview.on} onClick={overview.onToggle}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
            <rect x="3.5" y="4.5" width="7.5" height="6.5" rx="1.6" />
            <rect x="13" y="4.5" width="7.5" height="6.5" rx="1.6" />
            <rect x="3.5" y="13" width="7.5" height="6.5" rx="1.6" />
            <rect x="13" y="13" width="7.5" height="6.5" rx="1.6" />
          </svg>
        </button>
      )}
      {/* 휴대폰: 레이아웃·도구·설정을 담은 시트를 여는 메뉴 버튼 (넓은 화면에서는 숨김) */}
      <button type="button" className="gnb__more" aria-label="메뉴" onClick={onMenu}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
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
          <div className={`gnb__layouts${layoutsOpen ? ' gnb__layouts--open' : ''}`} role="group" aria-label="화면 모양">
            {LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                aria-label={LAYOUT_LABEL[l]}
                data-tip={layoutsOpen ? LAYOUT_LABEL[l] : `화면 모양: ${LAYOUT_LABEL[l]} (눌러서 바꾸기)`}
                aria-pressed={layout === l}
                aria-expanded={layout === l ? layoutsOpen : undefined}
                className={`layout-icon layout-icon--${l}`}
                onClick={() => {
                  if (layout === l && !layoutsOpen) return setLayoutsOpen(true);
                  setLayoutsOpen(false);
                  onLayout(l);
                }}
              >
                {ICON_CELLS[l].map((c) => (
                  <i key={c} />
                ))}
              </button>
            ))}
          </div>
          <div className="gnb__tools" role="toolbar" aria-label="도구">
            {onLive && (
              <button type="button" className="gnb__tool gnb__tool--live gnb__tool--text" aria-label="추천 라이브" onClick={onLive}>
                <IconLive />
                <span>추천 라이브</span>
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
            {onShare && (
              <button type="button" className="gnb__tool" aria-label="화면 공유" data-tip="화면 구성 공유 (링크·QR)" onClick={onShare}>
                <IconShare />
              </button>
            )}
            {onHelp && (
              <button type="button" className="gnb__tool" aria-label="도움말" data-tip="도움말 · 단축키 (?)" onClick={onHelp}>
                <IconHelp />
              </button>
            )}
            {onSkin && (
              <button
                type="button"
                className="gnb__tool"
                aria-label="스킨"
                data-tip="스킨 바꾸기"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onSkin(r.left, r.bottom + 6);
                }}
              >
                <IconPalette />
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
          {onChat && (
            <button type="button" className="btn gnb__chat" aria-label="채팅" disabled={!canChat} onClick={onChat}>
              <IconChat />
              채팅
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

/** 휴대폰 '메뉴' 시트: 상단 바에 다 들어가지 않는 레이아웃·도구·설정·로그인·리모컨 전환 (고르면 닫힌다) */
function PhoneSheet({ layout, onLayout, onSettings, onHelp, onSkin, onLogin, loggingIn, onPresets, onShare, account, onMini, sound, onLive, onReloadAll, mode, sleep, onClose }: Props & { onClose(): void }) {
  const creator = mode?.value === 'creator';
  const run = (fn?: () => void) => () => {
    onClose();
    fn?.();
  };
  const row = (label: string, icon: React.ReactNode, fn?: () => void, extra?: { pressed?: boolean; disabled?: boolean }) =>
    fn && (
      <button type="button" className="phone-sheet__row" aria-label={label} aria-pressed={extra?.pressed} disabled={extra?.disabled} onClick={run(fn)}>
        <span className="phone-sheet__icon" aria-hidden="true">
          {icon}
        </span>
        {label}
      </button>
    );
  return (
    <div className="modal-backdrop phone-sheet__backdrop" onClick={onClose}>
      <div className="phone-sheet" role="dialog" aria-label="메뉴" onClick={(e) => e.stopPropagation()}>
        <span className="phone-sheet__grip" aria-hidden="true" />
        {mode && (
          <div className="phone-sheet__mode">
            {(
              [
                ['donor', '후원 리모컨'],
                ['creator', '크리에이터 리모컨'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-label={label} aria-pressed={mode.value === k} className="phone-sheet__mode-btn" onClick={run(() => mode.onChange(k))}>
                {label}
              </button>
            ))}
          </div>
        )}
        {/* 로그인 상태를 맨 위에 (채팅·후원하기·추천 라이브는 상단 바·아래 탭에 있어 메뉴에서 뺐다) */}
        {!creator && !account && onLogin && (
          <button type="button" className="phone-sheet__login" disabled={loggingIn} onClick={run(onLogin)}>
            <IconUser />
            <span>
              <strong>{loggingIn ? '로그인 중…' : '투네이션 로그인'}</strong>
              <small>즐겨찾기 · 후원 내역 불러오기</small>
            </span>
          </button>
        )}
        {!creator && (
          <>
            <div className="phone-sheet__list">
              {account && row(account.cash === null ? '내 후원 내역' : `내 후원 내역 · 캐시 ${account.cash.toLocaleString('ko-KR')}`, <IconCoin />, account.onHistory)}
              {row('전체 새로고침', <IconReload />, onReloadAll)}
              {sound && row(sound.on ? '전체 음소거' : '음소거 해제', sound.on ? <IconVolume /> : <IconMute />, sound.onToggle, { pressed: !sound.on })}
              {row('미니 모드', <IconMini />, onMini)}
              {row('화면 구성', <IconPresets />, onPresets)}
              {row('화면 공유', <IconShare />, onShare)}
              {sleep && row(sleep.remainingMin !== null ? `취침 타이머 · ${sleep.remainingMin}분 남음` : '취침 타이머', <IconMoon />, sleep.onOpen, { pressed: sleep.remainingMin !== null })}
              {row('스킨', <IconPalette />, onSkin && (() => onSkin(Math.round(window.innerWidth / 2) - 90, Math.round(window.innerHeight / 3))))}
              {row('도움말', <IconHelp />, onHelp)}
              {row('설정', <IconSettings />, onSettings)}
            </div>
          </>
        )}
        <p className="phone-sheet__version">버전 {__APP_BUILD__}</p>
      </div>
    </div>
  );
}
