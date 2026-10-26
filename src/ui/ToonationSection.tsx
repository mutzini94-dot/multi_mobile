import type { Creator } from '../domain/types';
import type { ToonationState } from '../toonation/useToonation';

interface Props {
  state: ToonationState;
  onLogin(): void;
  onRefresh(): void;
  onPick(c: Creator): void;
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

/** 불러오기 창 맨 위: 연동 확장을 통한 투네이션 즐겨찾기 */
export function ToonationSection({ state, onLogin, onRefresh, onPick }: Props) {
  return (
    <section className="toon-section">
      <div className="toon-section__head">
        <h3>{state.status === 'ready' && state.account ? `${state.account.name} 님의 즐겨찾기` : '투네이션 즐겨찾기'}</h3>
        {(state.status === 'ready' || state.status === 'error') && (
          <button type="button" className="btn btn--ghost" onClick={onRefresh}>
            {state.status === 'error' ? '다시 시도' : '새로고침'}
          </button>
        )}
      </div>
      {(state.status === 'idle' || state.status === 'checking' || state.status === 'loading') && <p className="muted">불러오는 중…</p>}
      {state.status === 'no-extension' && (
        <p className="muted">연동 확장을 설치하면 투네이션 즐겨찾기를 불러올 수 있습니다. 확장 없이도 아래에서 직접 추가할 수 있습니다.</p>
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
      {state.status === 'ready' &&
        (state.creators.length === 0 ? (
          <p className="muted">유튜브·트위치 채널이 연결된 즐겨찾기가 없습니다.</p>
        ) : (
          <ul className="fav-list">
            {state.creators.map((c) => (
              <li key={`${c.key}|${c.donateId}`}>
                <button type="button" className="fav-item fav-item--toon" onClick={() => onPick(c)}>
                  {c.profile && <img src={c.profile} alt="" className="fav-item__avatar" />}
                  {c.name} · {PLATFORM_LABEL[c.platform]}
                  <span className="muted"> · {c.channel}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
