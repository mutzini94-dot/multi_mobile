import type { Creator } from '../domain/types';

interface Props {
  creator: Creator | null;
  selected: boolean;
  soundOn: boolean;
  onSelect(): void;
  onLoad(): void;
  onToggleSound(): void;
  playerSlotRef?(el: HTMLDivElement | null): void; // 플레이어 레이어(PlayerLayer)가 덮을 자리
  onAddFavorite(): void;
  onFullscreen?(): void;
  onRemove?(): void; // 불러온 방송을 칸에서 지운다
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

export function Tile({ creator, selected, soundOn, onSelect, onLoad, onToggleSound, playerSlotRef, onAddFavorite, onFullscreen, onRemove }: Props) {
  const audible = selected && soundOn;
  return (
    <div className={`tile${selected ? ' tile--selected' : ''}${creator ? '' : ' tile--empty'}`}>
      {creator && <div className="tile__player" ref={playerSlotRef} />}
      {/* 플레이어 iframe은 클릭을 삼키므로 상단 바를 눌러 선택한다 */}
      <div className="tile__bar" onClick={creator ? onSelect : undefined}>
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
        {creator && (
          <>
            <span className="tile__name">{creator.name}</span>
            <span className="tile__platform">{PLATFORM_LABEL[creator.platform]}</span>
            {creator.source === 'link' && (
              <>
                <span className="badge badge--warn">검증되지 않음</span>
                <span className="tile__donate-id">후원 아이디: {creator.donateId}</span>
                <button
                  type="button"
                  className="chip chip--small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddFavorite();
                  }}
                >
                  즐겨찾기에 추가
                </button>
              </>
            )}
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
            {onRemove && (
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
