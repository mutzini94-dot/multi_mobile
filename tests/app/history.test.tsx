import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { SETTINGS_KEY } from '../../src/settings/settings';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { DonationRecord } from '../../src/toonation/history';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup({ settings, history = [] as DonationRecord[], cash = 12345 as number | null }: { settings?: object; history?: DonationRecord[]; cash?: number | null } = {}) {
  const kv = safeStorage(undefined);
  if (settings) kv.set(SETTINGS_KEY, JSON.stringify(settings));
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  const request = vi.fn(async (type: string) => {
    if (type === 'status') return { account: { name: '나', cash } };
    if (type === 'favorites') return [];
    if (type === 'history') return history;
    return {};
  });
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: { availWidth: 1000, availHeight: 800 } as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} />);
  return { win, request };
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pickA = () => {
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: /^A ·/ }));
};
const now = Date.now();

test('로그인하면 상단에 캐시 잔액, 누르면 내 후원 내역 (이번 달·월별·크리에이터별)', async () => {
  setup({
    history: [
      { at: now, tag: 'don1', creator: 'A', cash: 3000 },
      { at: now - 1000, tag: 'tagB', creator: 'B', cash: 1000 },
      { at: now - 40 * 86400000, tag: 'don1', creator: 'A', cash: 2000 },
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: '내 후원 내역 · 캐시 12,345' }));
  const dlg = screen.getByRole('dialog', { name: '내 후원 내역' });
  expect(await within(dlg).findByText('4,000원')).toBeInTheDocument(); // 이번 달
  const byCreator = within(dlg).getByRole('list', { name: '크리에이터별' });
  expect(within(byCreator).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A5,000원 · 2회후원', 'B1,000원 · 1회후원']);
  expect(within(within(dlg).getByRole('list', { name: '월별' })).getAllByRole('listitem')).toHaveLength(2);
});

test('월 후원 한도: 이번 달 합계가 한도 이상이면 후원 전에 한 번 더 확인', async () => {
  const { win } = setup({ settings: { monthlyLimit: 5000 }, history: [{ at: now, tag: 'x', creator: 'X', cash: 6000 }] });
  await screen.findByRole('button', { name: /내 후원 내역/ });
  await new Promise((r) => setTimeout(r, 0)); // 내역 미리 불러오기
  pickA();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  const dlg = await screen.findByRole('dialog', { name: '후원 한도 확인' });
  expect(within(dlg).getByText(/이번 달 후원 6,000원으로 한도 5,000원/)).toBeInTheDocument();
  fireEvent.click(within(dlg).getByRole('button', { name: '취소' }));
  expect(win.open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '후원 한도 확인' })).getByRole('button', { name: '그래도 후원하기' }));
  expect(win.open).toHaveBeenCalledWith(expect.stringContaining('toon.at/donate/don1'), expect.anything(), expect.anything());
});

test('월 후원 한도: 한도 아래면 바로 후원창', async () => {
  const { win } = setup({ settings: { monthlyLimit: 50000 }, history: [{ at: now, tag: 'x', creator: 'X', cash: 6000 }] });
  await screen.findByRole('button', { name: /내 후원 내역/ });
  pickA();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  expect(screen.queryByRole('dialog', { name: '후원 한도 확인' })).toBeNull();
  expect(win.open).toHaveBeenCalled();
});

test('설정: 월 후원 한도 입력 (0이면 끔)', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  const input = within(screen.getByRole('dialog', { name: '설정' })).getByLabelText('월 후원 한도');
  fireEvent.change(input, { target: { value: '30,000' } });
  fireEvent.blur(input);
  expect((input as HTMLInputElement).value).toBe('30,000');
});
