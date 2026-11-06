import { useCallback, useEffect, useRef, useState } from 'react';
import type { Creator } from '../domain/types';
import { StreamPlayer } from '../players/StreamPlayer';
import type { PlayerHandle } from '../players/types';
import type { LiveItem, LivePage, LiveQuery } from '../toonation/liveList';
import { startCreatorDrag } from '../app/creatorDrag';

interface Props {
  load(q: LiveQuery): Promise<LivePage>;
  onAdd(c: Creator): void; // 칸에 넣기 (넣을 칸 고르기)
  onDonate(c: Creator): void;
  onClose(): void;
}

const PAGE_SIZE = 20;
const PRELOAD = 3; // 끝에서 이만큼 남으면 다음 쪽을 불러온다

/** 퀵패널 '추천 라이브 탐색': 시청자 많은 순 라이브를 유튜브 쇼츠처럼 한 개씩 위아래로 넘겨 본다 (보이는 방송만 재생) */
export function ShortsFeed({ load, onAdd, onDonate, onClose }: Props) {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const pageRef = useRef({ page: 0, totalPages: 1, busy: false });
  const scroller = useRef<HTMLDivElement>(null);
  const handle = useRef<PlayerHandle | null>(null);
  const activeRef = useRef(0);
  activeRef.current = active;

  // 창 크기가 바뀌면(추천 라이브 창 크기 조절) 한 칸의 높이가 바뀌어 스크롤 위치가 다른 방송을 가리키게 된다.
  // 보던 방송 자리로 바로 맞춰, 다른 방송으로 넘어가며 영상이 다시 불러와지지 않게 한다
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastH = el.clientHeight;
    const ro = new ResizeObserver(() => {
      const h = el.clientHeight;
      if (!h || h === lastH) return;
      lastH = h;
      el.scrollTop = activeRef.current * h;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadMore = useCallback(() => {
    const p = pageRef.current;
    if (p.busy || p.page >= p.totalPages) return;
    p.busy = true;
    load({ q: '', order: 'VIEWERS', platform: '', page: p.page + 1, size: PAGE_SIZE }).then(
      (r) => {
        p.page = r.page;
        p.totalPages = r.totalPages;
        p.busy = false;
        setItems((prev) => [...prev, ...r.items.filter((i) => !prev.some((x) => x.creator.key === i.creator.key))]);
        setStatus('ready');
      },
      () => {
        p.busy = false;
        setStatus('error');
      },
    );
  }, [load]);
  useEffect(loadMore, [loadMore]);
  useEffect(() => {
    if (items.length && active >= items.length - PRELOAD) loadMore();
  }, [active, items.length, loadMore]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !el.clientHeight) return;
    setActive(Math.max(0, Math.round(el.scrollTop / el.clientHeight)));
  };
  const step = (dir: 1 | -1) => scroller.current?.scrollBy({ top: dir * (scroller.current.clientHeight || 0), behavior: 'smooth' });
  const onReady = useCallback(
    (h: PlayerHandle) => {
      handle.current = h;
      h.setMuted(muted);
    },
    // 소리는 아래 버튼이 직접 바꾼다 (재생기를 다시 만들지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    handle.current?.setMuted(next);
  };

  return (
    <section className="shorts" aria-label="추천 라이브 탐색">
      <div className="shorts__head">
        <span className="shorts__badge" aria-hidden="true">LIVE</span>
        <strong>추천 라이브</strong>
        <span className="muted">위아래로 넘겨 보기</span>
        <button type="button" className="btn btn--icon" aria-label="닫기" onClick={onClose}>
          ✕
        </button>
      </div>
      <div
        className="shorts__scroller"
        ref={scroller}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            e.preventDefault();
            step(1);
          } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            step(-1);
          }
        }}
      >
        {status === 'error' && items.length === 0 && <p className="form-error shorts__msg">라이브 목록을 불러오지 못했습니다.</p>}
        {status === 'loading' && items.length === 0 && <p className="muted shorts__msg">불러오는 중…</p>}
        {items.map(({ creator: c, thumbnail }, i) => (
          <article key={c.key} className="shorts__item" draggable onDragStart={(e) => startCreatorDrag(e.dataTransfer, c)}>
            <div className="shorts__video">
              {i === active ? (
                // 보이는 방송만 재생 (key로 방송이 바뀌면 새로 띄운다)
                <StreamPlayer key={c.key} creator={c} onReady={onReady} />
              ) : thumbnail ? (
                <img className="shorts__thumb" src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} />
              ) : null}
            </div>
            <div className="shorts__info">
              {c.profile ? <img className="shorts__avatar" src={c.profile} alt="" referrerPolicy="no-referrer" draggable={false} /> : <span className="shorts__avatar" />}
              <div className="shorts__text">
                <strong className="shorts__name">{c.name}</strong>
                <span className="shorts__title">{c.live?.title}</span>
                <span className="shorts__viewers">
                  <span className="shorts__live">LIVE</span>시청자 {(c.live?.viewers ?? 0).toLocaleString('ko-KR')}명
                </span>
              </div>
            </div>
            <div className="shorts__actions">
              {i === active && (
                <button type="button" className="shorts__action" aria-label={muted ? '소리 켜기' : '소리 끄기'} onClick={toggleSound}>
                  {muted ? '🔇' : '🔊'}
                </button>
              )}
              <button type="button" className="shorts__action" aria-label={`${c.name} 칸에 넣기`} title="칸에 넣기 (끌어서 칸에 놓아도 됩니다)" onClick={() => onAdd(c)}>
                ＋
              </button>
              <button type="button" className="shorts__action shorts__action--donate" aria-label={`${c.name} 후원하기`} title="후원하기" onClick={() => onDonate(c)}>
                💝
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
