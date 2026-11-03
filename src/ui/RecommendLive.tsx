import { useCallback, useEffect, useState } from 'react';
import type { Creator } from '../domain/types';
import type { LiveItem, LivePage, LiveQuery, PopularLive } from '../toonation/liveList';
import { LiveCard } from './LiveCard';
import { LiveTab } from './LiveTab';

interface Props {
  loadPopular(): Promise<PopularLive>;
  load(q: LiveQuery): Promise<LivePage>;
  onPick(c: Creator): void;
  favoriteTags?: Set<string>;
  onToggleFavorite?(c: Creator, on: boolean): Promise<void>;
}

const GROUP_PREVIEW = 5; // 추천 묶음은 한 줄만, 더보기로 전부

function Section({ title, items, onPick, preview }: { title: string; items: LiveItem[]; onPick(c: Creator): void; preview?: number }) {
  const [all, setAll] = useState(false);
  const shown = preview && !all ? items.slice(0, preview) : items;
  return (
    <section className="recommend-live__section" aria-label={title}>
      <h3>{title}</h3>
      <ul className="live-grid">
        {shown.map((i) => (
          <li key={`${i.creator.key}|${i.creator.donateId}`}>
            <LiveCard item={i} onPick={() => onPick(i.creator)} />
          </li>
        ))}
      </ul>
      {preview && !all && items.length > preview && (
        <button type="button" className="btn btn--ghost btn--sm recommend-live__more" onClick={() => setAll(true)}>
          더보기
        </button>
      )}
    </section>
  );
}

/** 추천 라이브 창 내용: toon.at/donator?live와 같이 인기라이브 · 전체라이브 */
export function RecommendLive({ loadPopular, load, onPick, favoriteTags, onToggleFavorite }: Props) {
  const [tab, setTab] = useState<'popular' | 'all'>('popular');
  const [popular, setPopular] = useState<PopularLive | null>(null);
  const [error, setError] = useState(false);
  const fetchPopular = useCallback(() => {
    setError(false);
    loadPopular().then(setPopular, () => setError(true));
  }, [loadPopular]);
  useEffect(fetchPopular, [fetchPopular]);

  return (
    <div className="recommend-live__body">
      <div className="recommend-live__tabs" role="tablist">
        {(
          [
            ['popular', '인기라이브'],
            ['all', '전체라이브'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="recommend-live__tab" onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'popular' ? (
        <>
          {error && (
            <p className="form-error">
              인기라이브를 불러오지 못했습니다.
              <button type="button" className="btn btn--ghost btn--sm" onClick={fetchPopular}>
                다시 시도
              </button>
            </p>
          )}
          {!popular && !error && <p className="muted">불러오는 중…</p>}
          {popular?.groups.map((g) => <Section key={g.name} title={g.name} items={g.items} onPick={onPick} preview={GROUP_PREVIEW} />)}
          {popular && popular.top.length > 0 && <Section title="LIVE TOP 50" items={popular.top} onPick={onPick} />}
          {popular && popular.groups.length === 0 && popular.top.length === 0 && <p className="muted">지금 라이브 중인 방송이 없습니다.</p>}
        </>
      ) : (
        <LiveTab variant="grid" load={load} onPick={onPick} favoriteTags={favoriteTags} onToggleFavorite={onToggleFavorite} />
      )}
    </div>
  );
}
