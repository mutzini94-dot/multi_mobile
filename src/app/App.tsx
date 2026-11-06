import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Creator, PageSlot, SlotItem, ViewState } from '../domain/types';
import { desktopDetachHost, webDetachHost, type DetachHost } from '../detach/channel';
import { chatUrl, donatePageUrl, followDonateCreator, isPage, isPinnable, isStream, pageTarget, withSidePage } from '../domain/pages';
import { PinDialog } from '../ui/PinDialog';
import { hasCreatorDrag, readCreatorDrag } from './creatorDrag';
import { CREATOR_REMOTE_URL, MODE_KEY, REMOTE_PARTITION, readMode, type RemoteMode } from './remoteMode';
import { fetchLiveList, fetchPopularLive, type LivePage, type LiveQuery, type PopularLive } from '../toonation/liveList';
import { PageView, type PageHandle } from '../ui/PageView';
import { ActivityPageTab, ChatPageTab, DonatePageTab, SignaturePageTab, WebPageTab } from '../ui/PageTabs';
import { SignatureView } from '../ui/SignatureView';
import { parseSignatures, type Signature } from '../toonation/signatures';
import { ActivityWidget } from '../ui/ActivityWidget';
import { RecommendLiveDialog } from '../ui/RecommendLiveDialog';
import { RecommendLive } from '../ui/RecommendLive';
import { QuickPanel, type ShortsSize } from '../ui/QuickPanel';
import { ShortsFeed } from '../ui/ShortsFeed';
import { quickFavorites, quickRecent, startedLive, withLive } from '../quick/quickPanel';
import { SlotPickerDialog } from '../ui/SlotPickerDialog';
import { readShortsHeight, readShortsWidth, SHORTS_HEIGHT_KEY, SHORTS_WIDTH_KEY } from '../quick/shortsSize';
import { AddWindowDialog } from '../ui/AddWindowDialog';
import { ContextMenu } from '../ui/ContextMenu';
import { forgetWatch, newlyPlaced, readWatchLog, recordWatch } from '../activity/watchLog';
import { readSettingsLog, recordSettings } from '../activity/settingsLog';
import { donatedToCheck, findDonatedLive, mergeLive, type LiveTarget } from '../activity/liveTargets';
import { buildTimeline } from '../activity/timeline';
import { LiveTab } from '../ui/LiveTab';
import { donationWarning, openDonationPopup } from '../donate/donation';
import { localFavorites, type FavoritesSource } from '../favorites/favorites';
import type { PlayerHandle, StreamStatus } from '../players/types';
import { useAudioMix } from '../players/useAudioFocus';
import { usePlaybackPolicy } from '../players/usePlaybackPolicy';
import { createBridge, type ToonationBridge } from '../toonation/bridge';
import { desktopBridge, getDesktopApi, type AppInfo, type DesktopApi, type DonateMode } from '../desktop/desktopApi';
import { DonateModal } from '../ui/DonateModal';
import { useToonation } from '../toonation/useToonation';
import { showLiveNotification, useLiveWatch } from '../toonation/liveWatch';
import { ToonationSection } from '../ui/ToonationSection';
import { SearchSection } from '../ui/SearchSection';
import { GroupBar, GroupSelect } from '../ui/GroupBar';
import { useFavoriteGroups } from '../favorites/groups';
import { formatElapsed, useTileLiveInfo } from '../toonation/tileLive';
import { favoritesFromToonation, type ToonationFavorite } from '../toonation/bridge';
import { safeStorage, type KV } from '../storage/safeStorage';
import { DonationBar } from '../ui/DonationBar';
import { PlayerLayer } from '../ui/PlayerLayer';
import { FavoritesPicker } from '../ui/FavoritesPicker';
import { Gnb } from '../ui/Gnb';
import { Tile } from '../ui/Tile';
import { TileGrid } from '../ui/TileGrid';
import { playerKeys, visibleCount, visibleSlots } from '../layout/layouts';
import { initialViewState, viewReducer } from './viewState';
import { loadLastView, saveLastView } from './lastView';
import { applyLayout, growLayouts, shrinkLayout } from '../layout/layouts';
import { useSettings, SKINS } from '../settings/settings';
import { SettingsDialog } from '../ui/SettingsDialog';
import { PresetsDialog } from '../ui/PresetsDialog';
import { describeBackup, exportBackup, importBackup, type BackupSummary } from './backup';
import { BackupConfirmDialog } from '../ui/BackupConfirmDialog';
import { Onboarding, ONBOARDED_KEY } from '../ui/Onboarding';
import { HelpDialog, ShortcutsDialog, SUPPORT_URL } from '../ui/HelpDialog';
import { HistoryDialog } from '../ui/HistoryDialog';
import { goalLevel, GOAL_NOTICE_KEY, monthKey, monthTotal, type DonationRecord } from '../toonation/history';
import { useTileDrag } from './useTileDrag';

type AppWindow = Pick<Window, 'open' | 'screen' | 'location' | 'navigator'>;

interface Props {
  favorites?: FavoritesSource;
  kv?: KV;
  win?: AppWindow;
  bridge?: ToonationBridge;
  desktop?: DesktopApi | null; // 설치형 앱의 window.multiviewDesktop (없으면 웹 방식)
  lives?: (q: LiveQuery) => Promise<LivePage>; // 투네이션 라이브 목록 (테스트에서 바꿔 끼움)
  popular?: () => Promise<PopularLive>; // 인기라이브 (테스트에서 바꿔 끼움)
  quickPollMs?: number; // 퀵패널 라이브 확인 간격 (테스트에서 바꿔 끼움)
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
  // 즐겨찾기 그룹: 불러오기 창에서 그룹별로 보기 · 그룹 편집
  const groups = useFavoriteGroups(kv);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [editGroups, setEditGroups] = useState(false);
  const inGroup = (c: Creator) => !activeGroup || groups.groupOf(c) === activeGroup;
  const groupSelect = editGroups ? (c: Creator) => <GroupSelect creator={c} groups={groups} /> : undefined;
  const [guideOpen, setGuideOpen] = useState(() => kv.get(ONBOARDED_KEY) !== '1'); // 처음 사용 안내
  const [helpOpen, setHelpOpen] = useState(false); // 도움말
  const [keysOpen, setKeysOpen] = useState(false); // 단축키 안내 (? 키)
  const [historyOpen, setHistoryOpen] = useState(false);
  // 상단 스위치: 후원 리모컨(멀티뷰) ↔ 크리에이터 리모컨. 크리에이터 리모컨은 처음 바꿀 때 띄우고, 상태를 지키려고 그 뒤로는 숨겨 둔다
  const [mode, setModeState] = useState<RemoteMode>(() => readMode(kv));
  const [remoteLoaded, setRemoteLoaded] = useState(() => readMode(kv) === 'creator');
  const setMode = (m: RemoteMode) => {
    setModeState(m);
    kv.set(MODE_KEY, m);
    if (m === 'creator') setRemoteLoaded(true);
  };
  const creatorMode = mode === 'creator';
  // 상단 '추천 라이브': 고른 방송을 넣을 칸을 묻는다
  const [liveOpen, setLiveOpen] = useState(false);
  const [livePick, setLivePick] = useState<Creator | null>(null);
  const [limitAsk, setLimitAsk] = useState<{ creator: Creator; total: number } | null>(null);

  // 테마: 시스템을 따르거나 라이트·다크로 고정
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);
  // 스킨: 색·모서리·버튼 모양 (app.css의 [data-skin])
  useEffect(() => {
    document.documentElement.dataset.skin = settings.skin;
  }, [settings.skin]);
  const [skinMenu, setSkinMenu] = useState<{ x: number; y: number } | null>(null);
  const closeSkinMenu = useCallback(() => setSkinMenu(null), []);
  // 설치형: 창 항상 위
  useEffect(() => {
    desktop?.setAlwaysOnTop?.(settings.alwaysOnTop);
  }, [desktop, settings.alwaysOnTop]);

  // 시작 화면: 마지막 화면 복원(설정) > 기본 레이아웃(설정)
  const [state, dispatch] = useReducer(
    viewReducer,
    null,
    () => (settings.restoreLastView ? loadLastView(kv) : null) ?? withSidePage(applyLayout(initialViewState, settings.defaultLayout)),
  );
  // 새 창으로 분리한 칸들 (칸에는 분리 표시만 남는다)
  const [detached, setDetached] = useState<Detached[]>([]);
  // 화면이 바뀔 때마다 저장
  useEffect(() => {
    saveLastView(kv, withDetachedItems(state, detached));
  }, [kv, state, detached]);
  // 활동 위젯: 칸에 새로 띄운 방송은 시청 기록으로 (시작할 때 복원된 칸은 빼고)
  const [watchLog, setWatchLog] = useState(() => readWatchLog(kv));
  const prevSlots = useRef(state.slots);
  useEffect(() => {
    const placed = newlyPlaced(prevSlots.current, state.slots);
    prevSlots.current = state.slots;
    if (placed.length) setWatchLog(placed.reduce((_, c) => recordWatch(kv, c, Date.now()), readWatchLog(kv)));
  }, [kv, state.slots]);
  const [settingsLog, setSettingsLog] = useState(() => readSettingsLog(kv));
  const [message, setMessage] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
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
    (from, to, { shift }) => {
      const src = stateRef.current.slots[from];
      const dst = stateRef.current.slots[to];
      // 기본은 자리 바꾸기. Shift를 누른 채 방송 칸을 후원 페이지·채팅·시그니처 칸에 놓으면 자리는 그대로 그 방송에 고정한다
      if (shift && isStream(src) && isPinnable(dst)) {
        dispatch({ type: 'pinPage', slot: to, creator: src });
        settle([from]);
        return;
      }
      dispatch({ type: 'swap', from, to });
      settle([from, to]);
    },
    (slot) => dispatch({ type: 'select', slot }), // 짧게 누름 = 그 칸 선택 (그 칸만 소리)
    () => true,
    (from) => settle([from]), // 취소: 제자리로
  );
  // 전체 화면으로 보는 칸 (보기 방식일 뿐이라 저장하지 않는다)
  const [focused, setFocused] = useState<number | null>(null);
  const focusEl = useRef<HTMLDivElement>(null);

  // 플레이어 핸들: 플레이어 키(방송 기준, layouts.playerKeys)로 보관해 칸 자리를 바꿔도 그대로 쓴다
  const [handles, setHandles] = useState<Record<string, PlayerHandle>>({});
  // 전체 새로고침: 바뀌면 모든 칸의 플레이어·페이지를 다시 띄운다
  const [reloadSeq, setReloadSeq] = useState(0);
  // 트위치 칸 일시정지 버튼 (유튜브는 플레이어 자체 버튼)
  const [pausedKeys, setPausedKeys] = useState<Record<string, boolean>>({});
  const [tileSeq, setTileSeq] = useState<Record<string, number>>({});
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
  // 후원 대상: 선택한 방송
  const donateTarget = selectedCreator;
  // 후원 페이지 칸이 따라가는 크리에이터: 선택한 방송 (선택이 풀리면 마지막으로 따라간 방송)
  const [lastFollowed, setLastFollowed] = useState<Creator | null>(null);
  const detachHost = useMemo(
    () => props.detachHost ?? (desktop ? desktopDetachHost(desktop, () => window.location.href) : webDetachHost(window)),
    [props.detachHost, desktop],
  );
  const donateFor = followDonateCreator(state, lastFollowed);
  useEffect(() => {
    if (donateFor !== lastFollowed) setLastFollowed(donateFor);
  }, [donateFor, lastFollowed]);
  // 페이지 칸의 뒤로·새로고침 (플레이어 키로 보관)
  const pageHandles = useRef<Record<string, PageHandle>>({});
  const embed = desktop ? 'webview' : 'iframe';
  // 채팅 칸: 유튜브는 라이브 영상 ID로만 채팅을 열 수 있다. 라이브 목록에서 고른 방송은 이미 알고,
  // 채널로 넣은 방송은 플레이어가 재생을 시작한 뒤 알려 주므로 채팅 칸이 있는 동안 잠깐씩 물어본다
  const [ytLive, setYtLive] = useState<Record<string, string>>({});
  // 페이지 칸(후원 페이지·채팅·시그니처)이 보여 줄 방송: 고정한 방송 > 선택한 방송
  const targetOf = (page: PageSlot) => pageTarget(page, donateFor);
  const videoIdOf = (c: Creator | null) => (c?.platform === 'youtube' ? (c.videoId ?? ytLive[c.key] ?? null) : null);
  const chatTargets = [...state.slots, ...detached.map((d) => d.item)]
    .filter((s): s is PageSlot => isPage(s) && s.kind === 'chat')
    .map(targetOf)
    .filter((c): c is Creator => !!c && c.platform === 'youtube' && !videoIdOf(c));
  const chatTargetSig = chatTargets.map((c) => c.key).join(',');
  useEffect(() => {
    if (!chatTargets.length) return;
    const read = () => {
      for (const c of chatTargets) {
        const slot = stateRef.current.slots.findIndex((s) => isStream(s) && s.key === c.key);
        const k = slot >= 0 ? keys[slot] : null;
        const id = k ? handles[k]?.videoId?.() : null;
        if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) setYtLive((m) => (m[c.key] === id ? m : { ...m, [c.key]: id }));
      }
    };
    read();
    const t = setInterval(read, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatTargetSig, keys, handles]);
  // 분리 창에 가 있는 후원 페이지·채팅도 보여 줄 방송을 알려 준다
  const detachedTargetSig = detached.map((d) => (isPage(d.item) ? `${d.id}:${targetOf(d.item)?.key ?? ''}:${videoIdOf(targetOf(d.item)) ?? ''}` : '')).join('|');
  useEffect(() => {
    for (const d of detached)
      if (isPage(d.item) && (d.item.kind === 'donate' || d.item.kind === 'chat')) {
        const c = targetOf(d.item);
        detachHost.post(d.id, { type: 'donateFor', creator: c, videoId: videoIdOf(c) });
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detachedTargetSig, detachHost]);
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const pageUrl = (page: PageSlot) => {
    if (page.kind === 'web') return page.url;
    const c = targetOf(page);
    if (page.kind === 'activity' || page.kind === 'signature' || !c) return null;
    return page.kind === 'donate' ? donatePageUrl(c) : chatUrl(c, videoIdOf(c), embed, host);
  };
  const pageEmptyText = (page: PageSlot) =>
    page.kind !== 'chat'
      ? '후원할 방송 칸을 선택하세요'
      : targetOf(page)?.platform === 'youtube'
        ? '유튜브 채팅은 방송이 재생되면 표시됩니다'
        : '채팅을 볼 방송 칸을 선택하세요';
  const pageLabel = (page: PageSlot) => {
    const c = targetOf(page);
    return page.kind === 'web' || page.kind === 'activity' || !c ? page.name : `${c.name} ${page.kind === 'donate' ? '후원 페이지' : page.kind === 'signature' ? '시그니처' : '채팅'}`;
  };
  // 📌 페이지 칸을 방송에 고정 (고정할 방송 고르기 창)
  const [pinSlot, setPinSlot] = useState<number | null>(null);
  // 카드(추천 라이브·활동 위젯·퀵패널)를 칸으로 끄는 중: 플레이어·페이지가 끌기를 가로채지 않게, 추천 라이브 창은 비켜 준다
  const [cardDrag, setCardDrag] = useState(false);
  const [cardOverSlot, setCardOverSlot] = useState<number | null>(null); // 카드를 끌고 있는 칸 (테두리 강조)
  useEffect(() => {
    // 끌기를 시작한 그 순간에 화면을 바꾸면 브라우저가 끌기를 취소하므로 다음 차례에 바꾼다
    const start = (e: DragEvent) => hasCreatorDrag(e.dataTransfer) && setTimeout(() => setCardDrag(true), 0);
    const end = () => {
      setCardDrag(false);
      setCardOverSlot(null);
    };
    // 놓기는 창 전체에서 받아 커서 아래의 칸을 찾는다: 끌기를 막 시작한 순간에는 영상 위 층이 아직 끌기를 받고 있어서
    const slotAt = (e: DragEvent): number | null => {
      const direct = (e.target as Element | null)?.closest?.('.tile[data-slot]') as HTMLElement | null;
      const tile = direct ?? ((document.elementsFromPoint?.(e.clientX, e.clientY) ?? []).map((el) => el.closest('.tile[data-slot]')).find(Boolean) as HTMLElement | undefined);
      if (!tile || tile.dataset.card !== '1') return null;
      const n = Number(tile.dataset.slot);
      return Number.isInteger(n) ? n : null;
    };
    const over = (e: DragEvent) => {
      if (!hasCreatorDrag(e.dataTransfer)) return;
      const slot = slotAt(e);
      setCardOverSlot(slot);
      if (slot === null) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const drop = (e: DragEvent) => {
      end();
      if (!e.dataTransfer || !hasCreatorDrag(e.dataTransfer)) return;
      const slot = slotAt(e);
      const c = readCreatorDrag(e.dataTransfer);
      if (slot === null || !c) return;
      e.preventDefault();
      dropCreatorRef.current(slot, c);
    };
    window.addEventListener('dragstart', start);
    window.addEventListener('dragend', end);
    window.addEventListener('dragenter', over); // 빨리 놓으면 그 자리에서는 dragenter만 오므로 이것도 받아 준다
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragstart', start);
      window.removeEventListener('dragend', end);
      window.removeEventListener('dragenter', over);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);
  /** 끌어 온 방송을 칸에 놓기: 후원 페이지·채팅·시그니처 칸이면 그 방송에 고정, 아니면 그 칸에 띄운다 */
  const dropCreator = (slot: number, c: Creator) => {
    setCardDrag(false);
    if (isPinnable(stateRef.current.slots[slot])) dispatch({ type: 'pinPage', slot, creator: c });
    else dispatch({ type: 'assign', slot, creator: c });
    setLivePick(null);
    setLiveOpen(false);
  };
  const dropCreatorRef = useRef(dropCreator);
  dropCreatorRef.current = dropCreator;
  // 시그니처 칸: 선택한 방송 크리에이터의 시그니처 (로그인 없이도)
  const loadSignatures = useCallback((tag: string) => bridge.request<unknown[]>('signatures', tag).then(parseSignatures), [bridge]);

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
    setSettingsLog(recordSettings(kv, settings, patch, Date.now()));
    updateSettings(patch);
  };
  // 시작할 때 로그인 상태(캐시 잔액)를 확인한다
  useEffect(() => {
    if (toonStatus === 'idle') refreshToonation();
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
    if (loggedIn && (settings.monthlyLimit > 0 || settings.monthlyGoal > 0)) loadHistory().catch(() => {});
  }, [loggedIn, settings.monthlyLimit, settings.monthlyGoal, popupClosed, loadHistory]);
  // 후원 목표: 이번 달 합계가 목표의 80%·100%에 이르면 단계마다 한 번 알린다
  useEffect(() => {
    if (!history || !(settings.monthlyGoal > 0)) return;
    const now = Date.now();
    const total = monthTotal(history, now);
    const level = goalLevel(total, settings.monthlyGoal);
    if (!level) return;
    const month = monthKey(now);
    let seen = 0;
    try {
      const r = JSON.parse(kv.get(GOAL_NOTICE_KEY) ?? 'null');
      if (r && r.month === month) seen = Number(r.level) || 0;
    } catch {
      // 처음
    }
    if (level <= seen) return;
    kv.set(GOAL_NOTICE_KEY, JSON.stringify({ month, level }));
    const goal = settings.monthlyGoal.toLocaleString('ko-KR');
    const text =
      level === 100
        ? `이번 달 후원 목표 ${goal}원에 이르렀습니다 (${total.toLocaleString('ko-KR')}원)`
        : `이번 달 후원이 목표 ${goal}원의 80%를 넘었습니다 (${total.toLocaleString('ko-KR')}원)`;
    setMessage(text);
    const N = globalThis.Notification;
    if (N && N.permission === 'granted') new N('후원 목표', { body: text, tag: 'mv-goal' });
  }, [history, settings.monthlyGoal, kv]);
  // 설치형 앱 정보 (버전·앱 옵션·업데이트): 설정 창을 열 때 불러오고, 앱이 바뀌면 알려 준다
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  useEffect(() => desktop?.onAppInfo?.(setAppInfo), [desktop]);
  useEffect(() => {
    if (settingsOpen && desktop?.appInfo) desktop.appInfo().then((i) => i && setAppInfo(i), () => {});
  }, [settingsOpen, desktop]);
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
  // 미니 모드: 선택한 방송(없으면 보이는 첫 방송) 하나만, 상단 메뉴 없이. 설치형은 앱 창도 작게·항상 위로
  const [mini, setMini] = useState(false);
  const miniRef = useRef(false);
  const enterMini = () => {
    const slot = isStream(state.slots[state.selected ?? -1]) ? state.selected! : state.slots.findIndex((s, i) => isStream(s) && i < visibleCount(state));
    if (slot < 0) return;
    dispatch({ type: 'select', slot });
    setFocused(slot);
    setMini(true);
    miniRef.current = true;
    desktop?.setMiniMode?.(true);
  };
  const exitFullscreen = useCallback(() => {
    setFocused(null);
    if (miniRef.current) {
      miniRef.current = false;
      setMini(false);
      desktop?.setMiniMode?.(false);
    }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, [desktop]);
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
  // 트위치 자동 재생 시작 중인 플레이어: 그동안 영상 위 바·잡는 층을 숨긴다 (겹쳐 있으면 트위치가 재생을 막는다)
  const [startingKeys, setStartingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const onStreamStarting = useCallback((key: string, waiting: boolean) => {
    setStartingKeys((prev) => {
      if (prev.has(key) === waiting) return prev;
      const next = new Set(prev);
      if (waiting) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
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
    if (!settings.autoReplaceEnded) return;
    const slot = endedSlots.findIndex((s, i) => s && i < visibleCount(state));
    const c = slot >= 0 ? liveReplacement() : null;
    if (c) replaceSlot(slot, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoReplaceEnded, endedSlots.join(','), toonation.state.creators]);
  const pauseControl = (slot: number, key: string) => {
    const item = state.slots[slot];
    if (!isStream(item) || item.platform !== 'twitch') return null;
    const paused = !!pausedKeys[key];
    return (
      <button
        type="button"
        className="player-pause"
        aria-label={`${item.name} ${paused ? '재생' : '일시정지'}`}
        title={paused ? '재생' : '일시정지'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          const h = handles[key];
          const now = h?.isPaused?.() ?? paused; // 플레이어 안에서 직접 멈췄을 수도 있다
          h?.setPaused?.(!now);
          setPausedKeys((p) => ({ ...p, [key]: !now }));
          // 웹 브라우저의 트위치 임베드는 멈춘 뒤 재생 요청을 무시하기도 한다: 그대로면 그 칸만 다시 띄운다 (라이브는 지금 시점부터)
          if (now && h?.isPaused)
            setTimeout(() => {
              if (h.isPaused?.()) setTileSeq((t) => ({ ...t, [key]: (t[key] ?? 0) + 1 }));
            }, 1500);
        }}
      >
        {paused ? '▶' : '❚❚'}
      </button>
    );
  };
  const endedOverlay = (slot: number) => {
    const s = endedSlots[slot];
    const item = state.slots[slot];
    if (!s || !isStream(item)) return null;
    const c = liveReplacement();
    return (
      <div className="ended-notice" role="status" aria-label={`${item.name} 방송 상태`}>
        <strong>{s === 'ended' ? '방송 종료' : '재생할 수 없는 방송'}</strong>
        {c ? (
          <button type="button" className="btn btn--donate btn--sm" aria-label={`라이브로 바꾸기 · ${c.name}`} onClick={() => replaceSlot(slot, c)}>
            라이브로 바꾸기 · {c.name}
          </button>
        ) : (
          <span className="muted">라이브 중인 투네이션 즐겨찾기가 없습니다</span>
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

  // ? 키: 단축키 안내 (단축키를 꺼 둬도 열린다. 입력 중이거나 다른 창이 열려 있으면 무시)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.ctrlKey || e.altKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setKeysOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const closeKeys = useCallback(() => setKeysOpen(false), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

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
    openPopup(c);
  };
  // 시그니처로 후원: 후원창을 열고 그 시그니처를 골라 둔다 (설치형). 웹 팝업은 다른 사이트라 고르는 방법을 알린다
  const donateSignature = (s: Signature, c: Creator | null) => {
    if (!c) return;
    const tag = c.donateId;
    const label = `'${s.name}'(${s.cash.toLocaleString('ko-KR')}캐시)`;
    const manual = `후원창의 시그니처 탭에서 ${label}를 골라 주세요`;
    // 그 크리에이터의 후원 페이지 칸이 떠 있으면 새 후원창 대신 그 칸에서 고른다 (설치형)
    const tileSlot = desktop?.selectSignature
      ? visibleSlots(state).findIndex((p) => isPage(p) && p.kind === 'donate' && targetOf(p)?.donateId === tag)
      : -1;
    const tileWc = tileSlot >= 0 && keys[tileSlot] ? pageHandles.current[keys[tileSlot]!]?.webContentsId?.() : null;
    if (desktop?.selectSignature && tileWc) {
      setMessage(`후원 페이지 칸에서 ${label} 시그니처를 고르는 중…`);
      desktop.selectSignature(s.name, tag, s.cash, tileWc).then(
        (r) => setMessage(r === 'ok' ? `후원 페이지 칸에 ${label} 시그니처를 골라 두었습니다. 후원 버튼을 눌러 주세요` : `후원 페이지 칸의 시그니처 탭에서 ${label}를 골라 주세요 (자동 선택 실패: ${r})`),
        () => setMessage(manual),
      );
      return;
    }
    donateTo(c);
    if (!desktop?.selectSignature) {
      setMessage(manual);
      return;
    }
    setMessage(`후원창에서 ${label} 시그니처를 고르는 중…`);
    desktop.selectSignature(s.name, tag, s.cash).then(
      (r) => setMessage(r === 'ok' ? `후원창에 ${label} 시그니처를 골라 두었습니다. 후원 버튼을 눌러 주세요` : `${manual} (자동 선택 실패: ${r})`),
      () => setMessage(manual),
    );
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
        donateFor: isPage(item) && item.kind !== 'web' ? targetOf(item) : null,
        videoId: isPage(item) && item.kind === 'chat' ? videoIdOf(targetOf(item)) : null,
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

  // 투네이션 즐겨찾기(라이브 목록의 ♡): 추가·해제한 뒤 목록을 새로 가져온다
  const favoriteTags = useMemo(() => new Set(toonation.state.creators.map((c) => c.donateId)), [toonation.state.creators]);
  const toggleToonFavorite = async (c: Creator, on: boolean) => {
    await bridge.request('bookmark', { tag: c.donateId, on });
    refreshToonation();
  };
  const liveSource = useMemo(() => props.lives ?? ((q: LiveQuery) => fetchLiveList(q)), [props.lives]);
  const popularSource = useMemo(() => props.popular ?? (() => fetchPopularLive()), [props.popular]);
  // 퀵패널: 즐겨찾기(투네이션·직접 추가)·최근 본 크리에이터, 방송 시작 알림
  const quickOn = settings.quickPanel !== 'off';
  const quickFavs = quickFavorites(toonation.state.creators, favorites.list());
  const quickRecents = quickRecent(watchLog);
  // 투네이션 즐겨찾기가 아닌 크리에이터의 라이브 (공개 라이브 목록에서 후원 아이디로 찾는다)
  const [quickLive, setQuickLive] = useState<Record<string, Creator | false>>({});
  const quickLookup = useRef<() => void>(() => {});
  quickLookup.current = () => {
    const known = new Set(toonation.state.creators.map((c) => c.key));
    const seen = new Set<string>();
    const targets = [...quickFavs, ...quickRecents].filter((c) => !known.has(c.key) && c.donateId && !seen.has(c.key) && seen.add(c.key)).slice(0, 30);
    if (!targets.length) return;
    findDonatedLive(
      targets.map((c) => ({ tag: c.donateId, name: c.name, count: 0 })),
      liveSource,
    ).then((found) => {
      const next: Record<string, Creator | false> = Object.fromEntries(targets.map((c) => [c.key, false]));
      for (const t of found) {
        const own = targets.find((c) => c.donateId === t.creator.donateId);
        if (own) next[own.key] = { ...own, live: t.creator.live, profile: own.profile ?? t.creator.profile };
      }
      setQuickLive(next);
    });
  };
  useEffect(() => {
    if (!quickOn) return;
    quickLookup.current();
    // 투네이션 즐겨찾기는 '라이브 자동 갱신'이 켜져 있으면 그쪽이 새로 불러온다
    const ms = props.quickPollMs ?? (settings.liveRefreshMinutes > 0 ? settings.liveRefreshMinutes : 3) * 60_000;
    const id = setInterval(() => {
      if (settings.liveRefreshMinutes <= 0 && toonation.state.account) refreshToonation();
      quickLookup.current();
    }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickOn, settings.liveRefreshMinutes, props.quickPollMs]);
  const quickIsLive = (key: string): boolean | null => {
    const fav = toonation.state.creators.find((c) => c.key === key);
    if (fav) return !!fav.live;
    return key in quickLive ? !!quickLive[key] : null;
  };
  const quickLiveCreator = (c: Creator): Creator => {
    const fav = toonation.state.creators.find((f) => f.key === c.key);
    const q = quickLive[c.key];
    return fav ?? (q || c);
  };
  // 방송 시작: 꺼져 있던 것이 켜지면 알림 (처음 확인한 것은 알리지 않는다)
  const [quickStarted, setQuickStarted] = useState<Creator[]>([]);
  const quickPrev = useRef<Record<string, boolean>>({});
  const quickAll = [...quickFavs, ...quickRecents];
  // 빈 칸의 '최근' 바로 넣기: 최근 본 크리에이터 중 지금 칸에 없는 3명 (방송 중이 먼저)
  const shownKeys = new Set(visibleSlots(state).filter(isStream).map((c) => c.key));
  const emptyPicks = withLive(quickRecents.filter((c) => !shownKeys.has(c.key)).map(quickLiveCreator), quickIsLive, 3);
  const quickLiveMap: Record<string, boolean> = {};
  for (const c of quickAll) {
    const l = quickIsLive(c.key);
    if (l !== null) quickLiveMap[c.key] = l;
  }
  const quickLiveSig = JSON.stringify(quickLiveMap);
  useEffect(() => {
    const started = startedLive(quickPrev.current, quickLiveMap);
    quickPrev.current = { ...quickPrev.current, ...quickLiveMap };
    if (started.length)
      setQuickStarted((prev) => [...prev.filter((c) => !started.includes(c.key)), ...started.map((k) => quickLiveCreator(quickAll.find((c) => c.key === k)!))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickLiveSig]);
  const dismissQuick = (key: string) => setQuickStarted((s) => s.filter((c) => c.key !== key));
  // 퀵패널 맨 위 '추천 라이브 탐색' (쇼츠처럼 한 개씩)
  const [shortsOpen, setShortsOpen] = useState(false);
  const [shortsSize, setShortsSize] = useState<ShortsSize>(() => ({ width: readShortsWidth(kv), height: readShortsHeight(kv) })); // 추천 라이브 탐색 창 크기 (조절하면 기억)
  const [addOpen, setAddOpen] = useState(false); // 퀵패널 '창 추가': 새 칸 놓을 자리 고르기
  const growTo = growLayouts(state.layout);
  const [emptyMenu, setEmptyMenu] = useState<{ slot: number; x: number; y: number } | null>(null); // 빈 칸 오른쪽 클릭 메뉴
  const closeEmptyMenu = useCallback(() => setEmptyMenu(null), []);
  const [videoMenu, setVideoMenu] = useState<{ slot: number; x: number; y: number } | null>(null); // 영상 칸 오른쪽 클릭 메뉴
  const closeVideoMenu = useCallback(() => setVideoMenu(null), []);
  const openVideoMenu = (slot: number, x: number, y: number) => {
    if (!isStream(stateRef.current.slots[slot])) return;
    setEmptyMenu(null);
    setVideoMenu({ slot, x, y });
  };
  const openVideoMenuRef = useRef(openVideoMenu);
  openVideoMenuRef.current = openVideoMenu;
  // 설치형: 영상(iframe) 안 오른쪽 클릭 → 그 자리의 칸 메뉴
  useEffect(
    () =>
      desktop?.onFrameContextMenu?.(({ x, y }) => {
        for (const el of document.elementsFromPoint?.(x, y) ?? []) {
          const item = el.closest<HTMLElement>('.player-layer__item[data-slot]');
          if (item) return openVideoMenuRef.current(Number(item.dataset.slot), x, y);
        }
      }),
    [desktop],
  );
  const quickPanel = quickOn ? (
    <QuickPanel
      side={settings.quickPanel === 'right' ? 'right' : 'left'}
      favorites={withLive(quickFavs.map(quickLiveCreator), quickIsLive)}
      recent={withLive(quickRecents.map(quickLiveCreator), quickIsLive)}
      started={quickStarted}
      onPick={(c) => {
        dismissQuick(c.key);
        setLivePick(c);
      }}
      onDismiss={dismissQuick}
      onAddWindow={growTo.length ? () => setAddOpen(true) : null}
      login={{ loggedIn: !!toonation.state.account, onLogin: toonation.login }}
      onRemoveRecent={(c) => setWatchLog(forgetWatch(kv, c))}
      shorts={{
        open: shortsOpen,
        onToggle: () => setShortsOpen((o) => !o),
        size: shortsSize,
        onResize: (s) => {
          setShortsSize(s);
          if (s.width === null) kv.set(SHORTS_WIDTH_KEY, ''); // 비우면 기본
          else kv.set(SHORTS_WIDTH_KEY, String(s.width));
          if (s.height === null) kv.set(SHORTS_HEIGHT_KEY, ''); // 비우면 기본
          else kv.set(SHORTS_HEIGHT_KEY, String(s.height));
        },
        content: <ShortsFeed load={liveSource} onAdd={(c) => setLivePick(c)} onDonate={(c) => donateTo(c)} onClose={() => setShortsOpen(false)} />,
      }}
    />
  ) : null;
  // 활동 위젯: 후원한 크리에이터 중 라이브 (즐겨찾기 라이브는 투네이션 즐겨찾기 목록이 이미 안다)
  const hasActivity = state.slots.some((s) => isPage(s) && s.kind === 'activity');
  const [donatedLive, setDonatedLive] = useState<LiveTarget[] | null>(null);
  const favoriteTagsRef = useRef(favoriteTags);
  favoriteTagsRef.current = favoriteTags;
  const checkDonatedLive = useCallback(
    (list: DonationRecord[]) =>
      findDonatedLive(donatedToCheck(list, favoriteTagsRef.current), liveSource).then(setDonatedLive, () => setDonatedLive([])),
    [liveSource],
  );
  // 후원 내역을 불러와 후원 크리에이터의 라이브를 확인한다
  const loadDonatedLive = useCallback(() => {
    if (loggedIn) loadHistory().then(checkDonatedLive, () => setDonatedLive([]));
  }, [loggedIn, loadHistory, checkDonatedLive]);
  // 칸을 넣을 때·칸의 새로고침: 즐겨찾기 라이브도 새로 불러온다
  const refreshActivity = () => {
    if (toonStatus !== 'waiting-login') refreshToonation();
    loadDonatedLive();
  };
  useEffect(() => {
    if (hasActivity) refreshActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActivity]);
  // 로그인 상태가 바뀌면 후원 쪽만 다시 (즐겨찾기를 다시 부르면 로그인 상태가 또 바뀌어 요청이 끝없이 이어질 수 있다)
  useEffect(() => {
    if (!loggedIn) setDonatedLive(null);
    else if (hasActivity) loadDonatedLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);
  // 라이브 자동 갱신 주기마다 후원 크리에이터의 라이브만 다시 확인한다 (즐겨찾기는 useLiveWatch가, 후원 내역은 다시 부르지 않는다)
  useEffect(() => {
    if (!hasActivity || !loggedIn || !history || settings.liveRefreshMinutes <= 0) return;
    const id = setInterval(() => checkDonatedLive(history), settings.liveRefreshMinutes * 60_000);
    return () => clearInterval(id);
  }, [hasActivity, loggedIn, history, settings.liveRefreshMinutes, checkDonatedLive]);
  const activityLive = !loggedIn ? null : donatedLive === null ? null : mergeLive(toonation.state.creators, donatedLive);
  const activityIsLive = (key: string): boolean | null => {
    const fav = toonation.state.creators.find((c) => c.key === key);
    if (fav) return !!fav.live;
    if (donatedLive?.some((t) => t.creator.key === key)) return true;
    return tileLive[key] ? true : null;
  };
  // 칸 위쪽 바의 방송 정보 (설정). 방송한 시간은 1분마다 다시 그린다
  const tileLive = useTileLiveInfo({
    streams: visibleSlots(state).filter(isStream),
    known: toonation.state.creators,
    load: liveSource,
    enabled: settings.showLiveInfo,
  });
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!Object.values(tileLive).some((i) => i.startedAt)) return;
    const t = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [tileLive]);
  const liveLine = (i: { title: string; viewers: number; startedAt?: number }) =>
    [`${i.viewers.toLocaleString('ko-KR')}명`, i.startedAt ? formatElapsed(Math.max(clock, Date.now()) - i.startedAt) : '', i.title].filter(Boolean).join(' · ');
  const pickPage = (page: PageSlot) => {
    if (pickerSlot === null) return;
    dispatch({ type: 'assignPage', slot: pickerSlot, page });
    setPickerSlot(null);
  };

  const downloadJson = (json: string, fileName: string) => {
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage('내보내기에 실패했습니다');
    }
  };
  const exportFavorites = (json: string) => downloadJson(json, 'multiview-favorites.json');
  // 설정 전체 백업: 되살리면 저장값을 모두 바꾸므로 화면을 다시 읽어 처음부터 불러온다
  // 백업: 설치형이면 창 크기·위치도 함께 담는다
  const exportAll = async () => {
    const layout = desktop?.windowLayout ? await desktop.windowLayout().catch(() => null) : null;
    downloadJson(exportBackup(kv, Date.now(), layout), `multiview-backup-${new Date().toISOString().slice(0, 10)}.json`);
  };
  // 불러오기: 내용을 확인한 뒤 요약을 보여 주고, 확인하면 되살린다
  const [pendingBackup, setPendingBackup] = useState<{ text: string; summary: BackupSummary } | null>(null);
  const importAll = (text: string) => {
    const d = describeBackup(text);
    if (!d.ok) return d.error;
    setPendingBackup({ text, summary: d.value });
    return null;
  };
  const confirmBackup = async () => {
    if (!pendingBackup) return;
    const r = importBackup(kv, pendingBackup.text);
    setPendingBackup(null);
    if (!r.ok) return;
    if (r.value.desktop && desktop?.setWindowLayout) await desktop.setWindowLayout(r.value.desktop).catch(() => false);
    win.location.reload?.();
  };
  const closeGuide = () => {
    kv.set(ONBOARDED_KEY, '1');
    setGuideOpen(false);
  };
  return (
    <div className={`app${focusedCreator ? ' app--focus' : ''}${mini && focusedCreator ? ' app--mini' : ''}${tileDrag.drag ? ' app--dragging' : ''}${creatorMode ? ' app--creator' : ''}`}>

      <Gnb
        layout={state.layout}
        onLayout={(layout) => dispatch({ type: 'setLayout', layout })}
        canDonate={!!donateTarget}
        onDonate={onDonate}
        onSettings={() => setSettingsOpen(true)}
        onHelp={() => setHelpOpen(true)}
        onSkin={(x, y) => setSkinMenu({ x, y })}
        onLogin={toonation.state.account ? undefined : toonation.login}
        loggingIn={toonation.state.status === 'waiting-login'}
        onLive={() => setLiveOpen(true)}
        onReloadAll={() => {
          setReloadSeq((n) => n + 1);
          setPausedKeys({});
          if (hasActivity) refreshActivity();
        }}
        onPresets={() => setPresetsOpen(true)}
        sound={{ on: state.soundOn, onToggle: () => dispatch({ type: 'toggleSound' }) }}
        onMini={state.slots.some((s, i) => isStream(s) && i < visibleCount(state)) ? enterMini : undefined}
        account={toonation.state.account ? { cash: typeof toonation.state.account.cash === 'number' ? toonation.state.account.cash : null, onHistory: () => setHistoryOpen(true) } : null}
        mode={{ value: mode, onChange: setMode }}
      />
      {remoteLoaded && (
        <div className="creator-remote" hidden={!creatorMode}>
          {/* 설치형은 webview: 앱이 실시간 후원·위젯 분리·압정·자석·단축키(window.toona)를 넣어 준다 */}
          {desktop ? (
            <webview className="creator-remote__frame" title="크리에이터 리모컨" src={CREATOR_REMOTE_URL} partition={REMOTE_PARTITION} />
          ) : (
            <iframe className="creator-remote__frame" title="크리에이터 리모컨" src={CREATOR_REMOTE_URL} allow="autoplay; clipboard-write; fullscreen" />
          )}
        </div>
      )}
      {/* 크리에이터 리모컨일 때도 칸은 그대로 두고 숨긴다 (돌아오면 바로 이어서) */}
      <div className="app__body" hidden={creatorMode}>
        {settings.quickPanel === 'left' && quickPanel}
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
              return (
                <Tile
                  liveInfo={creator && tileLive[creator.key] ? liveLine(tileLive[creator.key]) : undefined}
                  creator={creator}
                  selected={state.selected === slot}
                  starting={!!keys[slot] && startingKeys.has(keys[slot]!)}
                  soundOn={state.soundOn}
                  onSelect={() => dispatch({ type: 'select', slot })}
                  onLoad={() => setPickerSlot(slot)}
                  quickPicks={emptyPicks}
                  slotNumber={slot + 1}
                  onQuickPick={(c) => dispatch({ type: 'assign', slot, creator: c })}
                  onEmptyMenu={(x, y) => setEmptyMenu({ slot, x, y })}
                  onStreamMenu={(x, y) => openVideoMenu(slot, x, y)}
                  onDeleteWindow={shrinkLayout(state, slot) ? () => dispatch({ type: 'removeWindow', slot }) : undefined}
                  onToggleSound={() => dispatch({ type: 'toggleSound' })}
                  playerSlotRef={(el) => {
                    slotEls.current[slot] = el;
                  }}
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
                  page={
                    page
                      ? {
                          label: pageLabel(page),
                          onBack: page.kind === 'activity' || page.kind === 'signature' ? undefined : () => pageKey && pageHandles.current[pageKey]?.back(),
                          onReload:
                            page.kind === 'activity'
                              ? refreshActivity
                              : page.kind === 'signature'
                                ? () => pageKey && setTileSeq((t) => ({ ...t, [pageKey]: (t[pageKey] ?? 0) + 1 })) // 칸을 다시 띄워 새로 불러온다
                                : () => pageKey && pageHandles.current[pageKey]?.reload(),
                          onOpenWindow:
                            page.kind === 'web'
                              ? () => win.open(page.url, '_blank', 'noopener')
                              : page.kind !== 'activity' && page.kind !== 'signature' && !desktop && targetOf(page)
                                ? () => donateTo(targetOf(page)!)
                                : undefined,
                          // 📌 방송에 고정 (후원 페이지·채팅·시그니처)
                          pin: isPinnable(page) ? { name: page.pin?.name ?? null, onClick: () => setPinSlot(slot) } : undefined,
                        }
                      : undefined
                  }
                  dnd={{
                    slot,
                    canDrag: !!item,
                    canDrop: tileDrag.drag !== null && tileDrag.drag.from !== slot,
                    over: tileDrag.drag?.over === slot,
                    source: tileDrag.drag?.from === slot,
                    onPress: (e) => tileDrag.start(slot, e, { canDrag: !!item }),
                  }}
                  onFullscreen={creator || page ? () => enterFullscreen(slot) : undefined}
                  acceptCard={!markId}
                  cardOver={cardOverSlot === slot}
                  onDetach={creator || (page && page.kind !== 'activity' && page.kind !== 'signature') ? () => detachSlot(slot) : undefined}
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
            <section className="focus-view" role={mini ? 'region' : undefined} aria-label={`${focusedCreator.name} ${mini ? '미니 모드' : '전체 화면'}`}>
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
                {mini ? (
                  <button type="button" className="btn btn--ghost" aria-label="미니 모드 끝" title="미니 모드 끝 (Esc)" onClick={exitFullscreen}>
                    ✕
                  </button>
                ) : (
                  <button type="button" className="btn btn--ghost" aria-label="전체 화면 종료" onClick={exitFullscreen}>
                    전체 화면 종료 (Esc)
                  </button>
                )}
              </div>
            </section>
          )}
          <PlayerLayer
            state={state}
            focused={focusedCreator ? focused : null}
            focusEl={focusEl}
            onSelectSlot={(slot) => dispatch({ type: 'select', slot })}
            // 영상 클릭 설정이 '플레이어'면 영상 위 잡는 층을 깔지 않는다 (클릭이 플레이어로 간다)
            onGrab={settings.videoClick === 'select' ? (slot, e) => tileDrag.start(slot, e, { canDrag: true }) : undefined}
            stageRef={stageRef}
            slotEls={slotEls}
            dragging={dragging || tileDrag.drag !== null || cardDrag}
            floating={
              tileDrag.drag && state.slots[tileDrag.drag.from]
                ? {
                    slot: tileDrag.drag.from,
                    x: tileDrag.drag.x,
                    y: tileDrag.drag.y,
                    // 방송을 후원 페이지·채팅·시그니처 칸 위로 끌 때: Shift로 고정할 수 있다고 알려 준다
                    name:
                      tileDrag.drag.over !== null && isStream(state.slots[tileDrag.drag.from]) && isPinnable(state.slots[tileDrag.drag.over])
                        ? tileDrag.drag.shift
                          ? `${state.slots[tileDrag.drag.from]!.name} · 이 방송에 고정`
                          : `${state.slots[tileDrag.drag.from]!.name} · Shift를 누르면 고정`
                        : state.slots[tileDrag.drag.from]!.name,
                  }
                : null
            }
            settling={settling}
            onReady={(key, h) => setHandles((prev) => ({ ...prev, [key]: h }))}
            onStatus={onStreamStatus}
            onStarting={onStreamStarting}
            onItemMenu={openVideoMenu}
            starting={startingKeys}
            renderOverlay={endedOverlay}
            renderControls={pauseControl}
            reloadSeq={reloadSeq}
            tileSeq={tileSeq}
            renderPage={(page, key) =>
              page.kind === 'signature' ? (
                <SignatureView creator={targetOf(page)} load={loadSignatures} onPick={(s) => donateSignature(s, targetOf(page))} />
              ) : page.kind === 'activity' ? (
                <ActivityWidget
                  loggedIn={loggedIn}
                  live={activityLive}
                  timeline={buildTimeline(watchLog, loggedIn ? history : null, settingsLog)}
                  isLive={activityIsLive}
                  now={Math.max(clock, Date.now())}
                  onOpen={(creator) => dispatch({ type: 'openFirst', creator })}
                  onLogin={toonation.login}
                />
              ) : (
                <PageView
                  page={page}
                  url={pageUrl(page)}
                  embed={embed}
                  onHandle={(h) => {
                    if (h) pageHandles.current[key] = h;
                    else delete pageHandles.current[key];
                  }}
                  onOpenWindow={targetOf(page) ? () => donateTo(targetOf(page)!) : undefined}
                  emptyText={pageEmptyText(page)}
                />
              )
            }
          />
        </div>
        {settings.quickPanel === 'right' && quickPanel}
      </div>
      {!creatorMode && (
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
      )}
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
          filter={inGroup}
          rowExtra={groupSelect}
          source={favorites}
          onClose={() => setPickerSlot(null)}
          tabs={[
            {
              label: '투네이션 라이브',
              content: (
                <LiveTab
                  load={liveSource}
                  favoriteTags={loggedIn ? favoriteTags : undefined}
                  onToggleFavorite={loggedIn ? toggleToonFavorite : undefined}
                  onPick={(creator) => {
                    dispatch({ type: 'assign', slot: pickerSlot, creator });
                    setPickerSlot(null);
                  }}
                />
              ),
            },
            { label: '활동 위젯', content: <ActivityPageTab onPick={pickPage} /> },
            { label: '후원 페이지', content: <DonatePageTab desktop={!!desktop} onPick={pickPage} /> },
            { label: '시그니처', content: <SignaturePageTab onPick={pickPage} /> },
            { label: '채팅', content: <ChatPageTab desktop={!!desktop} onPick={pickPage} /> },
            { label: '웹페이지', content: <WebPageTab desktop={!!desktop} onPick={pickPage} /> },
          ]}
          onPick={(creator) => {
            dispatch({ type: 'assign', slot: pickerSlot, creator });
            setPickerSlot(null);
          }}
        >
          <GroupBar groups={groups} active={activeGroup} onActive={setActiveGroup} editing={editGroups} onEditing={setEditGroups} />
          {toonStatus !== 'no-extension' && (
            <SearchSection
              search={async (q) => favoritesFromToonation(await bridge.request<ToonationFavorite[]>('search', q))}
              onLogin={toonation.login}
              onPick={(creator) => {
                dispatch({ type: 'assign', slot: pickerSlot, creator });
                setPickerSlot(null);
              }}
            />
          )}
          <ToonationSection
            filter={inGroup}
            rowExtra={groupSelect}
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
      {liveOpen && (
        <RecommendLiveDialog onClose={() => setLiveOpen(false)} dragging={cardDrag}>
          <RecommendLive
            loadPopular={popularSource}
            load={liveSource}
            favoriteTags={loggedIn ? favoriteTags : undefined}
            onToggleFavorite={loggedIn ? toggleToonFavorite : undefined}
            onPick={setLivePick}
          />
        </RecommendLiveDialog>
      )}
      {skinMenu && (
        <ContextMenu
          x={skinMenu.x}
          y={skinMenu.y}
          label="스킨"
          onClose={closeSkinMenu}
          items={SKINS.map((k) => ({ label: k.label, icon: settings.skin === k.id ? '✓' : '', hint: settings.skin === k.id ? '사용 중' : undefined, onSelect: () => changeSettings({ skin: k.id }) }))}
        />
      )}
      {videoMenu && isStream(state.slots[videoMenu.slot]) && (
        <ContextMenu
          x={videoMenu.x}
          y={videoMenu.y}
          label="영상 메뉴"
          onClose={closeVideoMenu}
          items={(() => {
            const slot = videoMenu.slot;
            const k = keys[slot];
            const on = audible[slot];
            return [
              {
                label: on ? '소리 끄기' : '소리 켜기',
                icon: on ? '🔇' : '🔊',
                onSelect: () => {
                  if (mix && k) {
                    if (!on && !state.soundOn) dispatch({ type: 'toggleSound' });
                    setMixMuted((m) => ({ ...m, [k]: on }));
                  } else if (on) dispatch({ type: 'toggleSound' }); // 이 칸만 소리가 나므로 전체 소리 끄기
                  else {
                    dispatch({ type: 'select', slot }); // 이 칸 소리로
                    if (!state.soundOn) dispatch({ type: 'toggleSound' });
                  }
                },
              },
              { label: '전체 화면', icon: '⛶', onSelect: () => enterFullscreen(slot) },
              { label: '새 창으로 분리', icon: '⧉', onSelect: () => detachSlot(slot) },
              {
                label: '창 닫기',
                icon: '✕',
                danger: true,
                onSelect: () => {
                  // 방송을 내리고, 줄일 수 있으면 그 창도 닫는다
                  const cleared = { ...state, slots: state.slots.map((s, i) => (i === slot ? null : s)) };
                  dispatch({ type: 'clear', slot });
                  if (shrinkLayout(cleared, slot)) dispatch({ type: 'removeWindow', slot });
                  setHandles((prev) => Object.fromEntries(Object.entries(prev).filter(([hk]) => hk !== k)));
                },
              },
            ];
          })()}
        />
      )}
      {emptyMenu && (
        <ContextMenu
          x={emptyMenu.x}
          y={emptyMenu.y}
          label="빈 창 메뉴"
          onClose={closeEmptyMenu}
          items={[
            { label: '불러오기', icon: '▶', onSelect: () => setPickerSlot(emptyMenu.slot) },
            { label: '창 추가', icon: '+', hint: growTo.length ? undefined : '9분할', disabled: !growTo.length, onSelect: () => setAddOpen(true) },
            {
              label: '창 닫기',
              icon: '✕',
              danger: true,
              hint: shrinkLayout(state, emptyMenu.slot) ? undefined : '줄일 수 없음',
              disabled: !shrinkLayout(state, emptyMenu.slot),
              onSelect: () => dispatch({ type: 'removeWindow', slot: emptyMenu.slot }),
            },
          ]}
        />
      )}
      {addOpen && growTo.length > 0 && (
        <AddWindowDialog
          layouts={growTo}
          onClose={() => setAddOpen(false)}
          onPick={(layout, at) => {
            dispatch({ type: 'addWindow', layout, at });
            setAddOpen(false);
          }}
        />
      )}
      {livePick && (
        <SlotPickerDialog
          layout={state.layout}
          slots={visibleSlots(state)}
          name={livePick.name}
          onClose={() => setLivePick(null)}
          onPick={(slot) => {
            dispatch({ type: 'assign', slot, creator: livePick });
            setLivePick(null);
            setLiveOpen(false);
          }}
        />
      )}
      {pinSlot !== null && isPinnable(state.slots[pinSlot]) && (
        <PinDialog
          streams={visibleSlots(state).flatMap((s, i) => (isStream(s) ? [{ slot: i, creator: s }] : []))}
          current={(state.slots[pinSlot] as { pin?: Creator }).pin?.key ?? null}
          onPick={(c) => {
            dispatch({ type: 'pinPage', slot: pinSlot, creator: c });
            setPinSlot(null);
          }}
          onClose={() => setPinSlot(null)}
        />
      )}
      {guideOpen && <Onboarding onDone={closeGuide} />}
      {pendingBackup && <BackupConfirmDialog summary={pendingBackup.summary} onConfirm={() => void confirmBackup()} onClose={() => setPendingBackup(null)} />}
      {keysOpen && <ShortcutsDialog enabled={settings.shortcuts} onClose={closeKeys} />}
      {helpOpen && (
        <HelpDialog
          onClose={closeHelp}
          onShortcuts={() => {
            setHelpOpen(false);
            setKeysOpen(true);
          }}
          onTour={() => {
            setHelpOpen(false);
            setGuideOpen(true);
          }}
          onOpenSite={() => win.open(SUPPORT_URL, '_blank', 'noopener')}
        />
      )}
      {historyOpen && (
        <HistoryDialog
          load={loadHistory}
          cash={typeof toonation.state.account?.cash === 'number' ? toonation.state.account.cash : null}
          monthlyLimit={settings.monthlyLimit}
          monthlyGoal={settings.monthlyGoal}
          onDonate={(tag, name) => {
            setHistoryOpen(false);
            // 내역의 크리에이터: 후원 아이디로 후원창만 연다 (방송 채널은 모른다)
            donateTo({ key: `toonation-tag:${tag}`, name: name.slice(0, 30), donateId: tag, platform: 'twitch', channel: '', source: 'toonation' });
          }}
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
          toonationAccount={toonation.state.account?.name ?? null}
          onLogout={toonation.logout}
          favorites={favorites}
          onExportFavorites={exportFavorites}
          onExportBackup={exportAll}
          onImportBackup={importAll}
          onShowGuide={() => {
            setSettingsOpen(false);
            setGuideOpen(true);
          }}
          onClose={() => setSettingsOpen(false)}
          app={
            desktop?.appInfo
              ? {
                  info: appInfo,
                  onSet: (key, value) => {
                    setAppInfo((i) => i && { ...i, options: { ...i.options, [key]: value } });
                    desktop.setAppOption?.(key, value);
                  },
                  onCheck: () => desktop.checkUpdate?.(),
                  onInstall: () => desktop.installUpdate?.(),
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
