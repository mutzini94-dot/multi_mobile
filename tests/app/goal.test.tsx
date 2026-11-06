import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { goalLevel, GOAL_NOTICE_KEY } from '../../src/toonation/history';
import { localFavorites } from '../../src/favorites/favorites';
import { SETTINGS_KEY } from '../../src/settings/settings';
import { safeStorage, type KV } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { DonationRecord } from '../../src/toonation/history';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const now = Date.now();

function setup({ kv = safeStorage(undefined), settings = {}, history = [] as DonationRecord[] } = {} as { kv?: KV; settings?: object; history?: DonationRecord[] }) {
  kv.set(ONBOARDED_KEY, '1');
  kv.set(SETTINGS_KEY, JSON.stringify(settings));
  const request = vi.fn(async (type: string) => (type === 'status' ? { account: { name: '나', cash: 100 } } : type === 'history' ? history : type === 'favorites' ? [] : {}));
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: { availWidth: 1000, availHeight: 800 } as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const r = render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} />);
  return { win, kv, ...r };
}

test('goalLevel: 80%·100%', () => {
  expect(goalLevel(7999, 10000)).toBe(0);
  expect(goalLevel(8000, 10000)).toBe(80);
  expect(goalLevel(12000, 10000)).toBe(100);
  expect(goalLevel(5000, 0)).toBe(0);
});

test('후원 목표: 이번 달 합계가 목표의 80%를 넘으면 한 번 알려주고, 같은 단계는 다시 알리지 않는다', async () => {
  const kv = safeStorage(undefined);
  const history = [{ at: now, tag: 'a', creator: 'A', cash: 8500 }];
  const first = setup({ kv, settings: { monthlyGoal: 10000 }, history });
  expect(await screen.findByText('이번 달 후원이 목표 10,000원의 80%를 넘었습니다 (8,500원)', {}, { timeout: 4000 })).toBeInTheDocument();
  expect(JSON.parse(kv.get(GOAL_NOTICE_KEY)!).level).toBe(80);
  first.unmount();
  setup({ kv, settings: { monthlyGoal: 10000 }, history });
  await screen.findByRole('button', { name: /내 후원 내역/ }, { timeout: 4000 });
  await new Promise((r) => setTimeout(r, 0));
  expect(screen.queryByText(/목표 10,000원/)).toBeNull();
});

test('후원 목표: 목표에 이르면 알려준다', async () => {
  setup({ settings: { monthlyGoal: 10000 }, history: [{ at: now, tag: 'a', creator: 'A', cash: 10000 }] });
  expect(await screen.findByText('이번 달 후원 목표 10,000원에 이르렀습니다 (10,000원)', {}, { timeout: 4000 })).toBeInTheDocument();
});

test('내 후원 내역: 크리에이터를 눌러 바로 후원창', async () => {
  const { win } = setup({ history: [{ at: now, tag: 'tagA', creator: 'A', cash: 1000 }] });
  fireEvent.click(await screen.findByRole('button', { name: /내 후원 내역/ }, { timeout: 4000 }));
  const dlg = screen.getByRole('dialog', { name: '내 후원 내역' });
  fireEvent.click(await within(dlg).findByRole('button', { name: 'A 후원하기' }, { timeout: 4000 }));
  expect(win.open).toHaveBeenCalledWith(expect.stringContaining('toon.at/donate/tagA'), expect.anything(), expect.anything());
  expect(screen.queryByRole('dialog', { name: '내 후원 내역' })).toBeNull();
});

test('설정: 월 후원 목표 입력', () => {
  const { kv } = setup();
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  const input = within(screen.getByRole('dialog', { name: '설정' })).getByLabelText('월 후원 목표');
  fireEvent.change(input, { target: { value: '30,000' } });
  fireEvent.blur(input);
  expect(JSON.parse(kv.get(SETTINGS_KEY)!).monthlyGoal).toBe(30000);
});
