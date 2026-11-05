import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { DonationRecord } from '../../src/toonation/history';
import type { LivePage, LiveQuery } from '../../src/toonation/liveList';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const livePage: LivePage = {
  items: [{ creator: { ...mkCreator(7, { name: '라이브칠', donateId: 'live7', source: 'toonation' }), live: { title: '저녁 방송', viewers: 1234 } }, thumbnail: '', category: '게임' }],
  page: 1,
  totalPages: 1,
  total: 1,
};

function setup({ loggedIn = false, history = [] as DonationRecord[] } = {}) {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const request = vi.fn(async (type: string) => {
    if (!loggedIn) throw new Error(type === 'status' ? 'NOT_LOGGED_IN' : 'NOT_LOGGED_IN');
    if (type === 'status') return { account: { name: '나', cash: 0 } };
    if (type === 'favorites') return [];
    if (type === 'history') return history;
    return {};
  });
  const lives = vi.fn(async (_q: LiveQuery) => livePage);
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} lives={lives} />);
  return { lives };
}

const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const openPicker = (slot: number) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  return screen.getByRole('dialog', { name: '불러오기' });
};
const addActivity = (slot: number) => {
  const dlg = openPicker(slot);
  fireEvent.click(within(dlg).getByRole('tab', { name: '활동 위젯' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '활동 위젯 칸 넣기' }));
};
const pickFav = (slot: number, name: string) => {
  fireEvent.click(within(openPicker(slot)).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const timeline = () => screen.getByRole('list', { name: '최근 활동' });

test('불러오기의 활동 위젯 탭에서 칸을 넣는다', () => {
  setup();
  addActivity(3);
  expect(screen.getByText('최근 활동')).toBeInTheDocument();
  expect(screen.getByText('아직 활동 기록이 없습니다')).toBeInTheDocument();
});

test('방송을 띄우면 시청 기록이 타임라인에 생긴다', () => {
  setup();
  addActivity(3);
  pickFav(1, 'A');
  expect(within(timeline()).getByText('A 시청')).toBeInTheDocument();
});

test('설정을 바꾸면 변경 기록이 타임라인에 생긴다', () => {
  setup();
  addActivity(3);
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  const dlg = screen.getByRole('dialog', { name: '설정' });
  fireEvent.change(within(dlg).getByLabelText('라이브 자동 갱신'), { target: { value: '3' } });
  expect(within(timeline()).getByText('라이브 자동 갱신: 끔 → 3분마다')).toBeInTheDocument();
});

test('타임라인의 방송을 누르면 첫 번째 칸에 뜨고 선택된다', () => {
  setup();
  addActivity(3);
  pickFav(1, 'A');
  pickFav(2, 'B');
  fireEvent.click(within(timeline()).getByRole('button', { name: /A 시청/ }));
  expect(within(tiles()[0]).getByText('A')).toBeInTheDocument();
  expect(tiles()[0].className).toMatch(/selected/);
});

test('활동 위젯 칸에는 새 창 분리 버튼이 없다', () => {
  setup();
  addActivity(3);
  expect(within(tiles()[3]).queryByRole('button', { name: /새 창/ })).toBeNull();
});

test('방송을 고른 뒤에도 활동 위젯 칸에는 새 창 열기·뒤로 버튼이 없고 새로고침은 있다', () => {
  setup();
  addActivity(3);
  pickFav(0, 'A');
  expect(within(tiles()[3]).queryByRole('button', { name: /새 창/ })).toBeNull();
  expect(within(tiles()[3]).queryByRole('button', { name: '뒤로' })).toBeNull();
  expect(within(tiles()[3]).getByRole('button', { name: '새로고침' })).toBeInTheDocument();
});

test('로그인 안 했으면 라이브 자리에 로그인 안내', () => {
  setup();
  addActivity(3);
  expect(screen.getByText('투네이션에 로그인하면 즐겨찾기·후원한 크리에이터의 라이브를 볼 수 있습니다')).toBeInTheDocument();
});

test('후원한 크리에이터가 라이브면 지금 라이브에 후원 횟수와 함께 보인다', async () => {
  const { lives } = setup({ loggedIn: true, history: [{ at: Date.now() - 1000, tag: 'live7', creator: '라이브칠', cash: 1000 }] });
  addActivity(3);
  expect(await screen.findByText('지금 라이브 · 1')).toBeInTheDocument();
  const live = screen.getByRole('list', { name: '지금 라이브' });
  expect(within(live).getByText('후원 1회')).toBeInTheDocument();
  expect(lives).toHaveBeenCalledWith(expect.objectContaining({ q: '라이브칠' }));
  expect(within(timeline()).getByText('라이브칠에게 1,000캐시 후원')).toBeInTheDocument();
});

test('로그인 확인은 되는데 즐겨찾기가 막히는 상태에서도 요청을 끝없이 반복하지 않는다', async () => {
  const kv = quadKv();
  const request = vi.fn(async (type: string) => {
    if (type === 'status') return { account: { name: '나', cash: 0 } };
    if (type === 'favorites') throw new Error('NOT_LOGGED_IN');
    if (type === 'history') return [];
    return {};
  });
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} lives={vi.fn(async () => livePage)} />);
  addActivity(3);
  await new Promise((r) => setTimeout(r, 500));
  const n = request.mock.calls.filter(([t]) => t === 'status').length;
  await new Promise((r) => setTimeout(r, 500));
  expect(request.mock.calls.filter(([t]) => t === 'status').length).toBe(n);
});
