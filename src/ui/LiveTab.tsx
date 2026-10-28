import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Creator } from '../domain/types';
import type { LiveItem, LivePage, LiveQuery } from '../toonation/liveList';

interface Props {
  load(q: LiveQuery): Promise<LivePage>;
  onPick(c: Creator): void;
}

const PAGE_SIZE = 20;
const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

/** 불러오기 창 '투네이션 라이브' 탭: toon.at/donator?live 목록에서 골라 칸에 넣는다 */
export function LiveTab({ load, onPick }: Props) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState<Omit<LiveQuery, 'page' | 'size'>>({ q: '', order: 'VIEWERS', platform: '' });
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
        </select>
        <button type="submit" className="btn btn--ghost btn--sm">
          검색
        </button>
      </form>
      {status === 'error' && (
        <p className="form-error">
          라이브 목록을 불러오지 못했습니다.
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchPage(page)}>
            다시 시도
          </button>
        </p>
      )}
      {status === 'ready' && items.length === 0 && <p className="muted">지금 라이브 중인 방송이 없습니다.</p>}
      <ul className="live-list">
        {items.map(({ creator: c, thumbnail, category }) => (
          <li key={`${c.key}|${c.donateId}`}>
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
