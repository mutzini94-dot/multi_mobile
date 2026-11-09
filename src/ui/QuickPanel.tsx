import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { clampShortsHeight, clampShortsWidth, SHORTS_DEFAULT_WIDTH } from '../quick/shortsSize';
import type { Creator } from '../domain/types';
import type { QuickItem } from '../quick/quickPanel';
import { startCreatorDrag } from '../app/creatorDrag';

interface Props {
  side: 'left' | 'right';
  favorites: QuickItem[];
  recent: QuickItem[];
  started: Creator[]; // 방금 방송을 시작한 크리에이터 (알림)
  onPick(c: Creator): void; // 넣을 칸 고르기
  onDismiss(key: string): void; // 알림 닫기
  // 맨 위 '추천 라이브 탐색': 옆으로 펼치는 쇼츠처럼 넘겨 보기. size = 조절한 크기 (null = 기본), onResize = 조절을 마쳤을 때 (저장)
  shorts?: { open: boolean; onToggle(): void; content: ReactNode; size?: ShortsSize; onResize?(s: ShortsSize): void };
  onAddWindow?: (() => void) | null; // 맨 아래 '창 추가' (null = 더 늘릴 수 없음)
  login?: { loggedIn: boolean; onLogin(): void }; // 투네이션 로그인 전이면 즐겨찾기 자리에 로그인 버튼
  onRemoveRecent?(c: Creator): void; // 최근 본 목록에서 지우기
}

export interface ShortsSize {
  width: number | null; // null = 기본 너비
  height: number | null; // null = 퀵패널 높이 그대로
}

const TABS = [
  { key: 'fav', label: '즐겨찾기', icon: '★' },
  { key: 'recent', label: '최근 본', icon: '🕘' },
] as const;

/** 마우스가 떠난 뒤 접기까지 (빠르게 지나갈 때 깜빡이지 않게) */
const COLLAPSE_MS = 140;

/**
 * 화면 옆 퀵패널 (Edge 사이드바처럼): 즐겨찾기·최근 본 크리에이터를 프로필로, 방송 시작 알림.
 * 마우스를 올리면 넓어지며(칸 위로 겹친다) 버튼 이름·크리에이터 이름을 함께 보여 준다.
 */
export function QuickPanel({ side, favorites, recent, started, onPick, onDismiss, shorts, onAddWindow, login, onRemoveRecent }: Props) {
  const [tab, setTab] = useState<'fav' | 'recent'>('fav');
  const [expanded, setExpanded] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const newKeys = new Set(started.map((c) => c.key));
  const items = tab === 'fav' ? favorites : recent;
  const hasNew = (list: QuickItem[]) => list.some((i) => newKeys.has(i.creator.key));
  const showLogin = tab === 'fav' && !!login && !login.loggedIn;
  const enter = () => {
    clearTimeout(leaveTimer.current);
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches) return; // 휴대폰: 하단 바는 넓히지 않는다
    setExpanded(true);
  };
  const leave = () => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setExpanded(false), COLLAPSE_MS);
  };

  return (
    <aside className={`quick-panel quick-panel--${side}${expanded ? ' quick-panel--expanded' : ''}`} aria-label="퀵패널">
      <div className="quick-panel__rail" onPointerEnter={enter} onPointerLeave={leave}>
        {/* 머리: 추천 라이브 탐색 · 즐겨찾기/최근 본 탭 */}
        <div className="quick-panel__head">
          {shorts && (
            <>
              <button
                type="button"
                className={`quick-panel__row quick-panel__shorts${shorts.open ? ' quick-panel__shorts--on' : ''}`}
                aria-label="추천 라이브 탐색"
                aria-pressed={shorts.open}
                title="추천 라이브를 한 개씩 넘겨 보기"
                onClick={shorts.onToggle}
              >
                <span className="quick-panel__icon">
                  <span className="quick-panel__shorts-badge">LIVE</span>
                </span>
                <span className="quick-panel__label">추천 라이브</span>
              </button>
              <div className="quick-panel__divider" />
            </>
          )}
          <div className="quick-panel__tabs" role="tablist">
            {TABS.map((t) => {
              const dot = t.key !== tab && hasNew(t.key === 'fav' ? favorites : recent);
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  aria-label={dot ? `${t.label} · 새 방송` : t.label}
                  title={t.label}
                  className={`quick-panel__row quick-panel__tab${dot ? ' quick-panel__tab--new' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  <span className="quick-panel__icon" aria-hidden="true">
                    {t.icon}
                  </span>
                  <span className="quick-panel__label">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* 목록: 지금 탭의 크리에이터 (넓어졌을 때만 제목) */}
        <div className="quick-panel__caption" aria-hidden="true">
          {tab === 'fav' ? '즐겨찾기' : '최근 본'}
          {items.length > 0 && <span>{items.length}</span>}
        </div>
        <ul className="quick-panel__list">
          {showLogin && (
            <li>
              <button type="button" className="quick-panel__row quick-panel__item quick-panel__login" aria-label="로그인 · 즐겨찾기 불러오기" title="투네이션에 로그인하면 즐겨찾기를 불러옵니다" onClick={login!.onLogin}>
                <span className="quick-panel__avatar quick-panel__avatar--icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8.5" r="3.5" />
                    <path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" />
                  </svg>
                </span>
                <span className="quick-panel__label">
                  로그인
                  <em className="quick-panel__sub">즐겨찾기 불러오기</em>
                </span>
              </button>
            </li>
          )}
          {items.length === 0 && !showLogin && (
            <li className="quick-panel__empty" title={tab === 'fav' ? '즐겨찾기한 크리에이터가 없습니다' : '최근 본 방송이 없습니다'}>
              <span className="quick-panel__avatar quick-panel__avatar--ghost" aria-hidden="true" />
              <span className="quick-panel__label">
                {tab === 'fav' ? '즐겨찾기 없음' : '최근 본 방송 없음'}
                <em className="quick-panel__sub">{tab === 'fav' ? '불러오기에서 추가' : '방송을 띄우면 쌓여요'}</em>
              </span>
            </li>
          )}
          {items.map(({ creator: c, live }) => {
            const isNew = newKeys.has(c.key);
            const label = [c.name, live && '방송 중', isNew && '방금 시작'].filter(Boolean).join(' · ');
            return (
              <li key={c.key} className={`quick-panel__card${live ? ' quick-panel__card--live' : ''}`}>
                <button
                  type="button"
                  aria-label={label}
                  title={live && c.live?.title ? `${c.name} · ${c.live.title}` : c.name}
                  className={`quick-panel__row quick-panel__item${live ? ' quick-panel__item--live' : ''}${isNew ? ' quick-panel__item--new' : ''}`}
                  onClick={() => onPick(c)}
                  draggable
                  onDragStart={(e) => startCreatorDrag(e.dataTransfer, c)}
                >
                  <span className="quick-panel__avatar">
                    {c.profile ? <img src={c.profile} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} /> : <span className="quick-panel__initial">{c.name.slice(0, 1)}</span>}
                    {live && <span className="quick-panel__live-dot" aria-hidden="true" />}
                  </span>
                  <span className="quick-panel__label">
                    <span className="quick-panel__name">{c.name}</span>
                    {live ? (
                      <em className="quick-panel__sub quick-panel__sub--live">{c.live?.viewers ? `방송 중 · ${c.live.viewers.toLocaleString('ko-KR')}명` : '방송 중'}</em>
                    ) : (
                      <em className="quick-panel__sub">{c.platform === 'youtube' ? 'YouTube' : 'Twitch'}</em>
                    )}
                  </span>
                </button>
                {tab === 'recent' && onRemoveRecent && (
                  <button type="button" className="quick-panel__remove" aria-label={`최근 본 목록에서 ${c.name} 삭제`} title="최근 본 목록에서 삭제" onClick={() => onRemoveRecent(c)}>
                    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {/* 하단: 창 추가 */}
        {onAddWindow !== undefined && (
          <div className="quick-panel__foot">
            <button
              type="button"
              className="quick-panel__row quick-panel__add"
              aria-label="창 추가"
              title={onAddWindow ? '창 추가' : '더 이상 창을 추가할 수 없어요 (9분할)'}
              disabled={!onAddWindow}
              onClick={() => onAddWindow?.()}
            >
              <span className="quick-panel__icon" aria-hidden="true">
                +
              </span>
              <span className="quick-panel__label">창 추가</span>
            </button>
          </div>
        )}
      </div>
      {shorts?.open && <ShortsDrawer side={side} size={shorts.size ?? { width: null, height: null }} onResize={shorts.onResize} content={shorts.content} />}
      {started.length > 0 && (
        <div className="quick-panel__alerts" role="status" aria-label="방송 시작 알림">
          {started.map((c) => (
            <div key={c.key} className="quick-panel__alert">
              <button type="button" className="quick-panel__alert-main" aria-label={`${c.name} 방송 칸에 넣기`} onClick={() => onPick(c)}>
                {c.profile ? <img src={c.profile} alt="" referrerPolicy="no-referrer" /> : <span className="quick-panel__initial">{c.name.slice(0, 1)}</span>}
                <span className="quick-panel__alert-text">
                  <strong>{c.name} 방송 시작</strong>
                  {c.live?.title && <span>{c.live.title}</span>}
                </span>
              </button>
              <button type="button" className="btn btn--icon quick-panel__alert-close" aria-label={`${c.name} 알림 닫기`} onClick={() => onDismiss(c.key)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

/**
 * 추천 라이브 탐색 창: 바깥쪽 가장자리(너비)·아래 가장자리(높이)·바깥 아래 모서리(둘 다)를 끌어 크기를 바꾼다.
 * 화살표 키로 20px씩, 가장자리를 두 번 누르면 기본 크기
 */
function ShortsDrawer({ side, size, onResize, content }: { side: 'left' | 'right'; size: ShortsSize; onResize?(s: ShortsSize): void; content: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<ShortsSize | null>(null); // 끄는 중인 크기
  const now = live ?? size;
  const available = () => ref.current?.parentElement?.clientHeight || window.innerHeight; // 퀵패널 높이
  const width = now.width ?? SHORTS_DEFAULT_WIDTH;
  const height = now.height ?? available();
  const sign = side === 'left' ? 1 : -1; // 왼쪽 패널이면 창의 오른쪽 가장자리를 끈다
  const fitW = (w: number) => clampShortsWidth(w, window.innerWidth);
  const fitH = (h: number) => clampShortsHeight(h, available());

  const drag = (axes: { x?: boolean; y?: boolean }) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const w0 = width;
    const h0 = height;
    let last: ShortsSize = { width: now.width, height: now.height };
    // 화면 갱신은 한 프레임에 한 번만 (포인터 이벤트마다 다시 그리지 않게)
    let frame = 0;
    const move = (ev: PointerEvent) => {
      last = {
        width: axes.x ? fitW(w0 + (ev.clientX - sx) * sign) : now.width,
        height: axes.y ? fitH(h0 + (ev.clientY - sy)) : now.height,
      };
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          setLive(last);
        });
    };
    const up = (ev: PointerEvent) => {
      move(ev);
      cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('is-resizing-x', 'is-resizing-y', 'is-resizing-xy');
      setLive(null);
      onResize?.(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.classList.add(axes.x && axes.y ? 'is-resizing-xy' : axes.x ? 'is-resizing-x' : 'is-resizing-y');
  };
  const keyWidth = (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === 'ArrowRight' ? 20 : e.key === 'ArrowLeft' ? -20 : 0;
    if (!step) return;
    e.preventDefault();
    onResize?.({ width: fitW(width + step * sign), height: now.height });
  };
  const keyHeight = (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === 'ArrowDown' ? 20 : e.key === 'ArrowUp' ? -20 : 0;
    if (!step) return;
    e.preventDefault();
    onResize?.({ width: now.width, height: fitH(height + step) });
  };

  return (
    <div
      ref={ref}
      className={`quick-panel__drawer${live ? ' quick-panel__drawer--resizing' : ''}${now.height !== null ? ' quick-panel__drawer--sized' : ''}`}
      style={{ width: `${width}px`, height: now.height !== null ? `${now.height}px` : undefined }}
    >
      {content}
      {onResize && (
        <>
          <div
            className="quick-panel__drawer-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="추천 라이브 창 크기 조절"
            aria-valuenow={width}
            tabIndex={0}
            title="끌어서 너비 조절 (두 번 누르면 기본 너비)"
            onPointerDown={drag({ x: true })}
            onKeyDown={keyWidth}
            onDoubleClick={() => onResize({ width: null, height: now.height })}
          />
          <div
            className="quick-panel__drawer-resize-y"
            role="separator"
            aria-orientation="horizontal"
            aria-label="추천 라이브 창 높이 조절"
            aria-valuenow={height}
            tabIndex={0}
            title="끌어서 높이 조절 (두 번 누르면 패널 높이)"
            onPointerDown={drag({ y: true })}
            onKeyDown={keyHeight}
            onDoubleClick={() => onResize({ width: now.width, height: null })}
          />
          <button
            type="button"
            className="quick-panel__drawer-corner"
            aria-label="추천 라이브 창 크기 조절 (모서리)"
            title="끌어서 너비·높이 조절 (두 번 누르면 기본 크기)"
            tabIndex={-1}
            onPointerDown={drag({ x: true, y: true })}
            onDoubleClick={() => onResize({ width: null, height: null })}
          />
        </>
      )}
    </div>
  );
}
