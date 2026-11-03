import { fireEvent, render, screen, within } from '@testing-library/react';
import { RecommendLive } from '../../src/ui/RecommendLive';
import type { LiveItem, LivePage, PopularLive } from '../../src/toonation/liveList';
import { mkCreator } from '../helpers/fixtures';

const item = (n: number, viewers = 100 * n): LiveItem => ({
  creator: { ...mkCreator(n, { name: `방송인${n}`, source: 'toonation' }), live: { title: `제목${n}`, viewers } },
  thumbnail: `https://t/${n}.jpg`,
  category: '',
});
const popular: PopularLive = {
  groups: [
    { name: '추천 토크 채널', items: [1, 2, 3, 4, 5, 6, 7].map((n) => item(n)) },
    { name: '추천 게임 채널', items: [item(8)] },
  ],
  top: [item(9, 1234), item(10)],
};
const allPage: LivePage = { items: [item(20)], page: 1, totalPages: 1, total: 1 };

function setup(loadPopular = vi.fn(async () => popular)) {
  const onPick = vi.fn();
  const load = vi.fn(async () => allPage);
  render(<RecommendLive loadPopular={loadPopular} load={load} onPick={onPick} />);
  return { onPick, load, loadPopular };
}

test('인기라이브(기본): 추천 채널 묶음과 LIVE TOP 50을 카드로', async () => {
  setup();
  expect(screen.getByRole('tab', { name: '인기라이브' })).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByRole('heading', { name: '추천 토크 채널' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '추천 게임 채널' })).toBeInTheDocument();
  const top = screen.getByRole('region', { name: 'LIVE TOP 50' });
  expect(within(top).getByText('시청자 1,234명')).toBeInTheDocument();
  expect(within(top).getByText('제목9')).toBeInTheDocument();
  expect(within(top).getByText('방송인9')).toBeInTheDocument();
});

test('카드를 누르면 그 방송을 고른다', async () => {
  const { onPick } = setup();
  fireEvent.click(await screen.findByRole('button', { name: /방송인9/ }));
  expect(onPick).toHaveBeenCalledWith(popular.top[0].creator);
});

test('추천 묶음은 5개만 보이고 더보기로 전부', async () => {
  setup();
  const talk = await screen.findByRole('region', { name: '추천 토크 채널' });
  expect(within(talk).getAllByRole('button', { name: /방송인/ })).toHaveLength(5);
  fireEvent.click(within(talk).getByRole('button', { name: '더보기' }));
  expect(within(talk).getAllByRole('button', { name: /방송인/ })).toHaveLength(7);
});

test('전체라이브 탭: 검색·정렬 목록을 카드로', async () => {
  const { load, onPick } = setup();
  fireEvent.click(screen.getByRole('tab', { name: '전체라이브' }));
  expect(load).toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: /방송인20/ }));
  expect(onPick).toHaveBeenCalledWith(allPage.items[0].creator);
});

test('인기라이브를 못 불러오면 다시 시도', async () => {
  const loadPopular = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(popular);
  setup(loadPopular);
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
  expect(await screen.findByRole('heading', { name: '추천 토크 채널' })).toBeInTheDocument();
});
