import { useState, type FormEvent } from 'react';
import type { Creator } from '../domain/types';

interface Props {
  search(q: string): Promise<Creator[]>;
  onPick(c: Creator): void;
  onLogin(): void;
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

/** 불러오기 창 '방송' 탭 맨 위: 투네이션 크리에이터를 이름으로 찾아 넣는다 (투네이션 로그인 필요) */
export function SearchSection({ search, onPick, onLogin }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Creator[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'logged-out' | 'error'>('idle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setStatus('loading');
    try {
      setResults(await search(query));
      setStatus('idle');
    } catch (err) {
      setResults(null);
      setStatus((err as Error).message === 'NOT_LOGGED_IN' ? 'logged-out' : 'error');
    }
  };

  return (
    <section className="search-section">
      <form className="page-tab__form" onSubmit={submit}>
        <input aria-label="투네이션 크리에이터 검색" value={q} maxLength={30} placeholder="투네이션 크리에이터 이름으로 찾기" onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn btn--ghost btn--sm" disabled={status === 'loading'}>
          검색
        </button>
      </form>
      {status === 'loading' && <p className="muted">찾는 중…</p>}
      {status === 'logged-out' && (
        <p className="muted">
          투네이션에 로그인해야 검색할 수 있습니다
          <button type="button" className="btn btn--text" onClick={onLogin}>
            로그인
          </button>
        </p>
      )}
      {status === 'error' && <p className="form-error">검색하지 못했습니다. 잠시 뒤 다시 시도해 주세요</p>}
      {results && results.length === 0 && status === 'idle' && <p className="muted">유튜브·트위치 채널이 연결된 크리에이터를 찾지 못했습니다.</p>}
      {results && results.length > 0 && (
        <ul className="fav-list">
          {results.map((c) => (
            <li key={`${c.key}|${c.donateId}`}>
              <button type="button" className="fav-item fav-item--toon" onClick={() => onPick(c)}>
                {c.profile ? <img src={c.profile} alt="" className="fav-item__avatar" /> : <span className="fav-item__avatar" />}
                <span className="fav-item__text">
                  <span className="fav-item__name">
                    {c.name} · {PLATFORM_LABEL[c.platform]}
                    {c.live && <span className="live-tag">LIVE</span>}
                  </span>
                  <span className="fav-item__sub muted">{c.live?.title || c.channel}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
