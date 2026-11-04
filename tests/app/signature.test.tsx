import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { saveLastView, loadLastView } from '../../src/app/lastView';
import { initialViewState } from '../../src/app/viewState';
import { isPage, makeSignaturePage } from '../../src/domain/pages';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { DesktopApi } from '../../src/desktop/desktopApi';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup(desktop: DesktopApi | null = null) {
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
  render(<App favorites={favorites} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={desktop} />);
  return { request, win };
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

const addSignatureTile = async () => {
  pickFav(0, 'A');
  const dlg = openPicker(3);
  fireEvent.click(within(dlg).getByRole('tab', { name: '시그니처' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '시그니처 칸 넣기' }));
  return screen.findByRole('button', { name: 'A의시그 · 5,000캐시 시그니처로 후원하기' });
};

test('웹: 시그니처를 누르면 후원 팝업을 열고 시그니처 탭에서 고르라고 알린다', async () => {
  const { win } = setup();
  fireEvent.click(await addSignatureTile());
  expect(win.open).toHaveBeenCalled();
  expect(await screen.findByText("후원창의 시그니처 탭에서 'A의시그'(5,000캐시)를 골라 주세요")).toBeInTheDocument();
});

test('설치형: 후원창을 열고 그 시그니처를 골라 둔다', async () => {
  const selectSignature = vi.fn().mockResolvedValue('ok');
  const desktop = {
    status: vi.fn().mockResolvedValue({ ok: true, data: { account: null } }),
    login: vi.fn(), logout: vi.fn(),
    favorites: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    signatures: vi.fn().mockResolvedValue({ ok: true, data: [{ Hash: 'h1', Name: 'A의시그', Cash: 5000, DonationCount: 1, Enabled: 1, IsRandom: 0, Thumbnail: 0 }] }),
    selectSignature,
    openDonate: vi.fn(), closeDonate: vi.fn(), setDonateBounds: vi.fn(), setDonateMode: vi.fn(), fillDonate: vi.fn(), setAlwaysOnTop: vi.fn(),
    onDonateClosed: vi.fn(() => () => {}), onDonateMode: vi.fn(() => () => {}),
  } as unknown as DesktopApi;
  setup(desktop);
  fireEvent.click(await addSignatureTile());
  expect(desktop.openDonate).toHaveBeenCalledWith(expect.objectContaining({ tag: 'tagA', name: 'A' }));
  expect(selectSignature).toHaveBeenCalledWith('A의시그', 'tagA', 5000);
  expect(await screen.findByText("후원창에 'A의시그'(5,000캐시) 시그니처를 골라 두었습니다. 후원 버튼을 눌러 주세요")).toBeInTheDocument();
});

test('설치형: 시그니처를 고르지 못하면 직접 고르라고 알린다', async () => {
  const desktop = {
    status: vi.fn().mockResolvedValue({ ok: true, data: { account: null } }),
    login: vi.fn(), logout: vi.fn(),
    favorites: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    signatures: vi.fn().mockResolvedValue({ ok: true, data: [{ Hash: 'h1', Name: 'A의시그', Cash: 5000, DonationCount: 1, Enabled: 1, IsRandom: 0, Thumbnail: 0 }] }),
    selectSignature: vi.fn().mockResolvedValue('timeout:popup'),
    openDonate: vi.fn(), closeDonate: vi.fn(), setDonateBounds: vi.fn(), setDonateMode: vi.fn(), fillDonate: vi.fn(), setAlwaysOnTop: vi.fn(),
    onDonateClosed: vi.fn(() => () => {}), onDonateMode: vi.fn(() => () => {}),
  } as unknown as DesktopApi;
  setup(desktop);
  fireEvent.click(await addSignatureTile());
  expect(await screen.findByText("후원창의 시그니처 탭에서 'A의시그'(5,000캐시)를 골라 주세요 (자동 선택 실패: timeout:popup)")).toBeInTheDocument();
});
