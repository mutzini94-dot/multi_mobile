import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { saveLastView, loadLastView } from '../../src/app/lastView';
import { initialViewState } from '../../src/app/viewState';
import { isPage, makeSignaturePage } from '../../src/domain/pages';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup() {
  const kv = safeStorage(undefined);
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A', donateId: 'tagA' }));
  favorites.add(mkCreator(2, { name: 'B', donateId: 'tagB' }));
  const request = vi.fn(async (type: string, payload?: unknown) => {
    if (type === 'signatures')
      return payload === 'tagA'
        ? [{ Hash: 'h1', Name: 'A의시그', Cash: 5000, DonationCount: 1, Enabled: 1, IsRandom: 0, Thumbnail: 0 }]
        : [{ Hash: 'h2', Name: 'B의시그', Cash: 7000, DonationCount: 2, Enabled: 1, IsRandom: 0, Thumbnail: 0 }];
    throw new Error('NOT_LOGGED_IN');
  });
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} />);
  return { request };
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const openPicker = (slot: number) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  return screen.getByRole('dialog', { name: '불러오기' });
};
const pickFav = (slot: number, name: string) => fireEvent.click(within(openPicker(slot)).getByRole('button', { name: new RegExp(`^${name} ·`) }));

test('불러오기 시그니처 탭 → 선택한 방송 크리에이터의 시그니처, 다른 방송을 선택하면 따라 바뀐다', async () => {
  const { request } = setup();
  pickFav(0, 'A');
  const dlg = openPicker(3);
  fireEvent.click(within(dlg).getByRole('tab', { name: '시그니처' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '시그니처 칸 넣기' }));
  expect(await screen.findByText('A의시그')).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('signatures', 'tagA');
  pickFav(1, 'B'); // 새로 띄운 방송이 선택된다
  expect(await screen.findByText('B의시그')).toBeInTheDocument();
  expect(within(tiles()[3]).getByText('B 시그니처')).toBeInTheDocument(); // 칸 이름
});

test('시그니처 칸도 마지막 화면으로 저장·복원된다', () => {
  const kv = safeStorage(undefined);
  const slots = Array(9).fill(null);
  slots[2] = makeSignaturePage();
  expect(isPage(slots[2])).toBe(true);
  saveLastView(kv, { ...initialViewState, slots });
  expect(loadLastView(kv)?.slots[2]).toMatchObject({ kind: 'signature', name: '시그니처' });
});
