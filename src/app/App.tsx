import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Creator, PageSlot, SlotItem, ViewState } from '../domain/types';
import { desktopDetachHost, webDetachHost, type DetachHost } from '../detach/channel';
import { chatUrl, donatePageUrl, followDonateCreator, isPage, isStream } from '../domain/pages';
import { fetchLiveList, type LivePage, type LiveQuery } from '../toonation/liveList';
import { PageView, type PageHandle } from '../ui/PageView';
import { ChatPageTab, DonatePageTab, WebPageTab } from '../ui/PageTabs';
import { LiveTab } from '../ui/LiveTab';
import { markConfirmed, needsConfirm } from '../donate/confirmations';
import { donationWarning, openDonationPopup } from '../donate/donation';
import { localFavorites, type FavoritesSource } from '../favorites/favorites';
import type { PlayerHandle, StreamStatus } from '../players/types';
import { useAudioMix } from '../players/useAudioFocus';
import { usePlaybackPolicy } from '../players/usePlaybackPolicy';
import { buildJointUrl, decodeJoint, publicBase } from '../share/jointLink';
import { loadHost, saveHost } from '../host/hostProfile';
import type { CreatorInput } from '../domain/creatorInput';
import { HostProfileDialog } from '../ui/HostProfileDialog';
import { JointShareDialog } from '../ui/JointShareDialog';
import { createBridge, type ToonationBridge } from '../toonation/bridge';
import { desktopBridge, getDesktopApi, type DesktopApi, type DonateMode } from '../desktop/desktopApi';
import { DonateModal } from '../ui/DonateModal';
import { useToonation } from '../toonation/useToonation';
import { showLiveNotification, useLiveWatch } from '../toonation/liveWatch';
import { ToonationSection } from '../ui/ToonationSection';
import { safeStorage, type KV } from '../storage/safeStorage';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DonationBar } from '../ui/DonationBar';
import { PlayerLayer } from '../ui/PlayerLayer';
import { FavoritesPicker } from '../ui/FavoritesPicker';
import { Gnb, type GnbJoint } from '../ui/Gnb';
import { Tile } from '../ui/Tile';
import { TileGrid } from '../ui/TileGrid';
import { playerKeys, visibleCount, visibleSlots } from '../layout/layouts';
import { initialViewState, viewReducer } from './viewState';
import { loadLastView, saveLastView } from './lastView';
import { applyLayout } from '../layout/layouts';
import { useSettings } from '../settings/settings';
import { SettingsDialog } from '../ui/SettingsDialog';
import { PresetsDialog } from '../ui/PresetsDialog';
import { HistoryDialog } from '../ui/HistoryDialog';
import { monthTotal, type DonationRecord } from '../toonation/history';
import { useTileDrag } from './useTileDrag';

type AppWindow = Pick<Window, 'open' | 'screen' | 'location' | 'navigator'>;

interface Props {
  favorites?: FavoritesSource;
  kv?: KV;
  win?: AppWindow;
  bridge?: ToonationBridge;
  desktop?: DesktopApi | null; // 설치형 앱의 window.multiviewDesktop (없으면 웹 방식)
  lives?: (q: LiveQuery) => Promise<LivePage>; // 투네이션 라이브 목록 (테스트에서 바꿔 끼움)
  detachHost?: DetachHost; // 칸 분리 창 통로 (테스트에서 바꿔 끼움)
}

/** 분리 창에 가 있는 칸 내용 */
interface Detached {
  id: string;
  item: SlotItem;
}

const detachedId = (item: SlotItem | null | undefined) => (item && !isStream(item) && item.kind === 'detached' ? item.id : null);

/** 저장용: 분리 표시 칸은 분리 창에 가 있는 원래 내용으로 (다음 실행에서는 칸 안에서 연다) */
function withDetachedItems(state: ViewState, detached: Detached[]): ViewState {
  return { ...state, slots: state.slots.map((s) => (detachedId(s) ? detached.find((d) => d.id === detachedId(s))?.item ?? null : s)) };
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
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [limitAsk, setLimitAsk] = useState<{ creator: Creator; total: number } | null>(null);

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
  // 시작 화면: 합방 URL > 마지막 화면 복원(설정) > 기본 레이아웃(설정)
  const [state, dispatch] = useReducer(
    viewReducer,
    null,
    () =>
      boot.joint?.state ??
      (settings.restoreLastView ? loadLastView(kv) : null) ??
      applyLayout(initialViewState, settings.defaultLayout),
  );
  // 새 창으로 분리한 칸들 (칸에는 분리 표시만 남는다)
  const [detached, setDetached] = useState<Detached[]>([]);
  // 화면이 바뀔 때마다 저장 (합방 시청 화면은 남의 구성이라 저장하지 않는다)
  useEffect(() => {
    if (!viewer) saveLastView(kv, withDetachedItems(state, detached));
  }, [kv, state, viewer, detached]);
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
  // 소리·재생 (설정: 소리 방식·기본 볼륨·숨긴 칸 재생·낮은 화질)
  const [mixMuted, setMixMuted] = useState<Record<string, boolean>>({}); // 여러 칸 동시 듣기: 칸별로 끈 소리
  const [tileVolumes, setTileVolumes] = useState<Record<string, number>>({}); // 여러 칸 동시 듣기: 칸별 볼륨
  const shown = visibleCount(state);
  const mix = settings.soundMode === 'mix';
  const audible = keys.map((k, i) => !!k && i < shown && state.soundOn && (mix ? !mixMuted[k] : i === state.selected));
  const volumes = keys.map((k) => (k && mix ? tileVolumes[k] ?? settings.masterVolume : settings.masterVolume));
  useAudioMix(handleList, audible, volumes);
  usePlaybackPolicy(
    handleList,
    keys.map((_, i) => settings.hiddenSlotPlayback === 'pause' && i >= shown),
    keys.map((_, i) => settings.lowQualityOthers && i !== state.selected),
  );

  const selectedItem = state.selected !== null ? state.slots[state.selected] ?? null : null;
  const selectedCreator = isStream(selectedItem) ? selectedItem : null;
  const stateRef = useRef(state);
  stateRef.current = state;
  // 후원 대상: 합방 시청 화면에서는 어느 칸을 골랐든 호스트, 그 밖에는 선택한 방송
  const donateTarget = viewer ? viewer.host : selectedCreator;
  // 후원 페이지 칸이 따라가는 크리에이터: 선택한 방송 (선택이 풀리면 마지막으로 따라간 방송)
  const [lastFollowed, setLastFollowed] = useState<Creator | null>(null);
  const detachHost = useMemo(
    () => props.detachHost ?? (desktop ? desktopDetachHost(desktop, () => window.location.href) : webDetachHost(window)),
    [props.detachHost, desktop],
  );
  const donateFor = viewer ? viewer.host : followDonateCreator(state, lastFollowed);
  useEffect(() => {
    if (donateFor !== lastFollowed) setLastFollowed(donateFor);
  }, [donateFor, lastFollowed]);
  // 페이지 칸의 뒤로·새로고침 (플레이어 키로 보관)
  const pageHandles = useRef<Record<string, PageHandle>>({});
  const embed = desktop ? 'webview' : 'iframe';
  // 채팅 칸: 유튜브는 라이브 영상 ID로만 채팅을 열 수 있다. 라이브 목록에서 고른 방송은 이미 알고,
  // 채널로 넣은 방송은 플레이어가 재생을 시작한 뒤 알려 주므로 채팅 칸이 있는 동안 잠깐씩 물어본다
  const [ytLive, setYtLive] = useState<Record<string, string>>({});
  const hasChat = state.slots.some((s) => isPage(s) && s.kind === 'chat') || detached.some((d) => isPage(d.item) && d.item.kind === 'chat');
  const chatVideoId = donateFor?.platform === 'youtube' ? (donateFor.videoId ?? ytLive[donateFor.key] ?? null) : null;
  useEffect(() => {
    if (!hasChat || !donateFor || donateFor.platform !== 'youtube' || chatVideoId) return;
    const read = () => {
      const slot = stateRef.current.slots.findIndex((s) => isStream(s) && s.key === donateFor.key);
      const k = slot >= 0 ? keys[slot] : null;
      const id = k ? handles[k]?.videoId?.() : null;
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) setYtLive((m) => (m[donateFor.key] === id ? m : { ...m, [donateFor.key]: id }));
    };
    read();
    const t = setInterval(read, 2000);
    return () => clearInterval(t);
  }, [hasChat, donateFor, chatVideoId, keys, handles]);
  // 분리 창에 가 있는 후원 페이지·채팅도 따라갈 방송을 알려 준다
  useEffect(() => {
    for (const d of detached)
      if (isPage(d.item) && (d.item.kind === 'donate' || d.item.kind === 'chat')) detachHost.post(d.id, { type: 'donateFor', creator: donateFor, videoId: chatVideoId });
  }, [donateFor, chatVideoId, detached, detachHost]);
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const pageUrl = (page: PageSlot) =>
    page.kind === 'web' ? page.url : !donateFor ? null : page.kind === 'donate' ? donatePageUrl(donateFor) : chatUrl(donateFor, chatVideoId, embed, host);
  const pageEmptyText = (page: PageSlot) =>
    page.kind !== 'chat'
      ? '후원할 방송 칸을 선택하세요'
      : donateFor?.platform === 'youtube'
        ? '유튜브 채팅은 방송이 재생되면 표시됩니다'
        : '채팅을 볼 방송 칸을 선택하세요';
  const pageLabel = (page: PageSlot) =>
    page.kind === 'web' ? page.name : !donateFor ? page.name : `${donateFor.name} ${page.kind === 'donate' ? '후원 페이지' : '채팅'}`;

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
  // 설정: 라이브 자동 갱신 · 즐겨찾기 방송 시작 알림 (로그인 대기 중에는 그 확인을 방해하지 않는다)
  useLiveWatch({
    minutes: settings.liveRefreshMinutes,
    active: !['idle', 'no-extension', 'logged-out', 'waiting-login'].includes(toonStatus),
    refresh: refreshToonation,
    creators: toonation.state.creators,
    notifyOn: settings.liveNotify,
    notify: showLiveNotification,
  });
  useEffect(() => {
    // 자동 갱신을 켰는데 아직 한 번도 불러오지 않았으면 지금 불러와 기준 목록을 만든다
    if (settings.liveRefreshMinutes > 0 && toonStatus === 'idle') refreshToonation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.liveRefreshMinutes]);
  const changeSettings = (patch: Partial<typeof settings>) => {
    // 방송 시작 알림을 켜면 알림 권한을 묻는다
    const N = globalThis.Notification;
    if (patch.liveNotify && N?.permission === 'default') Promise.resolve(N.requestPermission()).catch(() => {});
    updateSettings(patch);
  };
  // 시작할 때 로그인 상태(캐시 잔액)를 확인한다
  useEffect(() => {
    if (toonStatus === 'idle' && !viewer) refreshToonation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 내 후원 내역 (월 후원 한도 확인에도 쓴다). 로그인되면 미리 불러 두고, 후원창을 닫으면 다시 불러온다
  const [history, setHistory] = useState<DonationRecord[] | null>(null);
  const loggedIn = !!toonation.state.account;
  const loadHistory = useCallback(async () => {
    const list = await bridge.request<DonationRecord[]>('history');
    const clean = Array.isArray(list) ? list.filter((i) => i && Number.isFinite(i.at) && Number.isFinite(i.cash)) : [];
    setHistory(clean);
    return clean;
  }, [bridge]);
  useEffect(() => {
    if (loggedIn && settings.monthlyLimit > 0) loadHistory().catch(() => {});
  }, [loggedIn, settings.monthlyLimit, popupClosed, loadHistory]);
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
  const focusedCreator = focused !== null && focused < visibleCount(state) ? state.slots[focused] ?? null : null; // 방송 또는 페이지
  const focusedStream = isStream(focusedCreator) ? focusedCreator : null;
  useEffect(() => {
    if (focused !== null && !focusedCreator) exitFullscreen(); // 레이아웃 축소 등으로 칸이 사라짐
  }, [focused, focusedCreator, exitFullscreen]);

  // ---------- 방송 종료 감지 ----------
  // 플레이어가 알려 준 상태 (플레이어 키). 칸에서 빠진 방송의 상태는 지운다
  const [streamStatus, setStreamStatus] = useState<Record<string, StreamStatus>>({});
  useEffect(() => {
    setStreamStatus((m) => {
      const live = Object.keys(m).filter((k) => keys.includes(k));
      return live.length === Object.keys(m).length ? m : Object.fromEntries(live.map((k) => [k, m[k]]));
    });
  }, [keys]);
  const onStreamStatus = (key: string, s: StreamStatus) => {
    setStreamStatus((m) => (m[key] === s ? m : { ...m, [key]: s }));
    // 바꿔 넣을 라이브 방송을 찾을 수 있게 투네이션 즐겨찾기 라이브 상태를 새로 가져온다
    if (s !== 'live' && toonStatus !== 'waiting-login' && toonStatus !== 'checking' && toonStatus !== 'loading') refreshToonation();
  };
  /** 끝난 방송 대신 넣을 방송: 투네이션 즐겨찾기 중 라이브이면서 아직 칸에 없는 첫 방송 */
  const liveReplacement = (): Creator | null =>
    toonation.state.creators.find((c) => c.live && !state.slots.some((s) => isStream(s) && s.key === c.key)) ?? null;
  const replaceSlot = (slot: number, c: Creator) => {
    const k = keys[slot];
    dispatch({ type: 'restore', slot, item: c });
    setHandles((prev) => Object.fromEntries(Object.entries(prev).filter(([hk]) => hk !== k)));
  };
  const endedSlots = keys.map((k, i) => (k && isStream(state.slots[i]) && streamStatus[k] && streamStatus[k] !== 'live' ? streamStatus[k] : null));
  // 설정: 방송이 끝나면 라이브 중인 즐겨찾기로 자동으로 바꾸기
  useEffect(() => {
    if (!settings.autoReplaceEnded || viewer) return;
    const slot = endedSlots.findIndex((s, i) => s && i < visibleCount(state));
    const c = slot >= 0 ? liveReplacement() : null;
    if (c) replaceSlot(slot, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoReplaceEnded, endedSlots.join(','), toonation.state.creators]);
  const endedOverlay = (slot: number) => {
    const s = endedSlots[slot];
    const item = state.slots[slot];
    if (!s || !isStream(item)) return null;
    const c = viewer ? null : liveReplacement();
    return (
      <div className="ended-notice" role="status" aria-label={`${item.name} 방송 상태`}>
        <strong>{s === 'ended' ? '방송 종료' : '재생할 수 없는 방송'}</strong>
        {c ? (
          <button type="button" className="btn btn--donate btn--sm" aria-label={`라이브로 바꾸기 · ${c.name}`} onClick={() => replaceSlot(slot, c)}>
            라이브로 바꾸기 · {c.name}
          </button>
        ) : (
          !viewer && <span className="muted">라이브 중인 투네이션 즐겨찾기가 없습니다</span>
        )}
      </div>
    );
  };

  // 단축키: 1~9 칸 선택 · M 소리 · F 전체 화면 · D 후원하기 (입력 중이거나 창이 열려 있으면 무시)
  const keyActions = useRef({ onDonate: () => {}, fullscreen: (_slot: number) => {} });
  useEffect(() => {
    if (!settings.shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (/^[1-9]$/.test(k)) dispatch({ type: 'select', slot: Number(k) - 1 });
      else if (k === 'm') dispatch({ type: 'toggleSound' });
      else if (k === 'd') keyActions.current.onDonate();
      else if (k === 'f' && stateRef.current.selected !== null) keyActions.current.fullscreen(stateRef.current.selected);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings.shortcuts]);

  const warning = donationWarning(popupCreator, popupClosed, donateTarget);

  const openPopup = useCallback(
    (c: Creator) => {
      if (desktop) {
        // 설치형: 창 오른쪽 후원 패널 (로그인한 세션으로 열린다)
        // 설정: 후원창 기본 모드('last'면 앱이 마지막 모드로) · 빠른 후원 금액
        const mode = settings.donateMode === 'last' ? undefined : settings.donateMode;
        desktop.openDonate({ tag: c.donateId, name: c.name, ...(mode && { mode }), amounts: settings.quickAmounts, ...(settings.quickMessages.length ? { messages: settings.quickMessages } : {}) });
        if (mode) setDonateMode(mode); // 앱의 모드 알림을 기다리지 않고 맞는 틀을 그린다
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
    [win, desktop, settings.donateMode, settings.quickAmounts, settings.quickMessages],
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

  const donateTo = (c: Creator, checkLimit = true) => {
    // 월 후원 한도: 미리 불러 둔 이번 달 합계로 바로 판단한다 (웹 팝업은 클릭 순간에 열어야 막히지 않는다)
    const total = history ? monthTotal(history, Date.now()) : 0;
    if (checkLimit && settings.monthlyLimit > 0 && total >= settings.monthlyLimit) {
      setLimitAsk({ creator: c, total });
      return;
    }
    if (needsConfirm(c, kv)) setConfirming(c);
    else openPopup(c);
  };
  const onDonate = () => {
    if (donateTarget) donateTo(donateTarget);
  };

  keyActions.current = { onDonate, fullscreen: enterFullscreen };

  // ---------- 칸 새 창으로 분리 ----------
  const detachSlot = (slot: number) => {
    const item = state.slots[slot];
    if (!isStream(item) && !isPage(item)) return;
    const id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const ok = detachHost.open(
      {
        id,
        item,
        sound: !!audible[slot],
        donateFor: isPage(item) && item.kind !== 'web' ? donateFor : null,
        videoId: isPage(item) && item.kind === 'chat' ? chatVideoId : null,
      },
      isPage(item) ? pageLabel(item) : item.name,
    );
    if (!ok) {
      setMessage('새 창을 열지 못했습니다. 팝업을 허용해 주세요');
      return;
    }
    if (focused === slot) exitFullscreen();
    setDetached((d) => [...d, { id, item }]);
    dispatch({ type: 'assignPage', slot, page: { kind: 'detached', key: `detached:${id}`, name: item.name, id } });
    setMessage(null);
  };
  /**
   * 분리 창의 내용을 칸으로 되돌린다.
   * button(칸의 되돌리기)·return(분리 창의 되돌리기): 분리 표시 칸으로, 그 칸에 다른 방송을 넣었으면 보이는 첫 빈 칸으로
   * closed(분리 창을 닫음): 분리 표시 칸이 남아 있을 때만 되돌리고, 아니면 버린다
   */
  const restoreDetached = (id: string, how: 'button' | 'return' | 'closed') => {
    const entry = detachedRef.current.find((d) => d.id === id);
    if (!entry) return;
    const s = stateRef.current;
    let slot = s.slots.findIndex((x) => detachedId(x) === id);
    if (slot < 0 && how !== 'closed') {
      slot = visibleSlots(s).findIndex((x) => !x);
      if (slot < 0) {
        setMessage('빈 칸이 없어 되돌릴 수 없습니다. 칸을 비운 뒤 다시 눌러 주세요');
        return;
      }
    }
    setDetached((d) => d.filter((x) => x.id !== id));
    if (how !== 'closed') detachHost.close(id);
    if (slot >= 0) dispatch({ type: 'restore', slot, item: entry.item });
    setMessage(null);
  };
  const detachedRef = useRef(detached);
  detachedRef.current = detached;
  const detachActions = useRef({ restore: restoreDetached, donate: (_id: string) => {} });
  detachActions.current = {
    restore: restoreDetached,
    donate: (id) => {
      const item = detachedRef.current.find((d) => d.id === id)?.item;
      if (isStream(item)) donateTo(item);
    },
  };
  useEffect(() => {
    const offMsg = detachHost.onMessage((id, msg) => (msg.type === 'return' ? detachActions.current.restore(id, 'return') : detachActions.current.donate(id)));
    const offClosed = detachHost.onClosed((id) => detachActions.current.restore(id, 'closed'));
    return () => {
      offMsg();
      offClosed();
    };
  }, [detachHost]);

  const liveSource = useMemo(() => props.lives ?? ((q: LiveQuery) => fetchLiveList(q)), [props.lives]);
  const pickPage = (page: PageSlot) => {
    if (pickerSlot === null) return;
    dispatch({ type: 'assignPage', slot: pickerSlot, page });
    setPickerSlot(null);
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
        onPresets={viewer || hosting ? undefined : () => setPresetsOpen(true)}
        account={toonation.state.account && !viewer ? { cash: typeof toonation.state.account.cash === 'number' ? toonation.state.account.cash : null, onHistory: () => setHistoryOpen(true) } : null}
      />
      <div className="app__body">
        <div className={`stage${focusedCreator ? ' stage--focus' : ''}`} ref={stageRef}>
          <TileGrid
            state={state}
            onSizes={(group, sizes) => dispatch({ type: 'setSizes', group, sizes })}
            onDragging={setDragging}
            renderTile={(slot) => {
              const item = state.slots[slot] ?? null;
              const creator = isStream(item) ? item : null;
              const page = isPage(item) ? item : null;
              const markId = detachedId(item);
              const pageKey = keys[slot];
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
                  audible={audible[slot]}
                  onSoundClick={
                    mix && keys[slot]
                      ? () => {
                          const k = keys[slot]!;
                          if (!state.soundOn) dispatch({ type: 'toggleSound' }); // 전체 소리가 꺼져 있으면 다시 켠다
                          setMixMuted((m) => ({ ...m, [k]: state.soundOn ? !m[k] : false }));
                        }
                      : undefined
                  }
                  volume={
                    mix && keys[slot]
                      ? { value: tileVolumes[keys[slot]!] ?? settings.masterVolume, onChange: (v) => setTileVolumes((t) => ({ ...t, [keys[slot]!]: v })) }
                      : undefined
                  }
                  badge={hostSlot && creator ? '호스트' : undefined}
                  page={
                    page
                      ? {
                          label: pageLabel(page),
                          onBack: () => pageKey && pageHandles.current[pageKey]?.back(),
                          onReload: () => pageKey && pageHandles.current[pageKey]?.reload(),
                          onOpenWindow:
                            page.kind === 'web' ? () => win.open(page.url, '_blank', 'noopener') : !desktop && donateFor ? () => donateTo(donateFor) : undefined,
                        }
                      : undefined
                  }
                  dnd={{
                    slot,
                    // 합방 중에는 1번 호스트 칸은 고정
                    canDrag: !!item && !hostSlot,
                    canDrop: tileDrag.drag !== null && tileDrag.drag.from !== slot && !hostSlot,
                    over: tileDrag.drag?.over === slot,
                    source: tileDrag.drag?.from === slot,
                    onPress: (e) => tileDrag.start(slot, e, { canDrag: !!item && !hostSlot }),
                  }}
                  onFullscreen={creator || page ? () => enterFullscreen(slot) : undefined}
                  onDetach={(creator || page) && !hostSlot && !viewer ? () => detachSlot(slot) : undefined}
                  detached={markId && item ? { name: item.name, onReturn: () => restoreDetached(markId, 'button') } : undefined}
                  onRemove={
                    creator || page
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
                {focusedStream && (
                  <>
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
                  </>
                )}
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
            // 영상 클릭 설정이 '플레이어'면 영상 위 잡는 층을 깔지 않는다 (클릭이 플레이어로 간다)
            onGrab={settings.videoClick === 'select' ? (slot, e) => tileDrag.start(slot, e, { canDrag: !((!!viewer || !!hosting) && slot === 0) }) : undefined}
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
            onStatus={onStreamStatus}
            renderOverlay={endedOverlay}
            renderPage={(page, key) => (
              <PageView
                page={page}
                url={pageUrl(page)}
                embed={embed}
                onHandle={(h) => {
                  if (h) pageHandles.current[key] = h;
                  else delete pageHandles.current[key];
                }}
                onOpenWindow={donateFor ? () => donateTo(donateFor) : undefined}
                emptyText={pageEmptyText(page)}
              />
            )}
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
          amounts={settings.quickAmounts}
          onFill={(n) => desktop?.fillDonate(n)}
          messages={settings.quickMessages}
          onFillMessage={desktop?.fillDonateMessage ? (m) => desktop.fillDonateMessage?.(m) : undefined}
          cash={typeof toonation.state.account?.cash === 'number' ? toonation.state.account.cash : null}
          onClose={closeDesktopDonate}
        />
      )}
      {pickerSlot !== null && (
        <FavoritesPicker
          source={favorites}
          onClose={() => setPickerSlot(null)}
          tabs={[
            {
              label: '투네이션 라이브',
              content: (
                <LiveTab
                  load={liveSource}
                  onPick={(creator) => {
                    dispatch({ type: 'assign', slot: pickerSlot, creator });
                    setPickerSlot(null);
                  }}
                />
              ),
            },
            { label: '후원 페이지', content: <DonatePageTab desktop={!!desktop} onPick={pickPage} /> },
            { label: '채팅', content: <ChatPageTab desktop={!!desktop} onPick={pickPage} /> },
            { label: '웹페이지', content: <WebPageTab desktop={!!desktop} onPick={pickPage} /> },
          ]}
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
      {historyOpen && (
        <HistoryDialog
          load={loadHistory}
          cash={typeof toonation.state.account?.cash === 'number' ? toonation.state.account.cash : null}
          monthlyLimit={settings.monthlyLimit}
          onCharge={() => win.open('https://toon.at/donator/account/charge', '_blank', 'noopener')}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      {limitAsk && (
        <div className="modal-backdrop" onClick={() => setLimitAsk(null)}>
          <div className="modal" role="dialog" aria-label="후원 한도 확인" onClick={(e) => e.stopPropagation()}>
            <h2>월 후원 한도</h2>
            <p>
              이번 달 후원 {limitAsk.total.toLocaleString('ko-KR')}원으로 한도 {settings.monthlyLimit.toLocaleString('ko-KR')}원에 이르렀습니다. 그래도 {limitAsk.creator.name}에게 후원할까요?
            </p>
            <p className="muted">한도는 설정에서 바꿀 수 있습니다.</p>
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setLimitAsk(null)}>
                취소
              </button>
              <button
                type="button"
                className="btn btn--donate"
                onClick={() => {
                  const c = limitAsk.creator;
                  setLimitAsk(null);
                  donateTo(c, false);
                }}
              >
                그래도 후원하기
              </button>
            </div>
          </div>
        </div>
      )}
      {presetsOpen && (
        <PresetsDialog
          kv={kv}
          current={withDetachedItems(state, detached)}
          onLoad={(view) => {
            // 분리 창은 따로 남는다 (칸에 다른 방송을 넣은 것과 같다)
            exitFullscreen();
            dispatch({ type: 'replace', state: view });
            setPresetsOpen(false);
          }}
          onClose={() => setPresetsOpen(false)}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          onChange={changeSettings}
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
