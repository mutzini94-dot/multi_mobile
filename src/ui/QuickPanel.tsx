import { useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { clampShortsWidth, SHORTS_DEFAULT_WIDTH } from '../quick/shortsSize';
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
  // 맨 위 '추천 라이브 탐색': 옆으로 펼치는 쇼츠처럼 넘겨 보기. width = 조절한 너비 (null = 기본), onResize = 조절을 마쳤을 때 (저장)
  shorts?: { open: boolean; onToggle(): void; content: ReactNode; width?: number | null; onResize?(w: number): void };
  onAddWindow?: (() => void) | null; // 맨 아래 '창 추가' (null = 더 늘릴 수 없음)
}

const TABS = [
  { key: 'fav', label: '즐겨찾기', icon: '★' },
  { key: 'recent', label: '최근 본', icon: '🕘' },
] as const;

/** 화면 옆 퀵패널 (Edge 사이드바처럼): 즐겨찾기·최근 본 크리에이터를 프로필로, 방송 시작 알림 */
export function QuickPanel({ side, favorites, recent, started, onPick, onDismiss, shorts, onAddWindow }: Props) {
  const [tab, setTab] = useState<'fav' | 'recent'>('fav');
  const newKeys = new Set(started.map((c) => c.key));
  const items = tab === 'fav' ? favorites : recent;
  const hasNew = (list: QuickItem[]) => list.some((i) => newKeys.has(i.creator.key));

  return (
    <aside className={`quick-panel quick-panel--${side}`} aria-label="퀵패널">
      {/* 머리: 추천 라이브 탐색 · 즐겨찾기/최근 본 탭 */}
      <div className="quick-panel__head">
        {shorts && (
          <>
            <button
              type="button"
              className={`quick-panel__shorts${shorts.open ? ' quick-panel__shorts--on' : ''}`}
              aria-label="추천 라이브 탐색"
              aria-pressed={shorts.open}
              title="추천 라이브를 한 개씩 넘겨 보기"
              onClick={shorts.onToggle}
            >
              <span className="quick-panel__shorts-badge">LIVE</span>
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
                className={`quick-panel__tab${dot ? ' quick-panel__tab--new' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <span aria-hidden="true">{t.icon}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* 목록: 지금 탭의 크리에이터 */}
      <div className="quick-panel__caption" aria-hidden="true">
        {tab === 'fav' ? '즐겨찾기' : '최근 본'}
      </div>
      <ul className="quick-panel__list">
        {items.length === 0 && <li className="quick-panel__empty">{tab === 'fav' ? '즐겨찾기 없음' : '최근 본 방송 없음'}</li>}
        {items.map(({ creator: c, live }) => {
          const isNew = newKeys.has(c.key);
          const label = [c.name, live && '방송 중', isNew && '방금 시작'].filter(Boolean).join(' · ');
          return (
            <li key={c.key}>
              <button
                type="button"
                aria-label={label}
                title={live && c.live?.title ? `${c.name} · ${c.live.title}` : c.name}
                className={`quick-panel__item${live ? ' quick-panel__item--live' : ''}${isNew ? ' quick-panel__item--new' : ''}`}
                onClick={() => onPick(c)}
                draggable
                onDragStart={(e) => startCreatorDrag(e.dataTransfer, c)}
              >
                {c.profile ? <img src={c.profile} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} /> : <span className="quick-panel__initial">{c.name.slice(0, 1)}</span>}
                {live && <span className="quick-panel__live-dot" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      {/* 하단: 창 추가 */}
      {onAddWindow !== undefined && (
        <div className="quick-panel__foot">
          <button
            type="button"
            className="quick-panel__add"
            aria-label="창 추가"
            title={onAddWindow ? '창 추가' : '더 이상 창을 추가할 수 없어요 (9분할)'}
            disabled={!onAddWindow}
            onClick={() => onAddWindow?.()}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      )}
      {shorts?.open && <ShortsDrawer side={side} width={shorts.width ?? null} onResize={shorts.onResize} content={shorts.content} />}
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

/** 추천 라이브 탐색 창: 바깥쪽 가장자리를 끌거나(화살표 키 20px씩) 너비를 바꾼다. 두 번 누르면 기본 너비 */
function ShortsDrawer({ side, width, onResize, content }: { side: 'left' | 'right'; width: number | null; onResize?(w: number): void; content: ReactNode }) {
  const [live, setLive] = useState<number | null>(null); // 끄는 중인 너비
  const current = live ?? width ?? SHORTS_DEFAULT_WIDTH;
  const sign = side === 'left' ? 1 : -1; // 왼쪽 패널이면 창의 오른쪽 가장자리를 끈다
  const clamp = (w: number) => clampShortsWidth(w, window.innerWidth);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const startX = e.clientX;
    const start = current;
    let last = start;
    const move = (ev: PointerEvent) => {
      last = clamp(start + (ev.clientX - startX) * sign);
      setLive(last);
    };
    const up = (ev: PointerEvent) => {
      move(ev);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('is-resizing-x');
      setLive(null);
      onResize?.(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.classList.add('is-resizing-x');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 20 : e.key === 'ArrowLeft' ? -20 : 0;
    if (!step) return;
    e.preventDefault();
    onResize?.(clamp(current + step * sign));
  };

  return (
    <div className={`quick-panel__drawer${live !== null ? ' quick-panel__drawer--resizing' : ''}`} style={{ width: `${current}px` }}>
      {content}
      {onResize && (
        <div
          className="quick-panel__drawer-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="추천 라이브 창 크기 조절"
          aria-valuenow={current}
          tabIndex={0}
          title="끌어서 창 크기 조절 (두 번 누르면 기본 크기)"
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          onDoubleClick={() => onResize(SHORTS_DEFAULT_WIDTH)}
        />
      )}
    </div>
  );
}
