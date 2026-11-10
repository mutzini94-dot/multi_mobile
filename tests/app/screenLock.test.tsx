import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup() {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  const tile = document.querySelectorAll<HTMLElement>('.tile')[0];
  fireEvent.click(within(tile).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: /^A ·/ }));
  fireEvent.click(within(document.querySelectorAll<HTMLElement>('.tile')[0]).getByRole('button', { name: '전체 화면' }));
}

// (0,0)은 jsdom에서 창 나누기 손잡이(react-resizable-panels) 위로 잡혀 누름을 가로챈다
const AT = { pointerId: 1, clientX: 600, clientY: 400 };

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => vi.useRealTimers());

test('전체 화면에서 화면 잠금: 화면을 덮어 터치를 막고, 잠금 해제는 길게 눌러야 한다', () => {
  setup();
  expect(screen.getByRole('region', { name: 'A 전체 화면' }) ?? null).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '화면 잠금' }));
  const lock = screen.getByRole('dialog', { name: '화면 잠금' });
  expect(document.querySelector('.app')).toHaveClass('app--locked'); // 위쪽 바를 숨긴다
  // Esc로도 빠져나가지 않는다
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: '화면 잠금' })).toBeInTheDocument();
  // 짧게 누르면 안내만
  const unlock = within(lock).getByRole('button', { name: '길게 눌러 잠금 해제' });
  fireEvent.pointerDown(unlock, AT);
  act(() => vi.advanceTimersByTime(300));
  fireEvent.pointerUp(unlock, AT);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('dialog', { name: '화면 잠금' })).toBeInTheDocument();
  // 길게 누르면 풀린다
  fireEvent.pointerDown(unlock, AT);
  act(() => vi.advanceTimersByTime(900));
  expect(screen.queryByRole('dialog', { name: '화면 잠금' })).toBeNull();
  expect(screen.getByRole('button', { name: '전체 화면 종료' })).toBeInTheDocument(); // 전체 화면은 그대로
});

test('짧게 누르기(클릭)로는 잠금이 풀리지 않는다', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '화면 잠금' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '화면 잠금' })).getByRole('button', { name: '길게 눌러 잠금 해제' })); // 클릭은 무시
  expect(screen.getByRole('dialog', { name: '화면 잠금' })).toBeInTheDocument();
});
