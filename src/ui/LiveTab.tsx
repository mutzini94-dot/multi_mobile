import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Creator } from '../domain/types';
import type { LiveItem, LivePage, LiveQuery, OtherLive } from '../toonation/liveList';

interface Props {
  load(q: LiveQuery): Promise<LivePage>;
  onPick(c: Creator): void;
  favoriteTags?: Set<string>; // 투네이션 즐겨찾기한 후원 아이디 (로그인했을 때만 ♡)
  onToggleFavorite?(c: Creator, on: boolean): Promise<void>;
  onPickChzzk?(o: OtherLive): void; // 설치형: 치지직 방송을 웹페이지 칸으로 (웹은 띄울 수 없어 목록에서 뺀다)
}

const PAGE_SIZE = 20;
const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

/** 목록에 나온 카테고리, 많은 순 8개 */
function topCategories(items: LiveItem[]): string[] {
  const n = new Map<string, number>();
  for (const i of items) if (i.category) n.set(i.category, (n.get(i.category) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
}

/** 불러오기 창 '투네이션 라이브' 탭: toon.at/donator?live 목록에서 골라 칸에 넣는다 */
export function LiveTab({ load, onPick, favoriteTags, onToggleFavorite, onPickChzzk }: Props) {
  const [others, setOthers] = useState<OtherLive[]>([]);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState<Omit<LiveQuery, 'page' | 'size'>>({ q: '', order: 'VIEWERS', platform: '', category: '' });
  const [busyTag, setBusyTag] = useState<string | null>(null);
  const [items, setItems] = useState<LiveItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const req = useRef(0);

  const fetchPage = useCallback(
    async (n: number) => {
      const id = ++req.current;
      setStatus('loading');
      try {
        const r = await load({ ...query, page: n, size: PAGE_SIZE });
        if (id !== req.current) return; // 그 사이 검색 조건이 바뀜
        setItems((prev) => (n === 1 ? r.items : [...prev, ...r.items.filter((i) => !prev.some((p) => p.creator.key === i.creator.key))]));
        setOthers((prev) => (n === 1 ? (r.others ?? []) : [...prev, ...(r.others ?? []).filter((o) => !prev.some((p) => p.url === o.url))]));
        setPage(n);
        setTotalPages(r.totalPages);
        setStatus('ready');
      } catch {
        if (id === req.current) setStatus('error');
      }
    },
    [load, query],
  );
  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery((v) => ({ ...v, q }));
  };

  return (
    <div className="live-tab">
      <form className="live-tab__filters" onSubmit={submit}>
        <input aria-label="라이브 검색" value={q} placeholder="크리에이터 이름" onChange={(e) => setQ(e.target.value)} />
        <select aria-label="정렬" value={query.order} onChange={(e) => setQuery((v) => ({ ...v, order: e.target.value as LiveQuery['order'] }))}>
          <option value="VIEWERS">시청자순</option>
          <option value="STREAM_BEGIN">최신순</option>
        </select>
        <select aria-label="플랫폼" value={query.platform} onChange={(e) => setQuery((v) => ({ ...v, platform: e.target.value as LiveQuery['platform'] }))}>
          <option value="">전체</option>
          <option value="youtube">YouTube</option>
          <option value="twitch">Twitch</option>
          {onPickChzzk && <option value="chzzk">치지직</option>}
        </select>
        <button type="submit" className="btn btn--ghost btn--sm">
          검색
        </button>
      </form>
      {/* 카테고리: 지금 목록에 나온 카테고리 (많은 순), 고르면 그 카테고리만 */}
      <div className="live-tab__categories">
        {query.category ? (
          <button type="button" className="chip chip--small live-tab__category live-tab__category--on" aria-label={`카테고리 ${query.category} 해제`} onClick={() => setQuery((v) => ({ ...v, category: '' }))}>
            {query.category} ✕
          </button>
        ) : (
          topCategories(items).map((c) => (
            <button key={c} type="button" className="chip chip--small live-tab__category" aria-label={`카테고리 ${c}`} onClick={() => setQuery((v) => ({ ...v, category: c }))}>
              {c}
            </button>
          ))
        )}
      </div>
      {status === 'error' && (
        <p className="form-error">
          라이브 목록을 불러오지 못했습니다.
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchPage(page)}>
            다시 시도
          </button>
        </p>
      )}
      {status === 'ready' && items.length === 0 && (!onPickChzzk || others.length === 0) && <p className="muted">지금 라이브 중인 방송이 없습니다.</p>}
      <ul className="live-list">
        {items.map(({ creator: c, thumbnail, category }) => (
          <li key={`${c.key}|${c.donateId}`} className="live-list__row">
            {onToggleFavorite && favoriteTags && (() => {
              const fav = favoriteTags.has(c.donateId);
              return (
                <button
                  type="button"
                  className={`live-item__fav${fav ? ' live-item__fav--on' : ''}`}
                  aria-label={`${c.name} 즐겨찾기 ${fav ? '해제' : '추가'}`}
                  title={fav ? '투네이션 즐겨찾기 해제' : '투네이션 즐겨찾기에 추가'}
                  disabled={busyTag === c.donateId}
                  onClick={async () => {
                    setBusyTag(c.donateId);
                    await onToggleFavorite(c, !fav).catch(() => {});
                    setBusyTag(null);
                  }}
                >
                  {fav ? '♥' : '♡'}
                </button>
              );
            })()}
            <button type="button" className="live-item" onClick={() => onPick(c)}>
              {thumbnail ? <img className="live-item__thumb" src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="live-item__thumb" />}
              <span className="live-item__text">
                <span className="live-item__name">
                  {c.name}
                  <span className="live-tag">LIVE</span>
                </span>
                <span className="live-item__title">{c.live?.title}</span>
                <span className="muted live-item__meta">
                  {PLATFORM_LABEL[c.platform]} · 시청자 {(c.live?.viewers ?? 0).toLocaleString('ko-KR')}
                  {category ? ` · ${category}` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
        {onPickChzzk &&
          others.map((o) => (
            <li key={o.url} className="live-list__row">
              <button type="button" className="live-item" onClick={() => onPickChzzk(o)}>
                {o.thumbnail ? <img className="live-item__thumb" src={o.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="live-item__thumb" />}
                <span className="live-item__text">
                  <span className="live-item__name">
                    {o.name}
                    <span className="live-tag">LIVE</span>
                  </span>
                  <span className="live-item__title">{o.title}</span>
                  <span className="muted live-item__meta">
                    치지직 · 시청자 {o.viewers.toLocaleString('ko-KR')} · 웹페이지 칸으로 열기
                  </span>
                </span>
              </button>
            </li>
          ))}
      </ul>
      {status === 'loading' && <p className="muted">불러오는 중…</p>}
      {status === 'ready' && page < totalPages && (
        <button type="button" className="btn btn--ghost live-tab__more" onClick={() => fetchPage(page + 1)}>
          더 보기
        </button>
      )}
    </div>
  );
}
