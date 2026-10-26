import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Creator } from '../domain/types';
import { markConfirmed, needsConfirm } from '../donate/confirmations';
import { donationWarning, openDonationPopup } from '../donate/donation';
import { localFavorites, type FavoritesSource } from '../favorites/favorites';
import type { PlayerHandle } from '../players/types';
import { useAudioFocus } from '../players/useAudioFocus';
import { buildShareUrl, decodeShare } from '../share/shareLink';
import { createBridge, type ToonationBridge } from '../toonation/bridge';
import { useToonation } from '../toonation/useToonation';
import { ToonationSection } from '../ui/ToonationSection';
import { safeStorage, type KV } from '../storage/safeStorage';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DonationBar } from '../ui/DonationBar';
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
  const bridge = useMemo(() => props.bridge ?? createBridge(window), [props.bridge]);
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
  const [popupCreator, setPopupCreator] = useState<Creator | null>(null);
  const [popupClosed, setPopupClosed] = useState(true);
  const popupRef = useRef<Window | null>(null);

  // 플레이어 핸들: 칸 번호 + 크리에이터 키로 구분해, 칸 내용이 바뀌면 이전 핸들을 버린다
  const [handles, setHandles] = useState<Record<string, PlayerHandle>>({});
  const handleKey = (slot: number, c: Creator) => `${slot}:${c.key}`;
  const handleList = useMemo(
    () => state.slots.map((c, i) => (c ? handles[handleKey(i, c)] ?? null : null)),
    [state.slots, handles],
  );
  useAudioFocus(handleList, state.selected, state.soundOn);

  const selectedCreator = state.selected !== null ? state.slots[state.selected] ?? null : null;

  // 사용자가 팝업을 직접 닫았는지 주기적으로 확인한다
  useEffect(() => {
    if (!popupCreator) return;
    const id = setInterval(() => setPopupClosed(!popupRef.current || popupRef.current.closed), POPUP_POLL_MS);
    return () => clearInterval(id);
  }, [popupCreator]);

  // 불러오기 창을 열 때 투네이션 즐겨찾기를 (아직 없으면) 불러온다
  const { refresh: refreshToonation } = toonation;
  const toonStatus = toonation.state.status;
  useEffect(() => {
    if (pickerSlot !== null && (toonStatus === 'idle' || toonStatus === 'no-extension')) refreshToonation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerSlot]);

  const warning = donationWarning(popupCreator, popupClosed, selectedCreator);

  const openPopup = useCallback(
    (c: Creator) => {
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
    [win],
  );

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
    <div className="app">
      <Gnb
        layout={state.layout}
        onLayout={(layout) => dispatch({ type: 'setLayout', layout })}
        canDonate={!!selectedCreator}
        onDonate={onDonate}
        onShare={onShare}
        sharedMode={!!boot.shared}
        onRestore={() => boot.shared && dispatch({ type: 'replace', state: boot.shared })}
      />
      <TileGrid
        state={state}
        onSizes={(group, sizes) => dispatch({ type: 'setSizes', group, sizes })}
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
              onReady={(h) => creator && setHandles((prev) => ({ ...prev, [handleKey(slot, creator)]: h }))}
              onAddFavorite={() => {
                if (!creator) return;
                favorites.add(creator);
                setMessage(`${creator.name}을(를) 즐겨찾기에 추가했습니다`);
              }}
            />
          );
        }}
      />
      <DonationBar popupCreator={popupClosed ? null : popupCreator} warning={warning} message={message} />
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
