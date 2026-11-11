import { useState, type ReactNode } from 'react';
import type { Creator } from '../domain/types';
import type { QuickItem } from '../quick/quickPanel';

interface Props {
  favorites: QuickItem[]; // 투네이션 즐겨찾기 + 직접 추가한 크리에이터
  recent: QuickItem[];
  started: Creator[]; // 방금 방송을 시작한 크리에이터
  live: ReactNode; // 추천 라이브 탭 내용 (투네이션 라이브 목록)
  login?: { loggedIn: boolean; onLogin(): void };
  onPick(c: Creator): void;
  onClose(): void;
}

type Tab = 'fav' | 'recent' | 'live';
const TABS: [Tab, string][] = [
  ['fav', '즐겨찾기'],
  ['recent', '최근 본'],
  ['live', '추천 라이브'],
];
const PLATFORM = { youtube: 'YouTube', twitch: 'Twitch' } as const;

/** 휴대폰 불러오기: 즐겨찾기 · 최근 본 · 추천 라이브 세 탭만 */
export function PhonePicker({ favorites, recent, started, live, login, onPick, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(favorites.length || !recent.length ? 'fav' : 'recent');
  const startedKeys = new Set(started.map((c) => c.key));
  const items = tab === 'fav' ? favorites : recent;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal phone-list phone-picker" role="dialog" aria-label="불러오기" onClick={(e) => e.stopPropagation()}>
        <div className="phone-list__head">
          <h2>불러오기</h2>
          <button type="button" className="btn btn--icon" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="phone-picker__tabs" role="tablist">
          {TABS.map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="phone-picker__tab" onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
        <div className="phone-picker__body" role="tabpanel" aria-label={TABS.find(([t]) => t === tab)![1]}>
          {tab === 'live' ? (
            live
          ) : (
            <>
              {tab === 'fav' && login && !login.loggedIn && (
                <button type="button" className="phone-list__login" onClick={login.onLogin}>
                  투네이션 로그인 · 즐겨찾기 불러오기
                </button>
              )}
              {items.length === 0 ? (
                <p className="muted phone-list__empty">{tab === 'fav' ? '즐겨찾기한 크리에이터가 없습니다' : '최근 본 방송이 없습니다'}</p>
              ) : (
                <ul className="phone-list__items">
                  {items.map(({ creator: c, live: on }) => {
                    const isNew = startedKeys.has(c.key);
                    const label = [c.name, on && '방송 중', isNew && '방금 시작', PLATFORM[c.platform]].filter(Boolean).join(' · ');
                    return (
                      <li key={c.key} className="phone-list__item">
                        <button type="button" className="phone-list__pick" aria-label={label} onClick={() => onPick(c)}>
                          <span className={`phone-list__avatar${on ? ' phone-list__avatar--live' : ''}`}>
                            {c.profile ? <img src={c.profile} alt="" loading="lazy" referrerPolicy="no-referrer" /> : c.name.slice(0, 1)}
                          </span>
                          <span className="phone-list__text">
                            <strong>{c.name}</strong>
                            <span>
                              {on
                                ? `${isNew ? '방금 시작 · ' : ''}방송 중${c.live?.viewers ? ` · 시청자 ${c.live.viewers.toLocaleString('ko-KR')}명` : ''}`
                                : PLATFORM[c.platform]}
                            </span>
                          </span>
                          {on && <b className="phone-list__live">LIVE</b>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
