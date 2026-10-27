import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Creator } from '../domain/types';
import { markConfirmed, needsConfirm } from '../donate/confirmations';
import { donationWarning, openDonationPopup } from '../donate/donation';
import { localFavorites, type FavoritesSource } from '../favorites/favorites';
import type { PlayerHandle } from '../players/types';
import { useAudioFocus } from '../players/useAudioFocus';
import { buildShareUrl, decodeShare } from '../share/shareLink';
import { createBridge, type ToonationBridge } from '../toonation/bridge';
import { desktopBridge, getDesktopApi, type DesktopApi, type DonateMode } from '../desktop/desktopApi';
import { DonateModal } from '../ui/DonateModal';
import { useToonation } from '../toonation/useToonation';
import { ToonationSection } from '../ui/ToonationSection';
import { safeStorage, type KV } from '../storage/safeStorage';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DonationBar } from '../ui/DonationBar';
import { PlayerLayer } from '../ui/PlayerLayer';
import { FavoritesPicker } from '../ui/FavoritesPicker';
import { Gnb } from '../ui/Gnb';
import { Tile } from '../ui/Tile';
import { TileGrid } from '../ui/TileGrid';
import { initialViewState, viewReducer } from './viewState';

type AppWindow = Pick<Window, 'open' | 'screen' | 'location' | 'navigator'>;

interface Props {
  favorites?: FavoritesSource;
  kv?: KV;
  win?: AppWindow;
  bridge?: ToonationBridge;
  desktop?: DesktopApi | null; // 설치형 앱의 window.multiviewDesktop (없으면 웹 방식)
}

const POPUP_POLL_MS = 1000;

function readStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function App(props: Props) {
  const win = props.win ?? window;
  const kv = useMemo(() => props.kv ?? safeStorage(readStorage()), [props.kv]);
  const favorites = useMemo(() => props.favorites ?? localFavorites(kv), [props.favorites, kv]);
  const desktop = useMemo(() => (props.desktop !== undefined ? props.desktop : getDesktopApi(window)), [props.desktop]);
  const bridge = useMemo(
    () => props.bridge ?? (desktop ? desktopBridge(desktop) : createBridge(window)),
    [props.bridge, desktop],
  );
  const toonation = useToonation(bridge);

  // 합방 링크로 열렸으면 그 구성으로 시작하고, 원래 구성을 보관한다
  const [boot] = useState(() => {
    const hash = win.location.hash;
    if (!hash.startsWith('#s=')) return { shared: null, error: null };
    const shared = decodeShare(hash);
    return { shared, error: shared ? null : '링크가 올바르지 않습니다' };
  });
  const [state, dispatch] = useReducer(viewReducer, boot.shared ?? initialViewState);
  const [message, setMessage] = useState<string | null>(boot.error);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<Creator | null>(null);
  const [confirmingFavorite, setConfirmingFavorite] = useState<Creator | null>(null);
  const [popupCreator, setPopupCreator] = useState<Creator | null>(null);
  const [popupClosed, setPopupClosed] = useState(true);
  const popupRef = useRef<Window | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slotEls = useRef<(HTMLElement | null)[]>([]);
  const [dragging, setDragging] = useState(false);
  // 전체 화면으로 보는 칸 (보기 방식일 뿐이라 합방 링크에는 담지 않는다)
  const [focused, setFocused] = useState<number | null>(null);
  const focusEl = useRef<HTMLDivElement>(null);

  // 플레이어 핸들: 칸 번호 + 크리에이터 키로 구분해, 칸 내용이 바뀌면 이전 핸들을 버린다
  const [handles, setHandles] = useState<Record<string, PlayerHandle>>({});
  const handleKey = (slot: number, c: Creator) => `${slot}:${c.key}`;
  const handleList = useMemo(
    () => state.slots.map((c, i) => (c ? handles[handleKey(i, c)] ?? null : null)),
    [state.slots, handles],
  );
  useAudioFocus(handleList, state.selected, state.soundOn);

  const selectedCreator = state.selected !== null ? state.slots[state.selected] ?? null : null;

  // 사용자가 팝업을 직접 닫았는지 주기적으로 확인한다 (설치형은 앱이 닫힘을 알려준다)
  // 설치형 후원창 자리 (모달/PIP). 앱이 바꾸면(PIP 창의 '모달로' 등) 알려준다
  const [donateMode, setDonateMode] = useState<DonateMode>('modal');
  useEffect(() => {
    if (!desktop) return;
    const offClosed = desktop.onDonateClosed(() => setPopupClosed(true));
    const offMode = desktop.onDonateMode(setDonateMode);
    return () => {
      offClosed();
      offMode();
    };
  }, [desktop]);
  useEffect(() => {
    if (!popupCreator || desktop) return;
    const id = setInterval(() => setPopupClosed(!popupRef.current || popupRef.current.closed), POPUP_POLL_MS);
    return () => clearInterval(id);
  }, [popupCreator, desktop]);

  // 불러오기 창을 열 때 투네이션 즐겨찾기를 (아직 없으면) 불러온다
  const { refresh: refreshToonation } = toonation;
  const toonStatus = toonation.state.status;
  useEffect(() => {
    // 열 때마다 새로 가져와 라이브 상태를 갱신한다 (로그인 대기 중에는 그 확인을 방해하지 않는다)
    if (pickerSlot !== null && toonStatus !== 'waiting-login') refreshToonation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerSlot]);

  const enterFullscreen = (slot: number) => {
    dispatch({ type: 'select', slot });
    setFocused(slot);
    // 브라우저(설치형은 창) 전체 화면도 함께. 지원하지 않거나 거부되면 앱 안에서만 크게 본다
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const exitFullscreen = useCallback(() => {
    setFocused(null);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);
  useEffect(() => {
    if (focused === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && exitFullscreen();
    // 브라우저 전체 화면을 Esc로 빠져나오면 keydown 대신 fullscreenchange만 온다
    const onChange = () => !document.fullscreenElement && setFocused(null);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, [focused, exitFullscreen]);
  const focusedCreator = focused !== null ? state.slots[focused] ?? null : null;
  useEffect(() => {
    if (focused !== null && !focusedCreator) exitFullscreen(); // 레이아웃 축소 등으로 칸이 사라짐
  }, [focused, focusedCreator, exitFullscreen]);

  const warning = donationWarning(popupCreator, popupClosed, selectedCreator);

  const openPopup = useCallback(
    (c: Creator) => {
      if (desktop) {
        // 설치형: 창 오른쪽 후원 패널 (로그인한 세션으로 열린다)
        desktop.openDonate({ tag: c.donateId, name: c.name });
        setPopupCreator(c);
        setPopupClosed(false);
        setMessage(null);
        return;
      }
      const popup = openDonationPopup(c, win);
      if (!popup) {
        setMessage('팝업이 차단되었습니다. 팝업을 허용해 주세요');
        return;
      }
      popupRef.current = popup;
      setPopupCreator(c);
      setPopupClosed(false);
      setMessage(null);
    },
    [win, desktop],
  );
  const desktopDonate = desktop && popupCreator && !popupClosed ? popupCreator : null;
  const closeDesktopDonate = useCallback(() => {
    desktop?.closeDonate();
    setPopupClosed(true);
  }, [desktop]);
  useEffect(() => {
    if (!desktopDonate || donateMode !== 'modal') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDesktopDonate();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktopDonate, donateMode, closeDesktopDonate]);

  const onDonate = () => {
    if (!selectedCreator) return;
    if (needsConfirm(selectedCreator, kv)) setConfirming(selectedCreator);
    else openPopup(selectedCreator);
  };

  const onShare = async () => {
    const url = buildShareUrl(state, win.location.href);
    try {
      await win.navigator.clipboard.writeText(url);
      setMessage('합방 링크를 복사했습니다');
    } catch {
      setMessage(`복사하지 못했습니다. 아래 링크를 직접 복사하세요: ${url}`);
    }
  };

  return (
    <div className={`app${focusedCreator ? ' app--focus' : ''}`}>
      <Gnb
        layout={state.layout}
        onLayout={(layout) => dispatch({ type: 'setLayout', layout })}
        canDonate={!!selectedCreator}
        onDonate={onDonate}
        onShare={onShare}
        sharedMode={!!boot.shared}
        onRestore={() => boot.shared && dispatch({ type: 'replace', state: boot.shared })}
      />
      <div className="app__body">
        <div className={`stage${focusedCreator ? ' stage--focus' : ''}`} ref={stageRef}>
          <TileGrid
            state={state}
            onSizes={(group, sizes) => dispatch({ type: 'setSizes', group, sizes })}
            onDragging={setDragging}
            renderTile={(slot) => {
              const creator = state.slots[slot] ?? null;
              return (
                <Tile
                  creator={creator}
                  selected={state.selected === slot}
                  soundOn={state.soundOn}
                  onSelect={() => dispatch({ type: 'select', slot })}
                  onLoad={() => setPickerSlot(slot)}
                  onToggleSound={() => dispatch({ type: 'toggleSound' })}
                  playerSlotRef={(el) => {
                    slotEls.current[slot] = el;
                  }}
                  onAddFavorite={() => creator && setConfirmingFavorite(creator)}
                  onFullscreen={creator ? () => enterFullscreen(slot) : undefined}
                  onRemove={
                    creator
                      ? () => {
                          dispatch({ type: 'clear', slot });
                          // 지운 칸의 플레이어 핸들도 버린다
                          setHandles((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`${slot}:`))));
                        }
                      : undefined
                  }
                />
              );
            }}
          />
          {focusedCreator && (
            <section className="focus-view" aria-label={`${focusedCreator.name} 전체 화면`}>
              <div className="focus-view__player" ref={focusEl} />
              <div className="tile__bar focus-view__bar">
                <span className="tile__name">{focusedCreator.name}</span>
                <button
                  type="button"
                  className={`sound${state.soundOn ? ' sound--on' : ''}`}
                  aria-label={state.soundOn ? '소리 끄기' : '소리 켜기'}
                  onClick={() => dispatch({ type: 'toggleSound' })}
                >
                  {state.soundOn ? '🔊' : '🔇'}
                </button>
                <button type="button" className="btn btn--donate" onClick={onDonate}>
                  후원하기
                </button>
                <button type="button" className="btn btn--ghost" aria-label="전체 화면 종료" onClick={exitFullscreen}>
                  전체 화면 종료 (Esc)
                </button>
              </div>
            </section>
          )}
          <PlayerLayer
            state={state}
            focused={focusedCreator ? focused : null}
            focusEl={focusEl}
            onSelectSlot={(slot) => dispatch({ type: 'select', slot })}
            stageRef={stageRef}
            slotEls={slotEls}
            dragging={dragging}
            onReady={(slot, creator, h) => setHandles((prev) => ({ ...prev, [handleKey(slot, creator)]: h }))}
          />
        </div>
      </div>
      <DonationBar popupCreator={popupClosed || desktopDonate ? null : popupCreator} warning={warning} message={message}>
        {desktopDonate && donateMode === 'pip' && (
          <span className="pip-status" role="status" aria-label="PIP 후원창">
            <span className="pip-status__text">PIP 창에서 후원 중: {desktopDonate.name}</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => desktop?.setDonateMode('modal')}>
              모달로 보기
            </button>
            <button type="button" className="btn btn--icon" aria-label="후원창 닫기" onClick={closeDesktopDonate}>
              ✕
            </button>
          </span>
        )}
      </DonationBar>
      {desktopDonate && donateMode === 'modal' && (
        <DonateModal
          creator={desktopDonate}
          onBounds={(r) => desktop?.setDonateBounds(r)}
          onPip={() => desktop?.setDonateMode('pip')}
          onClose={closeDesktopDonate}
        />
      )}
      {pickerSlot !== null && (
        <FavoritesPicker
          source={favorites}
          onClose={() => setPickerSlot(null)}
          onPick={(creator) => {
            dispatch({ type: 'assign', slot: pickerSlot, creator });
            setPickerSlot(null);
          }}
        >
          <ToonationSection
            state={toonation.state}
            onLogin={toonation.login}
            onRefresh={toonation.refresh}
            onPick={(creator) => {
              dispatch({ type: 'assign', slot: pickerSlot, creator });
              setPickerSlot(null);
            }}
          />
        </FavoritesPicker>
      )}
      {confirmingFavorite && (
        // 링크로 받은 (채널, 후원 아이디) 짝은 즐겨찾기에 넣기 전에도 확인한다 (확인 없이 '직접 입력'으로 바뀌는 것을 막음)
        <ConfirmDialog
          creator={confirmingFavorite}
          action="favorite"
          replacingDonateId={
            favorites.list().find((f) => f.key === confirmingFavorite.key && f.donateId !== confirmingFavorite.donateId)?.donateId
          }
          onCancel={() => setConfirmingFavorite(null)}
          onConfirm={() => {
            favorites.add(confirmingFavorite);
            markConfirmed(confirmingFavorite, kv);
            setMessage(`${confirmingFavorite.name}을(를) 즐겨찾기에 추가했습니다`);
            setConfirmingFavorite(null);
          }}
        />
      )}
      {confirming && (
        <ConfirmDialog
          creator={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            markConfirmed(confirming, kv);
            setConfirming(null);
            openPopup(confirming);
          }}
        />
      )}
    </div>
  );
}
