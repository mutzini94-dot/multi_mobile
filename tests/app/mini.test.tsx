import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { DesktopApi } from '../../src/desktop/desktopApi';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup(desktop: Partial<DesktopApi> | null = null) {
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const d = desktop
    ? ({
        status: vi.fn().mockResolvedValue({ ok: true, data: { account: null } }),
        favorites: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        openDonate: vi.fn(),
        onDonateClosed: () => () => {},
        onDonateMode: () => () => {},
        setAlwaysOnTop: vi.fn(),
        ...desktop,
      } as unknown as DesktopApi)
    : null;
  render(<App favorites={favorites} kv={kv} win={win} bridge={d ? undefined : noBridge} desktop={d} />);
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};

test('미니 모드: 선택한 방송 하나만 보이고 상단 메뉴는 숨긴다, 끝내면 원래대로', () => {
  setup();
  pick(0, 'A');
  pick(1, 'B'); // B 선택
  expect(screen.getByRole('button', { name: '미니 모드' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '미니 모드' }));
  expect(document.querySelector('.app')).toHaveClass('app--mini');
  expect(screen.getByRole('region', { name: 'B 미니 모드' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '미니 모드 끝' }));
  expect(document.querySelector('.app')).not.toHaveClass('app--mini');
  expect(screen.queryByRole('region', { name: /미니 모드/ })).toBeNull();
});

test('미니 모드: 방송이 없으면 버튼이 없다', () => {
  setup();
  expect(screen.queryByRole('button', { name: '미니 모드' })).toBeNull();
});

test('설치형 미니 모드: 앱 창을 작게·항상 위로, 끝내면 되돌린다 (Esc로도)', () => {
  const setMiniMode = vi.fn();
  setup({ setMiniMode });
  pick(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: '미니 모드' }));
  expect(setMiniMode).toHaveBeenLastCalledWith(true);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(setMiniMode).toHaveBeenLastCalledWith(false);
  expect(document.querySelector('.app')).not.toHaveClass('app--mini');
});
