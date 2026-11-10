import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { safeStorage } from '../../src/storage/safeStorage';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));
// 안드로이드 앱(Capacitor)인 것처럼: 휴대폰 뒤로가기 리스너를 붙잡아 직접 부른다
const back: { fn: (() => void) | null } = { fn: null };
const minimizeApp = vi.fn(async () => {});
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true }, registerPlugin: () => ({}) }));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (_e: string, fn: () => void) => {
      back.fn = fn;
      return Promise.resolve({ remove: () => (back.fn = null) });
    },
    minimizeApp: () => minimizeApp(),
  },
}));

function mockPhone() {
  window.matchMedia = ((q: string) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

function setup() {
  mockPhone();
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  const tile = document.querySelectorAll<HTMLElement>('.tile')[0];
  fireEvent.click(within(tile).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: /^A ·/ }));
}
const press = () => act(() => back.fn?.());

test('앱에서 휴대폰 뒤로가기: 전체 화면 → 원래 화면, 채팅 → 닫기, 전체보기 → 닫기, 아무것도 없으면 앱을 뒤로 보낸다', () => {
  setup();
  expect(back.fn).not.toBeNull();
  fireEvent.click(within(document.querySelectorAll<HTMLElement>('.tile')[0]).getByRole('button', { name: '전체 화면' }));
  expect(screen.getByRole('region', { name: 'A 전체 화면' })).toBeInTheDocument();
  press();
  expect(screen.queryByRole('region', { name: 'A 전체 화면' })).toBeNull();
  expect(minimizeApp).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '채팅' }));
  expect(screen.getByRole('dialog', { name: 'A 채팅' })).toBeInTheDocument();
  press();
  expect(screen.queryByRole('dialog', { name: 'A 채팅' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '전체보기' }));
  press();
  expect(document.querySelector('.app')).not.toHaveClass('app--overview');
  press();
  expect(minimizeApp).toHaveBeenCalledTimes(1);
});

test('영상 플레이어 자체 전체 화면(유튜브 ⛶)에서 뒤로가기: 앱을 끄지 않고 전체 화면만 나간다', () => {
  setup();
  minimizeApp.mockClear();
  const exitFullscreen = vi.fn(() => Promise.resolve());
  Object.defineProperty(document, 'fullscreenElement', { value: document.querySelector('.player-layer__item'), configurable: true });
  Object.defineProperty(document, 'exitFullscreen', { value: exitFullscreen, configurable: true });
  try {
    press();
    expect(exitFullscreen).toHaveBeenCalled();
    expect(minimizeApp).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  }
});
