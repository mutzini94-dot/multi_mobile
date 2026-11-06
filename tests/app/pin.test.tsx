import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup() {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A', donateId: 'tagA' }));
  favorites.add(mkCreator(2, { name: 'B', donateId: 'tagB' }));
  const request = vi.fn(async (type: string, payload?: unknown) => {
    if (type === 'signatures') return [{ Hash: `h${payload}`, Name: `${payload}의시그`, Cash: 5000, DonationCount: 1, Enabled: 1, IsRandom: 0, Thumbnail: 0 }];
    throw new Error('NOT_LOGGED_IN');
  });
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} quickPollMs={600000} />);
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const openPicker = (slot: number) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  return screen.getByRole('dialog', { name: '불러오기' });
};
const pickFav = (slot: number, name: string) => fireEvent.click(within(openPicker(slot)).getByRole('button', { name: new RegExp(`^${name} ·`) }));
const addSignature = (slot: number) => {
  const dlg = openPicker(slot);
  fireEvent.click(within(dlg).getByRole('tab', { name: '시그니처' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '시그니처 칸 넣기' }));
};

test('📌 시그니처 칸을 A 방송에 고정하면 B를 선택해도 A, 해제하면 다시 선택한 방송을 따라간다', async () => {
  setup();
  pickFav(0, 'A');
  pickFav(1, 'B'); // B가 선택됨
  addSignature(3);
  expect(await screen.findByText('tagB의시그')).toBeInTheDocument();
  fireEvent.click(within(tiles()[3]).getByRole('button', { name: '방송에 고정' }));
  const dlg = screen.getByRole('dialog', { name: '고정할 방송 고르기' });
  fireEvent.click(within(dlg).getByRole('button', { name: '1번 칸 · A' }));
  expect(screen.queryByRole('dialog', { name: '고정할 방송 고르기' })).toBeNull();
  expect(await screen.findByText('tagA의시그')).toBeInTheDocument();
  expect(within(tiles()[3]).getByText('A 시그니처')).toBeInTheDocument();
  // 다른 방송을 선택해도 그대로
  fireEvent.click(within(tiles()[1]).getByText('B'));
  expect(screen.getByText('tagA의시그')).toBeInTheDocument();
  // 해제
  fireEvent.click(within(tiles()[3]).getByRole('button', { name: 'A에 고정됨 · 바꾸기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '고정할 방송 고르기' })).getByRole('button', { name: '선택한 방송 따라가기' }));
  expect(await screen.findByText('tagB의시그')).toBeInTheDocument();
});

test('방송 칸을 시그니처 칸에 놓으면 자리를 바꾸고, Shift를 누른 채 놓으면 자리는 그대로 그 방송에 고정', async () => {
  setup();
  pickFav(0, 'A');
  pickFav(1, 'B');
  addSignature(3);
  await screen.findByText('tagB의시그');
  const drag = (from: number, to: number, shiftKey = false) => {
    const target = tiles()[to];
    document.elementsFromPoint = () => [target];
    fireEvent.pointerDown(within(tiles()[from]).getByRole('button', { name: '끌어서 자리 옮기기' }), { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 300, pointerId: 1, shiftKey });
    fireEvent.pointerUp(window, { clientX: 300, clientY: 300, pointerId: 1, shiftKey });
  };
  // 기본: 자리 바꾸기
  drag(0, 3);
  expect(within(tiles()[3]).getByText('A', { selector: '.tile__name' })).toBeInTheDocument();
  expect(tiles()[0].querySelector('.tile__name')!.textContent).toMatch(/시그니처/);
  drag(3, 0); // 되돌리기
  expect(within(tiles()[0]).getByText('A', { selector: '.tile__name' })).toBeInTheDocument();
  // Shift를 누른 채 놓기: 고정
  drag(0, 3, true);
  expect(within(tiles()[0]).getByText('A')).toBeInTheDocument(); // 자리 그대로
  expect(within(tiles()[3]).getByText('A 시그니처')).toBeInTheDocument();
  expect(await screen.findByText('tagA의시그')).toBeInTheDocument();
});
