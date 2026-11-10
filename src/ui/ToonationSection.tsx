import type { ReactNode } from 'react';
import type { Creator } from '../domain/types';
import type { ToonationState } from '../toonation/useToonation';

interface Props {
  state: ToonationState;
  onLogin(): void;
  onRefresh(): void;
  onPick(c: Creator): void;
  filter?(c: Creator): boolean; // 그룹으로 거르기
  rowExtra?(c: Creator): ReactNode; // 그룹 편집 중 줄마다 그룹 고르기
  phone?: boolean; // 휴대폰 브라우저: 확장을 설치할 수 없다
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

/** 불러오기 창 맨 위: 연동 확장·설치형 앱을 통한 투네이션 즐겨찾기 (라이브 중인 크리에이터가 위) */
export function ToonationSection({ state, onLogin, onRefresh, onPick, filter, rowExtra, phone = false }: Props) {
  const busy = state.status === 'idle' || state.status === 'checking' || state.status === 'loading';
  const showList = state.creators.length > 0 && (state.status === 'ready' || busy);
  const liveCount = state.creators.filter((c) => c.live).length;
  return (
    <section className="toon-section">
      <div className="toon-section__head">
        <h3>{state.account ? `${state.account.name} 님의 즐겨찾기` : '투네이션 즐겨찾기'}</h3>
        {liveCount > 0 && showList && <span className="toon-section__live-count">라이브 {liveCount}명</span>}
        {busy && showList && <span className="muted toon-section__busy">갱신 중…</span>}
        {(state.status === 'ready' || state.status === 'error') && (
          <button type="button" className="btn btn--text" onClick={onRefresh}>
            {state.status === 'error' ? '다시 시도' : '새로고침'}
          </button>
        )}
      </div>
      {busy && !showList && <p className="muted">불러오는 중…</p>}
      {state.status === 'no-extension' && (
        <p className="muted">
          {phone
            ? '휴대폰 브라우저에서는 투네이션 즐겨찾기를 불러올 수 없습니다. 위에 방송 주소를 붙여넣거나 투네이션 라이브 탭에서 고르세요.'
            : '연동 확장을 설치하면 투네이션 즐겨찾기를 불러올 수 있습니다. 확장 없이도 아래에서 직접 추가할 수 있습니다.'}
        </p>
      )}
      {state.status === 'logged-out' && (
        <div className="toon-section__login">
          <p className="muted">투네이션에 로그인하면 즐겨찾기한 크리에이터를 바로 불러올 수 있습니다.</p>
          <button type="button" className="btn btn--donate" onClick={onLogin}>
            투네이션 로그인
          </button>
        </div>
      )}
      {state.status === 'waiting-login' && <p className="muted">로그인 창에서 로그인을 마치면 목록이 나타납니다…</p>}
      {state.status === 'error' && <p className="form-error">즐겨찾기를 불러오지 못했습니다 ({state.error})</p>}
      {state.status === 'ready' && state.creators.length === 0 && <p className="muted">유튜브·트위치 채널이 연결된 즐겨찾기가 없습니다.</p>}
      {showList && (
        <ul className="fav-list">
          {state.creators.filter((c) => !filter || filter(c)).map((c) => (
            <li key={`${c.key}|${c.donateId}`} className={rowExtra ? 'fav-list__row--edit' : undefined}>
              <button type="button" className={`fav-item fav-item--toon${c.live ? ' fav-item--live' : ''}`} onClick={() => onPick(c)}>
                <span className={`fav-item__avatar-wrap${c.live ? ' is-live' : ''}`}>
                  {c.profile ? <img src={c.profile} alt="" className="fav-item__avatar" /> : <span className="fav-item__avatar" />}
                </span>
                <span className="fav-item__text">
                  <span className="fav-item__name">
                    {c.name} · {PLATFORM_LABEL[c.platform]}
                    {c.live && <span className="live-tag">LIVE</span>}
                  </span>
                  {c.live ? (
                    <span className="fav-item__sub">
                      {c.live.title && <span className="fav-item__title">{c.live.title}</span>}
                      <span className="fav-item__viewers">{c.live.viewers.toLocaleString('ko-KR')}명</span>
                    </span>
                  ) : (
                    <span className="fav-item__sub muted">{c.channel}</span>
                  )}
                </span>
              </button>
              {rowExtra?.(c)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
