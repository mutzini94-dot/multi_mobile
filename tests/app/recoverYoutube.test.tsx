import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { LivePage, LiveQuery } from '../../src/toonation/liveList';
import type { StreamStatus } from '../../src/players/types';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

// 채널 라이브 임베드(영상 ID 없음)는 '재생할 수 없음', 영상 ID가 있으면 재생된다고 흉내
const mounts: (string | undefined)[] = [];
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator, onStatus }: { creator: { platform: string; videoId?: string }; onStatus?(s: StreamStatus): void }) => {
    useEffect(() => {
      mounts.push(creator.videoId);
      if (creator.platform === 'youtube') onStatus?.(creator.videoId ? 'live' : 'unavailable');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="player" />;
  },
}));

const CH = 'UCyyyyyyyyyyyyyyyyyyyyyy';
const yt = mkCreator(1, { name: 'Y', key: `youtube:${CH}`, platform: 'youtube', channel: CH });

function setup(found: string | null) {
  mounts.length = 0;
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(yt);
  const lives = vi.fn(
    async (_q: LiveQuery): Promise<LivePage> => ({
      items: found ? [{ creator: { ...yt, source: 'toonation', videoId: found, live: { title: '라이브', viewers: 10 } }, thumbnail: '', category: '' }] : [],
      page: 1,
      totalPages: 1,
      total: found ? 1 : 0,
    }),
  );
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} lives={lives} popular={async () => ({ groups: [], top: [] })} />);
  const tile = document.querySelectorAll<HTMLElement>('.tile')[0];
  fireEvent.click(within(tile).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: /^Y ·/ }));
  return { lives };
}

test('유튜브 채널 임베드가 재생되지 않으면 투네이션 라이브 목록의 영상 ID로 다시 띄운다', async () => {
  const { lives } = setup('LIVEVIDEO01');
  await act(async () => {});
  await act(async () => {});
  expect(lives).toHaveBeenCalledWith(expect.objectContaining({ q: 'Y', platform: 'youtube' }));
  expect(mounts).toEqual([undefined, 'LIVEVIDEO01']);
  expect(screen.queryByText('재생할 수 없는 방송')).toBeNull();
});

test('라이브 목록에도 없으면(방송 중이 아님) 재생할 수 없다고 알린다', async () => {
  setup(null);
  await act(async () => {});
  await act(async () => {});
  expect(screen.getByText('재생할 수 없는 방송')).toBeInTheDocument();
  expect(screen.getByText('지금 방송 중이 아니거나 다른 사이트에서 볼 수 없는 방송입니다')).toBeInTheDocument();
});
