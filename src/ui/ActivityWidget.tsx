import type { Creator } from '../domain/types';
import type { LiveTarget } from '../activity/liveTargets';
import { timeLabel, type TimelineItem } from '../activity/timeline';
import { formatElapsed } from '../toonation/tileLive';

interface Props {
  loggedIn: boolean;
  live: LiveTarget[] | null; // null = 불러오는 중
  timeline: TimelineItem[];
  isLive(key: string): boolean | null; // 시청 기록의 LIVE·종료 (null = 모름)
  now: number;
  onOpen(c: Creator): void; // 방송을 첫 번째 칸에
  onLogin(): void;
}

function Avatar({ c }: { c: Creator }) {
  return c.profile ? <img className="activity__avatar" src={c.profile} alt="" /> : <span className="activity__avatar">{c.name.slice(0, 1)}</span>;
}

/** 활동 위젯 칸: 위에는 즐겨찾기·후원 크리에이터 중 지금 라이브, 아래에는 시청·후원·설정 변경 타임라인 */
export function ActivityWidget({ loggedIn, live, timeline, isLive, now, onOpen, onLogin }: Props) {
  return (
    <div className="activity">
      <section className="activity__section">
        {!loggedIn ? (
          <div className="activity__notice">
            <p>투네이션에 로그인하면 즐겨찾기·후원한 크리에이터의 라이브를 볼 수 있습니다</p>
            <button type="button" className="btn btn--donate btn--sm" onClick={onLogin}>
              로그인
            </button>
          </div>
        ) : live === null ? (
          <p className="muted">불러오는 중…</p>
        ) : (
          <>
            <h3 className="activity__title">지금 라이브 · {live.length}</h3>
            {live.length === 0 ? (
              <p className="muted">지금 방송 중인 즐겨찾기·후원 크리에이터가 없습니다</p>
            ) : (
              <ul className="activity__live" aria-label="지금 라이브">
                {live.map(({ creator: c, reason }) => (
                  <li key={c.key}>
                    <button type="button" className="activity__live-item" onClick={() => onOpen(c)}>
                      <Avatar c={c} />
                      <span className="activity__live-main">
                        <span className="activity__name">
                          {c.name} <span className="activity__badge-live">LIVE</span>
                        </span>
                        <span className="activity__meta">
                          {[c.live?.title, `${(c.live?.viewers ?? 0).toLocaleString('ko-KR')}명`, c.live?.startedAt ? formatElapsed(now - c.live.startedAt) : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="activity__why">{reason.kind === 'favorite' ? '즐겨찾기' : `후원 ${reason.count}회`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      <section className="activity__section">
        <h3 className="activity__title">최근 활동</h3>
        {timeline.length === 0 ? (
          <p className="muted">아직 활동 기록이 없습니다</p>
        ) : (
          <ul className="activity__timeline" aria-label="최근 활동">
            {timeline.map((i) => {
              const time = <span className="activity__time">{timeLabel(i.at, now)}</span>;
              if (i.kind !== 'watch')
                return (
                  <li key={`${i.kind}:${i.at}:${i.kind === 'donation' ? i.name : i.text}`} className="activity__row">
                    {time}
                    <span className="activity__icon" aria-hidden="true">
                      {i.kind === 'donation' ? '💝' : '⚙'}
                    </span>
                    <span className="activity__text">{i.kind === 'donation' ? `${i.name}에게 ${i.cash.toLocaleString('ko-KR')}캐시 후원` : i.text}</span>
                  </li>
                );
              const on = isLive(i.creator.key);
              return (
                <li key={`watch:${i.at}:${i.creator.key}`} className="activity__row">
                  <button type="button" className="activity__row-btn" onClick={() => onOpen(i.creator)}>
                    {time}
                    <span className="activity__icon" aria-hidden="true">
                      ▶
                    </span>
                    <span className="activity__text">{i.creator.name} 시청</span>
                    {on !== null && <span className={on ? 'activity__badge-live' : 'activity__badge-off'}>{on ? 'LIVE' : '종료'}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
