import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { SETTINGS_KEY } from '../../src/settings/settings';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { LivePage, LiveQuery } from '../../src/toonation/liveList';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const empty: LivePage = { items: [], page: 1, totalPages: 1, total: 0 };

function setup({ settings, lives = vi.fn(async (_q: LiveQuery) => empty) }: { settings?: object; lives?: (q: LiveQuery) => Promise<LivePage> } = {}) {
  const kv = quadKv();
  if (settings) kv.set(SETTINGS_KEY, JSON.stringify({ defaultLayout: 'quad', ...settings }));
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: '하나', donateId: 'one' }));
  favorites.add(mkCreator(2, { name: '둘', donateId: 'two' }));
  const request = vi.fn(async () => {
    throw new Error('NOT_LOGGED_IN');
  });
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} lives={lives} quickPollMs={60} />);
  return { lives };
}
const panel = () => screen.getByRole('complementary', { name: '퀵패널' });
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

test('퀵패널(기본 왼쪽): 즐겨찾기를 누르면 넣을 칸을 묻고 그 칸에 띄운다', () => {
  setup();
  const body = document.querySelector('.app__body')!;
  expect(body.firstElementChild).toBe(panel()); // 왼쪽
  fireEvent.click(within(panel()).getByRole('button', { name: '둘' }));
  const pick = screen.getByRole('dialog', { name: '넣을 칸 고르기' });
  fireEvent.click(within(pick).getByRole('button', { name: '2번 칸 · 빈 칸' }));
  expect(screen.queryByRole('dialog', { name: '넣을 칸 고르기' })).toBeNull();
  expect(within(tiles()[1]).getByText('둘')).toBeInTheDocument();
});

test('최근 본 탭: 띄웠던 방송', () => {
  setup();
  fireEvent.click(within(panel()).getByRole('button', { name: '하나' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '넣을 칸 고르기' })).getByRole('button', { name: '1번 칸 · 빈 칸' }));
  fireEvent.click(within(panel()).getByRole('tab', { name: '최근 본' }));
  expect(within(panel()).getByRole('button', { name: '하나' })).toBeInTheDocument();
});

test('설정: 오른쪽 · 숨기기', () => {
  setup({ settings: { quickPanel: 'right' } });
  expect(document.querySelector('.app__body')!.lastElementChild).toBe(panel());
});

test('설정: 숨기기면 퀵패널이 없다', () => {
  setup({ settings: { quickPanel: 'off' } });
  expect(screen.queryByRole('complementary', { name: '퀵패널' })).toBeNull();
});

test('퀵패널의 크리에이터가 방송을 시작하면 표시·알림, 알림을 누르면 칸 고르기', async () => {
  let liveNow = false;
  const lives = vi.fn(async (q: LiveQuery): Promise<LivePage> =>
    liveNow && q.q === '둘'
      ? { items: [{ creator: { ...mkCreator(2, { name: '둘', donateId: 'two', source: 'toonation' }), live: { title: '저녁 방송', viewers: 10 } }, thumbnail: '', category: '' }], page: 1, totalPages: 1, total: 1 }
      : empty,
  );
  setup({ lives });
  await wait(150); // 처음 확인: 꺼져 있음
  expect(within(panel()).queryByRole('status')).toBeNull();
  liveNow = true;
  await wait(200); // 다음 확인: 켜짐
  const alert = within(panel()).getByRole('status', { name: '방송 시작 알림' });
  expect(within(alert).getByText('둘 방송 시작')).toBeInTheDocument();
  expect(within(panel()).getByRole('button', { name: '둘 · 방송 중 · 방금 시작' })).toBeInTheDocument();
  fireEvent.click(within(alert).getByRole('button', { name: '둘 방송 칸에 넣기' }));
  expect(screen.getByRole('dialog', { name: '넣을 칸 고르기' })).toBeInTheDocument();
});

test('퀵패널 맨 위 추천 라이브: 옆으로 펼쳐 한 개씩 넘겨 보고, 칸에 넣기는 칸 고르기로', async () => {
  const live7 = { ...mkCreator(7, { name: '라이브칠', donateId: 'live7', source: 'toonation' }), live: { title: '저녁 방송', viewers: 10 } };
  const lives = vi.fn(async (_q: LiveQuery): Promise<LivePage> => ({ items: [{ creator: live7, thumbnail: '', category: '' }], page: 1, totalPages: 1, total: 1 }));
  setup({ lives });
  const btn = within(panel()).getByRole('button', { name: '추천 라이브 탐색' });
  expect(within(panel()).getAllByRole('button')[0]).toBe(btn); // 맨 위
  fireEvent.click(btn);
  const feed = await screen.findByRole('region', { name: '추천 라이브 탐색' });
  expect(btn).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(await within(feed).findByRole('button', { name: '라이브칠 칸에 넣기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '넣을 칸 고르기' })).getByRole('button', { name: '2번 칸 · 빈 칸' }));
  expect(within(tiles()[1]).getByText('라이브칠')).toBeInTheDocument();
  fireEvent.click(btn); // 다시 누르면 접힌다
  expect(screen.queryByRole('region', { name: '추천 라이브 탐색' })).toBeNull();
});

test('퀵패널 맨 아래 창 추가: 놓을 자리를 고르면 그 자리에 빈 칸이 생긴다', () => {
  setup();
  fireEvent.click(within(panel()).getByRole('button', { name: '하나' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '넣을 칸 고르기' })).getByRole('button', { name: '1번 칸 · 빈 칸' }));
  fireEvent.click(within(panel()).getByRole('button', { name: '창 추가' }));
  const dlg = screen.getByRole('dialog', { name: '창 추가' });
  fireEvent.click(within(dlg).getByRole('button', { name: '6분할 · 1번 자리에 추가' }));
  expect(screen.queryByRole('dialog', { name: '창 추가' })).toBeNull();
  expect(tiles()).toHaveLength(6);
  expect(within(tiles()[0]).queryByText('하나')).toBeNull();
  expect(within(tiles()[1]).getByText('하나')).toBeInTheDocument();
});

test('9분할이면 창 추가를 누를 수 없다', () => {
  setup({ settings: { defaultLayout: 'nine' } });
  expect(within(panel()).getByRole('button', { name: '창 추가' })).toBeDisabled();
});

test('빈 창의 삭제 버튼: 누르면 그 칸이 빠지고 한 단계 작은 레이아웃이 된다', () => {
  setup();
  expect(tiles()).toHaveLength(4);
  fireEvent.click(within(tiles()[3]).getByRole('button', { name: '빈 창 삭제' }));
  expect(tiles()).toHaveLength(3);
  expect(screen.getByRole('button', { name: '1+2' })).toHaveAttribute('aria-pressed', 'true');
});
