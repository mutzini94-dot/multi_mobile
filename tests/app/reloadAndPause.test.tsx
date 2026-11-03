import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { Creator } from '../../src/domain/types';
import type { PlayerHandle } from '../../src/players/types';
import { mkCreator } from '../helpers/fixtures';

const mounts: string[] = [];
const handles: Record<string, PlayerHandle & { paused: boolean }> = {};
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator, onReady }: { creator: Creator; onReady(h: PlayerHandle): void }) => {
    useEffect(() => {
      mounts.push(creator.name);
      const h = {
        paused: false,
        setMuted: vi.fn(),
        isMuted: () => true,
        setPaused: vi.fn((p: boolean) => {
          h.paused = p;
        }),
        isPaused: () => h.paused,
      };
      handles[creator.name] = h;
      onReady(h);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 실제 플레이어처럼 띄울 때 한 번만
    return <div data-testid="player" />;
  },
}));

function setup() {
  mounts.length = 0;
  const kv = safeStorage(undefined);
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: '트위치방송', platform: 'twitch', channel: 'tw_one' }));
  favorites.add(mkCreator(2, { name: '유튜브방송', platform: 'youtube', key: 'youtube:UCaaaaaaaaaaaaaaaaaaaaaa', channel: 'UCaaaaaaaaaaaaaaaaaaaaaa' }));
  const request = vi.fn(async () => {
    throw new Error('NOT_LOGGED_IN');
  });
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} />);
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};

test('전체 새로고침: 모든 칸의 플레이어를 다시 띄운다', () => {
  setup();
  pick(0, '트위치방송');
  pick(1, '유튜브방송');
  expect(mounts).toEqual(['트위치방송', '유튜브방송']);
  act(() => fireEvent.click(screen.getByRole('button', { name: '전체 새로고침' })));
  expect(mounts.slice(2).sort()).toEqual(['유튜브방송', '트위치방송']);
  expect(screen.getAllByTestId('player')).toHaveLength(2);
});

test('트위치 칸: 일시정지·재생 버튼 (유튜브는 플레이어 자체 버튼을 쓴다)', () => {
  setup();
  pick(0, '트위치방송');
  pick(1, '유튜브방송');
  fireEvent.click(screen.getByRole('button', { name: '트위치방송 일시정지' }));
  expect(handles['트위치방송'].setPaused).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: '트위치방송 재생' }));
  expect(handles['트위치방송'].setPaused).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole('button', { name: /유튜브방송 (일시정지|재생)/ })).toBeNull();
});

test('트위치 플레이어 자체 버튼으로 멈췄어도 실제 상태를 따라 재생으로 토글한다', () => {
  setup();
  pick(0, '트위치방송');
  handles['트위치방송'].paused = true; // 플레이어 안에서 직접 멈춤
  fireEvent.click(screen.getByRole('button', { name: /트위치방송 (일시정지|재생)/ }));
  expect(handles['트위치방송'].setPaused).toHaveBeenLastCalledWith(false);
});

test('트위치가 재생 요청을 무시하면(웹 브라우저) 그 칸만 다시 띄워 재생한다', async () => {
  setup();
  pick(0, '트위치방송');
  pick(1, '유튜브방송');
  fireEvent.click(screen.getByRole('button', { name: '트위치방송 일시정지' }));
  const h = handles['트위치방송'];
  h.setPaused = vi.fn(); // 재생 요청을 무시하는 플레이어 (멈춘 채로)
  h.paused = true;
  const before = mounts.length;
  fireEvent.click(screen.getByRole('button', { name: '트위치방송 재생' }));
  expect(h.setPaused).toHaveBeenCalledWith(false);
  await act(() => new Promise((r) => setTimeout(r, 1700)));
  expect(mounts.slice(before)).toEqual(['트위치방송']); // 트위치 칸만 다시
  expect(screen.getByRole('button', { name: '트위치방송 일시정지' })).toBeInTheDocument();
});
