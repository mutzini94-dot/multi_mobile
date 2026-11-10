import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { SETTINGS_KEY } from '../../src/settings/settings';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

const paused: Record<string, boolean> = {};
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator, onReady }: { creator: { name: string }; onReady(h: unknown): void }) => {
    useEffect(() => {
      onReady({ setMuted() {}, isMuted: () => true, setPaused: (p: boolean) => (paused[creator.name] = p), setLowQuality() {} });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="player" />;
  },
}));

function setup(settings: Record<string, unknown>) {
  const kv = quadKv();
  kv.set(SETTINGS_KEY, JSON.stringify({ ...JSON.parse(kv.get(SETTINGS_KEY) ?? '{}'), ...settings }));
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  const pick = (slot: number, name: string) => {
    fireEvent.click(within(document.querySelectorAll<HTMLElement>('.tile')[slot]).getByRole('button', { name: '불러오기' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
  };
  pick(0, 'A');
  pick(1, 'B'); // B 선택
}

afterEach(() => {
  for (const k of Object.keys(paused)) delete paused[k];
  Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
});

test('데이터 절약(항상): 선택한 창만 재생하고 나머지는 멈춘다', () => {
  setup({ dataSaver: 'on' });
  expect(paused.A).toBe(true);
  expect(paused.B).not.toBe(true);
});

test('데이터 절약 끔: 다른 창도 그대로 재생', () => {
  setup({ dataSaver: 'off' });
  expect(paused.A).not.toBe(true);
});

test('화면 꺼짐 방지: 방송이 보이면 화면을 켜 둔다', async () => {
  const request = vi.fn(() => Promise.resolve({ release: () => Promise.resolve() }));
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  setup({});
  await act(async () => {});
  expect(request).toHaveBeenCalledWith('screen');
});
