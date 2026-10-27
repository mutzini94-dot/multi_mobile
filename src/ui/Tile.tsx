import type { PointerEvent } from 'react';
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
  // 끌어서 자리 옮기기 (포인터 드래그, App의 useTileDrag). 상단 바 어디든(버튼 제외)·⠿를 눌러 끈다
  dnd?: {
    slot: number;
    canDrag: boolean;
    canDrop: boolean; // 지금 끄는 칸을 이 칸에 놓을 수 있는지 (data-drop)
    over: boolean;
    source: boolean; // 지금 끄고 있는 방송의 원래 자리
    onPress(e: PointerEvent): void;
  };
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

export function Tile({ creator, selected, soundOn, onSelect, onLoad, onToggleSound, playerSlotRef, onFullscreen, onRemove, locked = false, badge, dnd }: Props) {
  const audible = selected && soundOn;
  return (
    <div
      className={`tile${selected ? ' tile--selected' : ''}${creator ? '' : ' tile--empty'}${locked ? ' tile--locked' : ''}${dnd?.over ? ' tile--drop' : ''}${dnd?.source ? ' tile--drag-source' : ''}`}
      data-slot={dnd?.slot}
      data-drop={dnd?.canDrop ? '1' : undefined}
    >
      {creator && <div className="tile__player" ref={playerSlotRef} />}
      {/* 플레이어 iframe은 클릭을 삼키므로 상단 바를 눌러 선택한다 */}
      <div
        className={`tile__bar${creator && dnd?.canDrag ? ' tile__bar--grab' : ''}`}
        onClick={creator ? onSelect : undefined}
        onPointerDown={
          creator && dnd
            ? (e) => {
                if ((e.target as HTMLElement).closest('button')) return; // 버튼은 버튼으로
                dnd.onPress(e);
              }
            : undefined
        }
      >
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
            {dnd?.canDrag && (
              <button
                type="button"
                className="tile__grip"
                aria-label="끌어서 자리 옮기기"
                title="끌어서 다른 칸과 자리 바꾸기"
                onPointerDown={dnd.onPress}
                onClick={(e) => e.stopPropagation()}
              >
                ⠿
              </button>
            )}
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
