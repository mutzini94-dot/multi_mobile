import { useState, type ReactNode } from 'react';
import type { Creator } from '../domain/types';
import type { QuickItem } from '../quick/quickPanel';

interface Props {
  favorites: QuickItem[];
  recent: QuickItem[];
  started: Creator[]; // 방금 방송을 시작한 크리에이터 (즐겨찾기 탭에 점)
  onPick(c: Creator): void; // 칸에 넣기
  onRemoveRecent?(c: Creator): void;
  login?: { loggedIn: boolean; onLogin(): void };
  shorts: { open: boolean; onToggle(): void; content: ReactNode };
  overview: { on: boolean; onToggle(): void };
  onAddWindow: (() => void) | null; // null = 더 늘릴 수 없음 (휴대폰 최대 6개)
}

const Star = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z" />
  </svg>
);
const Clock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
);
const Grid = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3.5" y="4.5" width="7.5" height="6.5" rx="1.6" />
    <rect x="13" y="4.5" width="7.5" height="6.5" rx="1.6" />
    <rect x="3.5" y="13" width="7.5" height="6.5" rx="1.6" />
    <rect x="13" y="13" width="7.5" height="6.5" rx="1.6" />
  </svg>
);
const Plus = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * 휴대폰 하단 탭 막대 (시안 C · 와이드 피드): 추천 라이브 · 즐겨찾기 · 최근 본 · 전체보기 · 창 추가.
 * 즐겨찾기·최근 본은 아래에서 올라오는 목록으로, 누르면 그 방송을 칸에 넣는다.
 */
export function PhoneDock({ favorites, recent, started, onPick, onRemoveRecent, login, shorts, overview, onAddWindow }: Props) {
  const [sheet, setSheet] = useState<'fav' | 'recent' | null>(null);
  const startedKeys = new Set(started.map((c) => c.key));
  const items = sheet === 'fav' ? favorites : sheet === 'recent' ? recent : [];
  return (
    <>
      <nav className="phone-dock" aria-label="하단 메뉴">
        <button type="button" className="phone-dock__tab" aria-pressed={shorts.open} onClick={shorts.onToggle}>
          <b className="phone-dock__live" aria-hidden="true">
            LIVE
          </b>
          <span>추천 라이브</span>
        </button>
        <button type="button" className="phone-dock__tab" aria-label="즐겨찾기" onClick={() => setSheet('fav')}>
          <Star />
          <span>즐겨찾기</span>
          {started.length > 0 && <i className="phone-dock__dot" aria-label="방금 방송을 시작한 크리에이터가 있어요" />}
        </button>
        <button type="button" className="phone-dock__tab" aria-label="최근 본" onClick={() => setSheet('recent')}>
          <Clock />
          <span>최근 본</span>
        </button>
        <button type="button" className="phone-dock__tab" aria-label="전체보기" aria-pressed={overview.on} onClick={overview.onToggle}>
          <Grid />
          <span>전체보기</span>
        </button>
        <button type="button" className="phone-dock__tab" aria-label="창 추가" disabled={!onAddWindow} title={onAddWindow ? '창 추가' : '창은 최대 6개까지'} onClick={() => onAddWindow?.()}>
          <Plus />
          <span>창 추가</span>
        </button>
      </nav>
      {shorts.open && (
        <div className="quick-panel__drawer phone-dock__shorts" role="dialog" aria-label="추천 라이브">
          {shorts.content}
        </div>
      )}
      {sheet && (
        <div className="modal-backdrop" onClick={() => setSheet(null)}>
          <div className="modal phone-list" role="dialog" aria-label={sheet === 'fav' ? '즐겨찾기' : '최근 본'} onClick={(e) => e.stopPropagation()}>
            <div className="phone-list__head">
              <h2>{sheet === 'fav' ? '즐겨찾기' : '최근 본'}</h2>
              <button type="button" className="btn btn--icon" aria-label="닫기" onClick={() => setSheet(null)}>
                ✕
              </button>
            </div>
            {sheet === 'fav' && login && !login.loggedIn && (
              <button
                type="button"
                className="phone-list__login"
                onClick={() => {
                  setSheet(null);
                  login.onLogin();
                }}
              >
                투네이션 로그인 · 즐겨찾기 불러오기
              </button>
            )}
            {items.length === 0 ? (
              <p className="muted phone-list__empty">{sheet === 'fav' ? '즐겨찾기한 크리에이터가 없습니다' : '최근 본 방송이 없습니다'}</p>
            ) : (
              <ul className="phone-list__items">
                {items.map(({ creator: c, live }) => {
                  const isNew = startedKeys.has(c.key);
                  const label = [c.name, live && '방송 중', isNew && '방금 시작'].filter(Boolean).join(' · ');
                  return (
                    <li key={c.key} className="phone-list__item">
                      <button
                        type="button"
                        className="phone-list__pick"
                        aria-label={label}
                        onClick={() => {
                          setSheet(null);
                          onPick(c);
                        }}
                      >
                        <span className={`phone-list__avatar${live ? ' phone-list__avatar--live' : ''}`}>
                          {c.profile ? <img src={c.profile} alt="" loading="lazy" referrerPolicy="no-referrer" /> : c.name.slice(0, 1)}
                        </span>
                        <span className="phone-list__text">
                          <strong>{c.name}</strong>
                          <span>
                            {live
                              ? `${isNew ? '방금 시작 · ' : ''}방송 중${c.live?.viewers ? ` · 시청자 ${c.live.viewers.toLocaleString('ko-KR')}명` : ''}`
                              : c.platform === 'youtube'
                                ? 'YouTube'
                                : 'Twitch'}
                          </span>
                        </span>
                        {live && <b className="phone-list__live">LIVE</b>}
                      </button>
                      {sheet === 'recent' && onRemoveRecent && (
                        <button type="button" className="btn btn--icon" aria-label={`최근 본 목록에서 ${c.name} 삭제`} onClick={() => onRemoveRecent(c)}>
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
