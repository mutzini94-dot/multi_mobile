import { fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { mkCreator } from '../helpers/fixtures';
import type { ToonationBridge } from '../../src/toonation/bridge';

const mounts: string[] = [];
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator }: { creator: { key: string } }) => {
    useEffect(() => {
      mounts.push(creator.key);
    }, [creator.key]);
    return <div data-testid={`player-${creator.key}`} />;
  },
}));

const noBridge: ToonationBridge = { request: () => Promise.reject(new Error('NO_EXTENSION')) };

test('레이아웃을 바꿔도 남아 있는 칸의 플레이어는 다시 마운트되지 않는다', () => {
  mounts.length = 0;
  const kv = safeStorage(undefined);
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://x/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} />);
  const tiles = () => document.querySelectorAll('.tile');
  fireEvent.click(within(tiles()[0] as HTMLElement).getByRole('button', { name: '불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: /^A ·/ }));
  expect(mounts).toEqual(['twitch:chan_1']);
  fireEvent.click(screen.getByRole('button', { name: '1+2' }));
  fireEvent.click(screen.getByRole('button', { name: '2분할' }));
  fireEvent.click(screen.getByRole('button', { name: '4분할' }));
  expect(mounts).toEqual(['twitch:chan_1']);
  expect(screen.getAllByTestId('player-twitch:chan_1')).toHaveLength(1);
});

test('레이아웃을 줄여 칸이 사라지면 그 플레이어도 사라진다', () => {
  const kv = safeStorage(undefined);
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(4, { name: 'D' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://x/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} />);
  const tiles = () => document.querySelectorAll('.tile');
  fireEvent.click(within(tiles()[3] as HTMLElement).getByRole('button', { name: '불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: /^D ·/ }));
  expect(screen.getByTestId('player-twitch:chan_4')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '2분할' }));
  expect(screen.queryByTestId('player-twitch:chan_4')).toBeNull();
});
