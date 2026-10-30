import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

test('상단 전체 음소거: 모든 칸 소리를 끄고, 다시 누르면 켠다 (M 단축키와 같은 상태)', () => {
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  const tile = () => document.querySelectorAll<HTMLElement>('.tile')[0];
  fireEvent.click(within(tile()).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: /^A ·/ }));
  expect(within(tile()).getByRole('button', { name: '소리 끄기' })).toBeInTheDocument(); // 선택한 칸 소리 켜짐

  fireEvent.click(screen.getByRole('button', { name: '전체 음소거' }));
  expect(within(tile()).getByRole('button', { name: '소리 켜기' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '음소거 해제' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: '음소거 해제' }));
  expect(within(tile()).getByRole('button', { name: '소리 끄기' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'm' });
  expect(screen.getByRole('button', { name: '음소거 해제' })).toBeInTheDocument();
});
