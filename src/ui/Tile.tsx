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
  onRemove?(): void; // 불러온 방송을 칸에서 지운다
  slotNumber?: number; // 칸 번호 (1부터): 불러오기 앞(빈 칸은 왼쪽 위)에 작게
  quickPicks?: { creator: Creator; live: boolean | null }[]; // 빈 칸: 최근 본 크리에이터 바로 넣기 (최대 3)
  onQuickPick?(c: Creator): void;
  starting?: boolean; // 트위치가 자동 재생을 시작하는 중: 영상 위 바를 잠깐 숨긴다 (겹치면 트위치가 재생을 막는다)
  onDeleteWindow?(): void;
  onStreamMenu?(x: number, y: number): void; // 방송 칸 오른쪽 클릭 (소리·전체 화면·새 창·창 닫기 메뉴)
  onEmptyMenu?(x: number, y: number): void; // 빈 칸 오른쪽 클릭 (창 추가·창 닫기 메뉴) // 빈 창 삭제 (칸을 빼고 한 단계 작은 레이아웃으로)
  audible?: boolean; // 지금 이 칸 소리가 나는지 (없으면 selected && soundOn)
  onSoundClick?(): void; // 소리 버튼 (없으면 선택된 칸은 소리 켜기/끄기, 아니면 선택)
  volume?: { value: number; onChange(v: number): void }; // 여러 칸 동시 듣기: 칸별 볼륨
  // 페이지 칸(후원 페이지·웹페이지): 위쪽 바가 영상 위에 겹치지 않고 페이지 위에 따로 놓인다. 소리 버튼 없음
  page?: { label: string; onBack?(): void; onReload?(): void; onOpenWindow?(): void; pin?: { name: string | null; onClick(): void } }; // pin: 📌 방송에 고정 (name = 고정한 방송)
  onDetach?(): void; // 이 칸을 새 창으로 분리
  liveInfo?: string; // 방송 정보 한 줄 (시청자 수 · 방송한 시간 · 제목)
  // 새 창으로 분리한 칸: "{이름} · 새 창으로 분리됨"과 되돌리기 · 불러오기(다른 방송 넣기)
  detached?: { name: string; onReturn(): void };
  // 끌어서 자리 옮기기 (포인터 드래그, App의 useTileDrag). 상단 바 어디든(버튼 제외)·⠿를 눌러 끈다
  dnd?: {
    slot: number;
    canDrag: boolean;
    canDrop: boolean; // 지금 끄는 칸을 이 칸에 놓을 수 있는지 (data-drop)
    over: boolean;
    source: boolean; // 지금 끄고 있는 방송의 원래 자리
    onPress(e: PointerEvent): void;
  };
  acceptCard?: boolean; // 추천 라이브·활동 위젯·퀵패널 카드를 끌어 이 칸에 놓을 수 있다 (놓기는 App이 창 전체에서 받는다)
  cardOver?: boolean; // 카드를 이 칸 위로 끌고 있다
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

export function Tile(props: Props) {
  const { creator, selected, soundOn, onSelect, onLoad, onToggleSound, playerSlotRef, onFullscreen, onRemove, dnd } = props;
  const audible = props.audible ?? (selected && soundOn);
  const page = props.page;
  const filled = !!creator || !!page;
  const barButton = (label: string, text: string, fn?: () => void) =>
    fn && (
      <button
        type="button"
        className="sound"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          fn();
        }}
      >
        {text}
      </button>
    );
  return (
    <div
      className={`tile${selected ? ' tile--selected' : ''}${filled ? '' : ' tile--empty'}${props.detached ? ' tile--detached' : ''}${page ? ' tile--page' : ''}${dnd?.over || props.cardOver ? ' tile--drop' : ''}${dnd?.source ? ' tile--drag-source' : ''}${props.starting ? ' tile--starting' : ''}`}
      data-slot={dnd?.slot}
      data-drop={dnd?.canDrop ? '1' : undefined}
      data-card={props.acceptCard ? '1' : undefined}
      onContextMenu={
        !filled && !props.detached && props.onEmptyMenu
          ? (e) => {
              e.preventDefault();
              props.onEmptyMenu!(e.clientX, e.clientY);
            }
          : creator && props.onStreamMenu
            ? (e) => {
                e.preventDefault();
                props.onStreamMenu!(e.clientX, e.clientY);
              }
            : undefined
      }
    >
      {filled && <div className="tile__player" ref={playerSlotRef} />}
      {/* 빈 칸: 점선 영역 안에 불러오기 · 최근 본 크리에이터 바로 넣기 · 끌어 놓기 안내 */}
      {!filled && !props.detached && (
        <div className="tile__empty">
          {props.slotNumber !== undefined && (
            <span className="tile__num tile__num--corner" aria-label={`${props.slotNumber}번 화면`} title={`${props.slotNumber}번 화면`}>
              {props.slotNumber}
            </span>
          )}
          <button type="button" className="tile__load" onClick={onLoad}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            불러오기
          </button>
          {!!props.quickPicks?.length && (
            <div className="tile__picks">
              <span className="tile__picks-label">최근</span>
              {props.quickPicks.slice(0, 3).map(({ creator: c, live }) => (
                <button
                  key={c.key}
                  type="button"
                  className={`tile__pick${live ? ' tile__pick--live' : ''}`}
                  aria-label={`${c.name}${live ? ' · 방송 중' : ''} · 이 칸에 넣기`}
                  title={`${c.name}${live ? ' (방송 중)' : ''} — 이 칸에 넣기`}
                  onClick={() => props.onQuickPick?.(c)}
                >
                  {c.profile ? <img src={c.profile} alt="" referrerPolicy="no-referrer" draggable={false} /> : <span>{c.name.slice(0, 1)}</span>}
                </button>
              ))}
              <button type="button" className="tile__more" onClick={onLoad}>
                더보기
              </button>
            </div>
          )}
          <span className="tile__hint">카드를 끌어 놓아도 돼요</span>
          <span className="tile__drop-text" aria-hidden="true">
            여기에 놓기
          </span>
        </div>
      )}
      {!filled && !props.detached && props.onDeleteWindow && (
        <button
          type="button"
          className="tile__delete"
          aria-label="빈 창 삭제"
          title="이 빈 창 삭제 (레이아웃이 한 단계 작아져요)"
          onClick={(e) => {
            e.stopPropagation();
            props.onDeleteWindow!();
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      {/* 플레이어 iframe은 클릭을 삼키므로 상단 바를 눌러 선택한다 */}
      <div
        className={`tile__bar${filled && dnd?.canDrag ? ' tile__bar--grab' : ''}`}
        onClick={creator ? onSelect : undefined}
        onPointerDown={
          filled && dnd
            ? (e) => {
                if ((e.target as HTMLElement).closest('button')) return; // 버튼은 버튼으로
                dnd.onPress(e);
              }
            : undefined
        }
      >
        {props.detached && <span className="tile__detached-text">{props.detached.name} · 새 창으로 분리됨</span>}
        {props.detached && (
          <button
            type="button"
            className="chip chip--primary"
            onClick={(e) => {
              e.stopPropagation();
              props.detached!.onReturn();
            }}
          >
            되돌리기
          </button>
        )}
        {(filled || props.detached) && props.slotNumber !== undefined && (
          <span className="tile__num" aria-label={`${props.slotNumber}번 화면`} title={`${props.slotNumber}번 화면 (숫자 키 ${props.slotNumber}로 선택)`}>
            {props.slotNumber}
          </span>
        )}
        {(filled || props.detached) && (
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
        {page && (
          <>
            {dnd?.canDrag && (
              <button type="button" className="tile__grip" aria-label="끌어서 자리 옮기기" title="끌어서 다른 칸과 자리 바꾸기" onPointerDown={dnd.onPress} onClick={(e) => e.stopPropagation()}>
                ⠿
              </button>
            )}
            <span className="tile__name">{page.label}</span>
            <span className="tile__bar-gap" />
            {page.pin && (
              <button
                type="button"
                className={`sound tile__pin${page.pin.name ? ' tile__pin--on' : ''}`}
                aria-label={page.pin.name ? `${page.pin.name}에 고정됨 · 바꾸기` : '방송에 고정'}
                aria-pressed={!!page.pin.name}
                title={page.pin.name ? `${page.pin.name} 방송에 고정됨 (누르면 바꾸기·해제)` : '선택한 방송을 따라가는 대신 한 방송에 고정'}
                onClick={(e) => {
                  e.stopPropagation();
                  page.pin!.onClick();
                }}
              >
                📌
              </button>
            )}
            {barButton('뒤로', '←', page.onBack)}
            {barButton('새로고침', '⟳', page.onReload)}
            {barButton('새 창으로 열기', '↗', page.onOpenWindow)}
            {barButton('새 창으로 분리', '⧉', props.onDetach)}
            {barButton('전체 화면', '⛶', onFullscreen)}
            {barButton('칸 비우기', '✕', onRemove)}
          </>
        )}
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
            {props.liveInfo && (
              <span className="tile__live" aria-label="방송 정보" title={props.liveInfo}>
                {props.liveInfo}
              </span>
            )}
            <button
              type="button"
              className={`sound${audible ? ' sound--on' : ''}`}
              aria-label={audible ? '소리 끄기' : '소리 켜기'}
              onClick={(e) => {
                e.stopPropagation();
                if (props.onSoundClick) props.onSoundClick();
                else if (selected) onToggleSound();
                else onSelect();
              }}
            >
              {audible ? '🔊' : '🔇'}
            </button>
            {props.volume && (
              <input
                type="range"
                className="tile__volume"
                aria-label={`${creator.name} 볼륨`}
                min={0}
                max={100}
                value={props.volume.value}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => props.volume!.onChange(Number(e.target.value))}
              />
            )}
            {barButton('새 창으로 분리', '⧉', props.onDetach)}
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
