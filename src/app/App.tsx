import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Creator } from '../domain/types';
import { markConfirmed, needsConfirm } from '../donate/confirmations';
import { donationWarning, openDonationPopup } from '../donate/donation';
import { localFavorites, type FavoritesSource } from '../favorites/favorites';
import type { PlayerHandle } from '../players/types';
import { useAudioFocus } from '../players/useAudioFocus';
import { buildJointUrl, decodeJoint, publicBase } from '../share/jointLink';
import { loadHost, saveHost } from '../host/hostProfile';
import type { CreatorInput } from '../domain/creatorInput';
import { HostProfileDialog } from '../ui/HostProfileDialog';
import { JointShareDialog } from '../ui/JointShareDialog';
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
import { Gnb, type GnbJoint } from '../ui/Gnb';
import { Tile } from '../ui/Tile';
import { TileGrid } from '../ui/TileGrid';
import { playerKeys, visibleCount } from '../layout/layouts';
import { initialViewState, viewReducer } from './viewState';
import { useSettings } from '../settings/settings';
import { SettingsDialog } from '../ui/SettingsDialog';
import { useTileDrag } from './useTileDrag';

type AppWindow = Pick<Window, 'open' | 'screen' | 'location' | 'navigator'>;

interface Props {
  favorites?: FavoritesSource;
  kv?: KV;
  win?: AppWindow;
  bridge?: ToonationBridge;
  desktop?: DesktopApi | null; // 설치형 앱의 window.multiviewDesktop (없으면 웹 방식)
}

const POPUP_POLL_MS = 1000;
const PUBLIC_BASE_KEY = 'mv.publicBase.v1'; // 설치형·로컬에서 합방 URL에 쓸 시청 페이지(배포한 웹) 주소

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
  const [settings, updateSettings] = useSettings(kv);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 테마: 시스템을 따르거나 라이트·다크로 고정
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);
  // 설치형: 창 항상 위
  useEffect(() => {
    desktop?.setAlwaysOnTop?.(settings.alwaysOnTop);
  }, [desktop, settings.alwaysOnTop]);

  // 합방 URL(#j=)로 열렸으면 시청자 화면: 그 구성으로 시작하고, 후원은 항상 호스트에게
  const [boot] = useState(() => {
    const hash = win.location.hash;
    if (hash.startsWith('#s=')) return { joint: null, error: '예전 형식의 합방 링크입니다. 호스트에게 새 URL을 받아 주세요' };
    if (!hash.startsWith('#j=')) return { joint: null, error: null };
    const joint = decodeJoint(hash);
    return { joint, error: joint ? null : '합방 URL이 올바르지 않습니다' };
  });
  const viewer = boot.joint;
  const [state, dispatch] = useReducer(viewReducer, boot.joint?.state ?? initialViewState);
  const [message, setMessage] = useState<string | null>(boot.error);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<Creator | null>(null);
  // 합동 방송 호스트: 호스트 방송은 1번 칸 고정. url은 '방송 시작하기' 순간의 구성으로 고정된 URL
  const [hosting, setHosting] = useState<{ host: Creator; started: boolean; url: string | null } | null>(null);
  const [hostDialog, setHostDialog] = useState<'open' | 'edit' | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [popupCreator, setPopupCreator] = useState<Creator | null>(null);
  const [popupClosed, setPopupClosed] = useState(true);
  const popupRef = useRef<Window | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slotEls = useRef<(HTMLElement | null)[]>([]);
  const [dragging, setDragging] = useState(false); // 칸 경계 크기 조절 중
  // 칸 끌어서 자리 옮기기 (⠿를 눌러 끌고 다른 칸 위에서 놓기)
  // 놓은 직후 제자리로 부드럽게 들어가는 칸들
  const [settling, setSettling] = useState<number[]>([]);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const settle = (slots: number[]) => {
    setSettling(slots);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettling([]), 300);
  };
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  const tileDrag = useTileDrag(
    (from, to) => {
      dispatch({ type: 'swap', from, to });
      settle([from, to]);
    },
    (slot) => dispatch({ type: 'select', slot }), // 짧게 누름 = 그 칸 선택 (그 칸만 소리)
    // 합방 중 1번 호스트 칸 자리에는 놓을 수 없다
    (_from, to) => !((!!viewer || !!hosting) && to === 0),
    (from) => settle([from]), // 취소: 제자리로
  );
  // 전체 화면으로 보는 칸 (보기 방식일 뿐이라 합방 링크에는 담지 않는다)
  const [focused, setFocused] = useState<number | null>(null);
  const focusEl = useRef<HTMLDivElement>(null);

  // 플레이어 핸들: 플레이어 키(방송 기준, layouts.playerKeys)로 보관해 칸 자리를 바꿔도 그대로 쓴다
  const [handles, setHandles] = useState<Record<string, PlayerHandle>>({});
  const keys = useMemo(() => playerKeys(state.slots), [state.slots]);
  const handleList = useMemo(() => keys.map((k) => (k ? handles[k] ?? null : null)), [keys, handles]);
  useAudioFocus(handleList, state.selected, state.soundOn);

  const selectedCreator = state.selected !== null ? state.slots[state.selected] ?? null : null;
  // 후원 대상: 합방 시청 화면에서는 어느 칸을 골랐든 호스트, 그 밖에는 선택한 방송
  const donateTarget = viewer ? viewer.host : selectedCreator;

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
  // 설정 창을 열 때도 로그인 상태를 확인한다 (로그아웃 버튼)
  useEffect(() => {
    if (settingsOpen && toonStatus !== 'waiting-login') refreshToonation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

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
  const focusedCreator = focused !== null && focused < visibleCount(state) ? state.slots[focused] ?? null : null;
  useEffect(() => {
    if (focused !== null && !focusedCreator) exitFullscreen(); // 레이아웃 축소 등으로 칸이 사라짐
  }, [focused, focusedCreator, exitFullscreen]);

  const warning = donationWarning(popupCreator, popupClosed, donateTarget);

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
    if (!donateTarget) return;
    if (needsConfirm(donateTarget, kv)) setConfirming(donateTarget);
    else openPopup(donateTarget);
  };

  // ---------- 합동 방송 (호스트) ----------
  const beginHosting = (host: Creator) => {
    dispatch({ type: 'assign', slot: 0, creator: host });
    setHosting({ host, started: false, url: null });
  };
  const onOpenJoint = () => {
    const host = loadHost(kv);
    if (host) beginHosting(host);
    else setHostDialog('open');
  };
  const onSaveHost = (input: CreatorInput) => {
    const r = saveHost(kv, input);
    if (!r.ok) return r;
    if (hostDialog === 'open') beginHosting(r.value);
    else if (hosting) {
      // 합방 중이면 1번 칸 호스트도 바꾼다 (설정 창에서 수정한 경우는 저장만)
      dispatch({ type: 'assign', slot: 0, creator: r.value });
      setHosting((h) => h && { ...h, host: r.value });
    }
    setHostDialog(null);
    return r;
  };
  const jointUrl = (host: Creator, base: string | null) => (base ? buildJointUrl(host, state, base) : null);
  const currentBase = () => publicBase(win.location.href, kv.get(PUBLIC_BASE_KEY));
  const onStartJoint = () => {
    if (!hosting) return;
    setHosting({ ...hosting, started: true, url: jointUrl(hosting.host, currentBase()) });
    setShareOpen(true);
  };
  const onRegenerateUrl = () => hosting && setHosting({ ...hosting, url: jointUrl(hosting.host, currentBase()) });
  const onApplyBase = (base: string) => {
    if (!/^https?:\/\/[^\s]+$/i.test(base)) return 'http:// 또는 https:// 로 시작하는 주소를 입력해 주세요';
    kv.set(PUBLIC_BASE_KEY, base);
    if (hosting) setHosting({ ...hosting, url: jointUrl(hosting.host, base) });
    return null;
  };
  const exportFavorites = (json: string) => {
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'multiview-favorites.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage('내보내기에 실패했습니다');
    }
  };
  const onCopyUrl = async (url: string) => {
    try {
      await win.navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  };
  const onEndJoint = () => {
    setHosting(null);
    setShareOpen(false);
  };
  const gnbJoint: GnbJoint = viewer
    ? { kind: 'viewer', host: viewer.host, onRestore: () => dispatch({ type: 'replace', state: viewer.state }) }
    : hosting
      ? { kind: 'hosting', started: hosting.started, onEditHost: () => setHostDialog('edit'), onStart: onStartJoint, onShowUrl: () => setShareOpen(true), onEnd: onEndJoint }
      : { kind: 'normal', onOpen: onOpenJoint };

  return (
    <div className={`app${focusedCreator ? ' app--focus' : ''}${tileDrag.drag ? ' app--dragging' : ''}`}>

      <Gnb
        layout={state.layout}
        onLayout={(layout) => dispatch({ type: 'setLayout', layout })}
        canDonate={!!donateTarget}
        onDonate={onDonate}
        joint={gnbJoint}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="app__body">
        <div className={`stage${focusedCreator ? ' stage--focus' : ''}`} ref={stageRef}>
          <TileGrid
            state={state}
            onSizes={(group, sizes) => dispatch({ type: 'setSizes', group, sizes })}
            onDragging={setDragging}
            renderTile={(slot) => {
              const creator = state.slots[slot] ?? null;
              // 호스트 칸(1번)은 합방 중 고정, 합방 시청 화면은 모든 칸 고정
              const hostSlot = (!!viewer || !!hosting) && slot === 0;
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
                  locked={!!viewer || (!!hosting && slot === 0)}
                  badge={hostSlot && creator ? '호스트' : undefined}
                  dnd={{
                    slot,
                    // 합방 중에는 1번 호스트 칸은 고정
                    canDrag: !!creator && !hostSlot,
                    canDrop: tileDrag.drag !== null && tileDrag.drag.from !== slot && !hostSlot,
                    over: tileDrag.drag?.over === slot,
                    source: tileDrag.drag?.from === slot,
                    onPress: (e) => tileDrag.start(slot, e, { canDrag: !!creator && !hostSlot }),
                  }}
                  onFullscreen={creator ? () => enterFullscreen(slot) : undefined}
                  onRemove={
                    creator
                      ? () => {
                          dispatch({ type: 'clear', slot });
                          // 지운 칸의 플레이어 핸들도 버린다
                          const k = keys[slot];
                          setHandles((prev) => Object.fromEntries(Object.entries(prev).filter(([hk]) => hk !== k)));
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
            // 합방 중 호스트 칸(1번)은 눌러도 선택만
            onGrab={(slot, e) => tileDrag.start(slot, e, { canDrag: !((!!viewer || !!hosting) && slot === 0) })}
            stageRef={stageRef}
            slotEls={slotEls}
            dragging={dragging || tileDrag.drag !== null}
            floating={
              tileDrag.drag && state.slots[tileDrag.drag.from]
                ? { slot: tileDrag.drag.from, x: tileDrag.drag.x, y: tileDrag.drag.y, name: state.slots[tileDrag.drag.from]!.name }
                : null
            }
            settling={settling}
            onReady={(key, h) => setHandles((prev) => ({ ...prev, [key]: h }))}
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
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          onChange={updateSettings}
          desktop={!!desktop}
          host={hosting?.host ?? loadHost(kv)}
          onEditHost={() => setHostDialog('edit')}
          publicBase={kv.get(PUBLIC_BASE_KEY) ?? ''}
          onSavePublicBase={onApplyBase}
          toonationAccount={toonation.state.account?.name ?? null}
          onLogout={toonation.logout}
          favorites={favorites}
          onExportFavorites={exportFavorites}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {hostDialog && (
        <HostProfileDialog
          initial={hosting?.host ?? loadHost(kv)}
          submitLabel={hostDialog === 'open' ? '저장하고 개설' : '저장'}
          onSave={onSaveHost}
          onCancel={() => setHostDialog(null)}
        />
      )}
      {shareOpen && hosting && (
        <JointShareDialog
          url={hosting.url}
          onApplyBase={onApplyBase}
          onCopy={onCopyUrl}
          onRegenerate={onRegenerateUrl}
          onClose={() => setShareOpen(false)}
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
