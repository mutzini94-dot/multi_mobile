import type { ReactNode } from 'react';
import type { LiveItem } from '../toonation/liveList';

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

/** 라이브 카드 (toon.at/donator?live와 같은 모양): 썸네일 + 시청자 수, 프로필 · 제목 · 이름 */
export function LiveCard({ item, onPick, extra }: { item: LiveItem; onPick(): void; extra?: ReactNode }) {
  const { creator: c, thumbnail } = item;
  return (
    <div className="live-card">
      <button type="button" className="live-card__btn" aria-label={`${c.name} · ${c.live?.title ?? ''}`} onClick={onPick}>
        <span className="live-card__thumb">
          {thumbnail ? <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
          <span className="live-card__badge">
            <span className={`live-card__platform live-card__platform--${c.platform}`} title={PLATFORM_LABEL[c.platform]} aria-hidden="true" />
            시청자 {(c.live?.viewers ?? 0).toLocaleString('ko-KR')}명
          </span>
        </span>
        <span className="live-card__info">
          {c.profile ? <img className="live-card__avatar" src={c.profile} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="live-card__avatar" />}
          <span className="live-card__text">
            <span className="live-card__title">{c.live?.title}</span>
            <span className="live-card__name">{c.name}</span>
          </span>
        </span>
      </button>
      {extra}
    </div>
  );
}
