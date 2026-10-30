import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { LivePage, LiveQuery } from '../../src/toonation/liveList';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const livePage: LivePage = {
  items: [
    { creator: { ...mkCreator(7, { name: '라이브칠', donateId: 'live7', source: 'toonation' }), live: { title: '켜짐', viewers: 5 } }, thumbnail: '', category: '게임' },
    { creator: { ...mkCreator(8, { name: '라이브팔', donateId: 'live8', source: 'toonation' }), live: { title: '켜짐', viewers: 3 } }, thumbnail: '', category: '토크' },
  ],
  page: 1,
  totalPages: 1,
  total: 2,
};

function setup({ loggedIn = true, favorites = [] as unknown[] } = {}) {
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  const request = vi.fn(async (type: string, payload?: unknown) => {
    if (type === 'status') return { account: loggedIn ? { name: '나' } : null };
    if (type === 'favorites') return favorites;
    if (type === 'search') {
      if (!loggedIn) throw new Error('NOT_LOGGED_IN');
      return payload === '찾기' ? [{ tag: 'found', name: '찾은사람', profile: '', channels: [{ platform: 'twitch', key: 'found_one' }] }] : [];
    }
    if (type === 'bookmark') return {};
    if (type === 'history') return [];
    return {};
  });
  const lives = vi.fn(async (_q: LiveQuery) => livePage);
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} lives={lives} />);
  return { request, lives };
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const openPicker = () => {
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '불러오기' }));
  return screen.getByRole('dialog', { name: '불러오기' });
};

test('투네이션 크리에이터 검색: 이름으로 찾아 칸에 넣는다', async () => {
  const { request } = setup();
  const dlg = openPicker();
  fireEvent.change(within(dlg).getByLabelText('투네이션 크리에이터 검색'), { target: { value: '찾기' } });
  fireEvent.submit(within(dlg).getByLabelText('투네이션 크리에이터 검색').closest('form')!);
  fireEvent.click(await within(dlg).findByRole('button', { name: /^찾은사람 · Twitch/ }));
  expect(request).toHaveBeenCalledWith('search', '찾기');
  expect(within(tiles()[0]).getByText('찾은사람')).toBeInTheDocument();
});

test('투네이션 크리에이터 검색: 로그인하지 않았으면 알려준다, 결과가 없으면 알려준다', async () => {
  setup({ loggedIn: false });
  const dlg = openPicker();
  fireEvent.change(within(dlg).getByLabelText('투네이션 크리에이터 검색'), { target: { value: '찾기' } });
  fireEvent.submit(within(dlg).getByLabelText('투네이션 크리에이터 검색').closest('form')!);
  expect(await within(dlg).findByText('투네이션에 로그인해야 검색할 수 있습니다')).toBeInTheDocument();
});

test('투네이션 라이브: ♡로 투네이션 즐겨찾기에 추가', async () => {
  const { request } = setup();
  const dlg = openPicker();
  fireEvent.click(within(dlg).getByRole('tab', { name: '투네이션 라이브' }));
  fireEvent.click(await within(dlg).findByRole('button', { name: '라이브칠 즐겨찾기 추가' }));
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('bookmark', { tag: 'live7', on: true }));
});

test('투네이션 라이브: 이미 즐겨찾기면 ♥, 누르면 해제', async () => {
  const { request } = setup({ favorites: [{ tag: 'live7', name: '라이브칠', profile: '', channels: [{ platform: 'twitch', key: 'chan_7' }] }] });
  const dlg = openPicker();
  await within(dlg).findByRole('button', { name: /^라이브칠 · Twitch/ }); // 즐겨찾기를 불러온 뒤
  fireEvent.click(within(dlg).getByRole('tab', { name: '투네이션 라이브' }));
  fireEvent.click(await within(dlg).findByRole('button', { name: '라이브칠 즐겨찾기 해제' }));
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('bookmark', { tag: 'live7', on: false }));
});

test('투네이션 라이브: 카테고리로 거르기', async () => {
  const { lives } = setup();
  const dlg = openPicker();
  fireEvent.click(within(dlg).getByRole('tab', { name: '투네이션 라이브' }));
  fireEvent.click(await within(dlg).findByRole('button', { name: '카테고리 게임' }));
  await vi.waitFor(() => expect(lives).toHaveBeenLastCalledWith(expect.objectContaining({ category: '게임', page: 1 })));
  fireEvent.click(within(dlg).getByRole('button', { name: '카테고리 게임 해제' }));
  await vi.waitFor(() => expect(lives).toHaveBeenLastCalledWith(expect.objectContaining({ category: '' })));
});
