import { fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from '../../src/settings/settings';
import { safeStorage } from '../../src/storage/safeStorage';
import type { PlayerHandle } from '../../src/players/types';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

type Fake = PlayerHandle & { muted: boolean; volume: number | null; paused: boolean; low: boolean };
const fakes: Record<string, Fake> = {};
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator, onReady }: { creator: { key: string }; onReady: (h: PlayerHandle) => void }) => {
    useEffect(() => {
      const h: Fake = {
        muted: true, volume: null, paused: false, low: false,
        setMuted(m) { h.muted = m; }, isMuted: () => h.muted,
        setVolume(v) { h.volume = v; }, setPaused(p) { h.paused = p; }, setLowQuality(l) { h.low = l; },
      };
      fakes[creator.key] = h;
      onReady(h);
      // 실제 플레이어처럼 준비 알림은 방송마다 한 번 (onReady는 렌더링마다 새로 만들어진다)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [creator.key]);
    return <div />;
  },
}));

const noBridge: ToonationBridge = { request: () => Promise.reject(new Error('NO_EXTENSION')) };
const A = 'twitch:chan_1';
const B = 'twitch:chan_2';

function setup(settings: Partial<Settings> = {}) {
  for (const k of Object.keys(fakes)) delete fakes[k];
  const kv = quadKv();
  kv.set(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, defaultLayout: 'quad', ...settings }));
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://x/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
}
const tile = (i: number) => document.querySelectorAll('.tile')[i] as HTMLElement;
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tile(slot)).getByRole('button', { name: '불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name} ·`) }));
};

test('선택한 창만 소리 (기본) + 기본 볼륨', () => {
  setup({ masterVolume: 60 });
  pick(0, 'A');
  pick(1, 'B'); // B 선택
  expect(fakes[B].muted).toBe(false);
  expect(fakes[A].muted).toBe(true);
  expect(fakes[B].volume).toBe(60);
});

test('여러 창 동시 듣기: 창마다 소리 켜기/끄기와 볼륨', () => {
  setup({ soundMode: 'mix', masterVolume: 70 });
  pick(0, 'A');
  pick(1, 'B');
  expect(fakes[A].muted).toBe(false);
  expect(fakes[B].muted).toBe(false);
  expect(fakes[A].volume).toBe(70);
  fireEvent.change(within(tile(0)).getByLabelText('A 볼륨'), { target: { value: '25' } });
  expect(fakes[A].volume).toBe(25);
  expect(fakes[B].volume).toBe(70);
  fireEvent.click(within(tile(1)).getByRole('button', { name: '소리 끄기' }));
  expect(fakes[B].muted).toBe(true);
  expect(fakes[A].muted).toBe(false);
  expect(tile(0)).not.toHaveClass('tile--selected') ; // 소리 버튼은 선택을 바꾸지 않는다 (B가 선택된 상태 유지)
});

test('숨긴 창 정지(기본, 가볍게): 레이아웃을 줄이면 정지, 다시 보이면 재생', () => {
  setup();
  pick(3, 'A');
  expect(fakes[A].paused).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '2분할' }));
  expect(fakes[A].paused).toBe(true);
  expect(fakes[A].muted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '4분할' }));
  expect(fakes[A].paused).toBe(false);
});

test('숨긴 창 계속 재생으로 바꾸면 정지하지 않는다', () => {
  setup({ hiddenSlotPlayback: 'keep' });
  pick(3, 'A');
  fireEvent.click(screen.getByRole('button', { name: '2분할' }));
  expect(fakes[A].paused).toBe(false);
});

test('선택하지 않은 창은 낮은 화질 (기본, 가볍게)', () => {
  setup();
  pick(0, 'A');
  pick(1, 'B'); // B 선택
  expect(fakes[A].low).toBe(true);
  expect(fakes[B].low).toBe(false);
  fireEvent.click(within(tile(0)).getByText('A'));
  expect(fakes[A].low).toBe(false);
  expect(fakes[B].low).toBe(true);
});
