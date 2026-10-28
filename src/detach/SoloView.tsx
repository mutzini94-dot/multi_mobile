import { useEffect, useMemo, useRef, useState } from 'react';
import { donatePageUrl, isStream } from '../domain/pages';
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
  const [onTop, setOnTop] = useState(false);
  const [player, setPlayer] = useState<PlayerHandle | null>(null);
  const page = useRef<PageHandle | null>(null);

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
        if (m.type === 'donateFor') setDonateFor(m.creator ? loadCreator(m.creator) ?? null : null);
      }),
    [link],
  );

  const title = isStream(item) ? item.name : item.kind === 'donate' ? (donateFor ? `${donateFor.name} 후원 페이지` : '후원 페이지') : item.name;
  useEffect(() => {
    document.title = `${title} · 멀티뷰 후원`;
  }, [title]);

  const barButton = (label: string, text: string, fn: () => void, on = false) => (
    <button type="button" className={`sound${on ? ' sound--on' : ''}`} aria-label={label} title={label} onClick={fn}>
      {text}
    </button>
  );

  return (
    <div className="solo">
      <div className="tile__bar solo__bar">
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
            url={item.kind === 'web' ? item.url : donateFor ? donatePageUrl(donateFor) : null}
            embed={desktop ? 'webview' : 'iframe'}
            onHandle={(h) => (page.current = h)}
            onOpenWindow={donateFor ? () => openDonationPopup(donateFor, window) : undefined}
          />
        )}
      </div>
    </div>
  );
}
