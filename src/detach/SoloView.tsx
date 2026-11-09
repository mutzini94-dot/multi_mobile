import { useEffect, useMemo, useRef, useState } from 'react';
import { chatUrl, donatePageUrl, isStream } from '../domain/pages';
import type { Creator } from '../domain/types';
import type { DesktopApi } from '../desktop/desktopApi';
import { openDonationPopup } from '../donate/donation';
import { StreamPlayer } from '../players/StreamPlayer';
import type { PlayerHandle } from '../players/types';
import { useSettings } from '../settings/settings';
import { safeStorage, type KV } from '../storage/safeStorage';
import { PageView, type PageHandle } from '../ui/PageView';
import type { SoloLink } from './channel';
import { loadCreator, type SoloPayload } from './soloLink';

interface Props {
  payload: SoloPayload;
  link: SoloLink;
  desktop: DesktopApi | null;
  kv?: KV;
}

function readStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * 분리 창: 칸 하나(방송·후원 페이지·웹페이지)를 창 전체에 보여 준다.
 * 되돌리기·후원하기는 메인 화면에 알리고, 후원 페이지는 메인 화면에서 고른 크리에이터를 따라간다.
 */
export function SoloView({ payload, link, desktop, kv: kvProp }: Props) {
  const kv = useMemo(() => kvProp ?? safeStorage(readStorage()), [kvProp]);
  const [settings] = useSettings(kv); // 메인 화면과 같은 설정 (테마·기본 볼륨)
  const { item } = payload;
  const [soundOn, setSoundOn] = useState(payload.sound);
  const [donateFor, setDonateFor] = useState<Creator | null>(payload.donateFor ?? null);
  const [videoId, setVideoId] = useState<string | null>(payload.videoId ?? null); // 채팅 칸: 유튜브 라이브 영상 ID
  const [onTop, setOnTop] = useState(false);
  const [player, setPlayer] = useState<PlayerHandle | null>(null);
  const page = useRef<PageHandle | null>(null);
  // 위쪽 바를 끌어 창 밖(메인 창의 칸)에 놓기 (설치형). 버튼을 누른 것은 끌기가 아니다
  const [drag, setDrag] = useState<{ x0: number; y0: number; started: boolean; out: boolean } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging || !desktop?.dragEnd) return;
    const outside = (x: number, y: number) => x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const started = d.started || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) >= 6;
      if (!started) return;
      desktop.dragMove?.(e.clientX, e.clientY);
      setDrag({ ...d, started, out: outside(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d?.started && outside(e.clientX, e.clientY)) void desktop.dragEnd?.(e.clientX, e.clientY);
      setDrag(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const d = dragRef.current;
      if (d?.started) desktop.dragMove?.(d.x0, d.y0); // 메인 창 강조 지우기
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
    };
  }, [dragging, desktop]);
  const startDrag = (e: React.PointerEvent) => {
    if (!desktop?.dragEnd || e.button > 0 || (e.target as Element).closest('button')) return;
    e.preventDefault();
    setDrag({ x0: e.clientX, y0: e.clientY, started: false, out: false });
  };

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);
  useEffect(() => {
    player?.setMuted(!soundOn);
    player?.setVolume?.(settings.masterVolume);
  }, [player, soundOn, settings.masterVolume]);
  useEffect(
    () =>
      link.onMessage((m) => {
        // 메인 화면이 보낸 값도 다시 확인한다
        if (m.type !== 'donateFor') return;
        setDonateFor(m.creator ? loadCreator(m.creator) ?? null : null);
        setVideoId(typeof m.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(m.videoId) ? m.videoId : null);
      }),
    [link],
  );

  const title = isStream(item)
    ? item.name
    : (item.kind === 'donate' || item.kind === 'chat') && donateFor
      ? `${donateFor.name} ${item.kind === 'donate' ? '후원 페이지' : '채팅'}`
      : item.name;
  const embed = desktop ? 'webview' : 'iframe';
  useEffect(() => {
    document.title = `${title} · 투네이션 후원 브라우저`;
  }, [title]);

  const barButton = (label: string, text: string, fn: () => void, on = false) => (
    <button type="button" className={`sound${on ? ' sound--on' : ''}`} aria-label={label} title={label} onClick={fn}>
      {text}
    </button>
  );

  return (
    <div className={`solo${drag?.started ? ' solo--dragging' : ''}`}>
      {drag?.started && drag.out && (
        <div className="solo__drag-hint" role="status" aria-label="창 끌기">
          메인 창의 칸에 놓으면 그 칸으로 돌아갑니다
        </div>
      )}
      <div className="tile__bar solo__bar" onPointerDown={startDrag} title={desktop?.dragEnd ? '끌어서 메인 창의 칸에 놓기' : undefined}>
        <span className="tile__name">{title}</span>
        <span className="tile__bar-gap" />
        {isStream(item) && barButton(soundOn ? '소리 끄기' : '소리 켜기', soundOn ? '🔊' : '🔇', () => setSoundOn((v) => !v), soundOn)}
        {!isStream(item) && item.kind !== 'detached' && (
          <>
            {barButton('뒤로', '←', () => page.current?.back())}
            {barButton('새로고침', '⟳', () => page.current?.reload())}
          </>
        )}
        {desktop?.soloSetAlwaysOnTop &&
          barButton(
            '항상 위에 표시',
            '📌',
            () => {
              desktop.soloSetAlwaysOnTop?.(!onTop);
              setOnTop(!onTop);
            },
            onTop,
          )}
        {isStream(item) && (
          <button type="button" className="btn btn--donate btn--sm" onClick={() => link.post({ type: 'donate' })}>
            후원하기
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--sm solo__return" onClick={() => link.post({ type: 'return' })}>
          되돌리기
        </button>
      </div>
      <div className="solo__body">
        {isStream(item) ? (
          <StreamPlayer creator={item} onReady={setPlayer} />
        ) : item.kind === 'detached' ? null : (
          <PageView
            page={item}
            url={
              item.kind === 'web'
                ? item.url
                : !donateFor
                  ? null
                  : item.kind === 'donate'
                    ? donatePageUrl(donateFor)
                    : chatUrl(donateFor, donateFor.videoId ?? videoId, embed, window.location.hostname)
            }
            embed={embed}
            emptyText={item.kind === 'chat' ? '채팅을 볼 방송이 없습니다' : undefined}
            onHandle={(h) => (page.current = h)}
            onOpenWindow={donateFor ? () => openDonationPopup(donateFor, window) : undefined}
          />
        )}
      </div>
    </div>
  );
}
