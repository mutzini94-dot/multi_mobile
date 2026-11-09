import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage, type KV } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { fitVertical } from '../../src/ui/PlayerLayer';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

// 유튜브 칸은 재생되면 플레이어가 라이브 영상 ID를 알려 준다
vi.mock('../../src/players/StreamPlayer', async () => {
  const { useEffect } = await import('react');
  return {
    StreamPlayer: ({ creator, onReady }: { creator: { name: string; platform: string }; onReady(h: unknown): void }) => {
      useEffect(() => {
        const id = creator.platform === 'youtube' ? (creator.name === 'Y' ? 'VERTICAL_01' : 'LANDSCAPE01') : null;
        onReady({ setMuted() {}, isMuted: () => true, videoId: () => id });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="player" />;
    },
  };
});
// 유튜브 세로 영상 판별 (썸네일 방향): 테스트에서는 영상 ID로 정한다
const detect = vi.fn((id: string) => Promise.resolve(id === 'VERTICAL_01' ? true : id === 'LANDSCAPE01' ? false : null));
vi.mock('../../src/players/verticalThumb', () => ({ detectVertical: (id: string) => detect(id) }));

const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };

function setup(kv: KV = quadKv()) {
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'Y', key: 'youtube:UCvvvvvvvvvvvvvvvvvvvvvv', platform: 'youtube', channel: 'UCvvvvvvvvvvvvvvvvvvvvvv', videoId: 'VERTICAL_01' }));
  favorites.add(mkCreator(3, { name: 'L', key: 'youtube:UCllllllllllllllllllllll', platform: 'youtube', channel: 'UCllllllllllllllllllllll', videoId: 'LANDSCAPE01' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const r = render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { kv, unmount: r.unmount };
}

const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const item = (slot: number) => document.querySelector(`.player-layer__item[data-slot="${slot}"]`)!;

beforeEach(() => detect.mockClear());

test('세로로 보기: 누르면 그 방송 칸을 세로(9:16)로, 크리에이터별로 기억', () => {
  const { kv, unmount } = setup();
  pick(0, 'A');
  expect(item(0)).not.toHaveClass('player-layer__item--vertical');
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '세로로 보기' }));
  expect(item(0)).toHaveClass('player-layer__item--vertical');
  expect(within(tiles()[0]).getByRole('button', { name: '가로로 보기' })).toHaveAttribute('aria-pressed', 'true');
  unmount();
  setup(kv);
  expect(item(0)).toHaveClass('player-layer__item--vertical'); // 다음 실행에서도
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '가로로 보기' }));
  expect(item(0)).not.toHaveClass('player-layer__item--vertical');
});

test('유튜브 세로 방송은 키 없이 썸네일 방향으로 알아내 자동으로 세로, 직접 바꾸면 그 선택이 우선', async () => {
  setup();
  pick(0, 'Y');
  pick(1, 'L');
  await act(async () => {});
  expect(detect).toHaveBeenCalledWith('VERTICAL_01');
  expect(item(0)).toHaveClass('player-layer__item--vertical');
  expect(item(1)).not.toHaveClass('player-layer__item--vertical');
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '가로로 보기' }));
  expect(item(0)).not.toHaveClass('player-layer__item--vertical');
});

test('세로 칸 자리: 높이는 그대로, 폭만 9:16로 줄여 가운데', () => {
  expect(fitVertical({ left: 0, top: 10, width: 360, height: 224 })).toEqual({ left: 117, top: 10, width: 126, height: 224 });
  // 칸이 이미 좁고 길면 그대로
  expect(fitVertical({ left: 5, top: 0, width: 100, height: 400 })).toEqual({ left: 5, top: 0, width: 100, height: 400 });
});
