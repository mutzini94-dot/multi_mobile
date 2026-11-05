import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { LivePage, LiveQuery, PopularLive } from '../../src/toonation/liveList';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const livePage: LivePage = {
  items: [{ creator: { ...mkCreator(7, { name: '라이브칠', donateId: 'live7', source: 'toonation' }), live: { title: '저녁 방송', viewers: 1234 } }, thumbnail: '', category: '게임' }],
  page: 1,
  totalPages: 1,
  total: 1,
};

const popular: PopularLive = { groups: [], top: livePage.items };

function setup() {
  const kv = quadKv();
  const lives = vi.fn(async (_q: LiveQuery) => livePage);
  const loadPopular = vi.fn(async () => popular);
  const request = vi.fn(async () => {
    throw new Error('NOT_LOGGED_IN');
  });
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} lives={lives} popular={loadPopular} />);
  return { loadPopular };
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];

test('GNB 추천 라이브 → 방송 클릭 → 칸 고르기 → 그 칸에 방송, 창은 모두 닫힌다', async () => {
  const { loadPopular } = setup();
  fireEvent.click(screen.getByRole('button', { name: '추천 라이브' }));
  const live = screen.getByRole('dialog', { name: '추천 라이브' });
  expect(loadPopular).toHaveBeenCalled();
  fireEvent.click(await within(live).findByRole('button', { name: /라이브칠/ }));
  const pick = screen.getByRole('dialog', { name: '넣을 칸 고르기' });
  expect(within(pick).getAllByRole('button', { name: /번 칸/ })).toHaveLength(4); // 기본 4분할
  fireEvent.click(within(pick).getByRole('button', { name: '3번 칸 · 빈 칸' }));
  expect(screen.queryByRole('dialog', { name: '넣을 칸 고르기' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '추천 라이브' })).toBeNull();
  expect(within(tiles()[2]).getByText('라이브칠')).toBeInTheDocument();
});

test('칸 고르기에서 취소하면 추천 라이브 목록으로 돌아간다', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '추천 라이브' }));
  fireEvent.click(await within(screen.getByRole('dialog', { name: '추천 라이브' })).findByRole('button', { name: /라이브칠/ }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '넣을 칸 고르기' })).getByRole('button', { name: '취소' }));
  expect(screen.queryByRole('dialog', { name: '넣을 칸 고르기' })).toBeNull();
  expect(screen.getByRole('dialog', { name: '추천 라이브' })).toBeInTheDocument();
});

test('추천 라이브 창 닫기', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '추천 라이브' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '추천 라이브' })).getByRole('button', { name: '닫기' }));
  expect(screen.queryByRole('dialog', { name: '추천 라이브' })).toBeNull();
});
