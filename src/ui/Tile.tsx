import type { Creator } from '../domain/types';

interface Props {
  creator: Creator | null;
  selected: boolean;
  soundOn: boolean;
  onSelect(): void;
  onLoad(): void;
  onToggleSound(): void;
  playerSlotRef?(el: HTMLDivElement | null): void; // 플레이어 레이어(PlayerLayer)가 덮을 자리
  onFullscreen?(): void;
  locked?: boolean; // 호스트 칸·합방 시청 화면: 불러오기·삭제 불가
  badge?: string; // 예: '호스트'
  onRemove?(): void; // 불러온 방송을 칸에서 지운다
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

export function Tile({ creator, selected, soundOn, onSelect, onLoad, onToggleSound, playerSlotRef, onFullscreen, onRemove, locked = false, badge }: Props) {
  const audible = selected && soundOn;
  return (
    <div className={`tile${selected ? ' tile--selected' : ''}${creator ? '' : ' tile--empty'}`}>
      {creator && <div className="tile__player" ref={playerSlotRef} />}
      {/* 플레이어 iframe은 클릭을 삼키므로 상단 바를 눌러 선택한다 */}
      <div className="tile__bar" onClick={creator ? onSelect : undefined}>
        {!locked && (
          <button
            type="button"
            className="chip"
            onClick={(e) => {
              e.stopPropagation();
              onLoad();
            }}
          >
            불러오기
          </button>
        )}
        {locked && !creator && <span className="muted">빈 칸</span>}
        {creator && (
          <>
            <span className="tile__name">{creator.name}</span>
            <span className="tile__platform">{PLATFORM_LABEL[creator.platform]}</span>
            {badge && <span className="badge badge--host">{badge}</span>}
            <button
              type="button"
              className={`sound${audible ? ' sound--on' : ''}`}
              aria-label={audible ? '소리 끄기' : '소리 켜기'}
              onClick={(e) => {
                e.stopPropagation();
                if (selected) onToggleSound();
                else onSelect();
              }}
            >
              {audible ? '🔊' : '🔇'}
            </button>
            {onFullscreen && (
              <button
                type="button"
                className="sound"
                aria-label="전체 화면"
                title="전체 화면"
                onClick={(e) => {
                  e.stopPropagation();
                  onFullscreen();
                }}
              >
                ⛶
              </button>
            )}
            {onRemove && !locked && (
              <button
                type="button"
                className="sound sound--remove"
                aria-label="방송 삭제"
                title="방송 삭제"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                ✕
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
