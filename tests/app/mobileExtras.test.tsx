import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { safeStorage } from '../../src/storage/safeStorage';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';

const paused: Record<string, boolean> = {};
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator, onReady }: { creator: { name: string }; onReady(h: unknown): void }) => {
    useEffect(() => {
      onReady({ setMuted() {}, isMuted: () => true, setPaused: (p: boolean) => (paused[creator.name] = p), setVolume() {} });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="player" />;
  },
}));

function mockPhone() {
  window.matchMedia = ((q: string) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  for (const k of Object.keys(paused)) delete paused[k];
  vi.useRealTimers();
});

function setup({ onboarded = true, search = '' } = {}) {
  const kv = safeStorage(undefined);
  if (onboarded) kv.set(ONBOARDED_KEY, '1');
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const replaceState = vi.fn();
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', search, href: `http://localhost:5230/${search}` } as Location, navigator: {} as Navigator, history: { replaceState } as unknown as History };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { favorites, replaceState };
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pickInto = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
function longPress(el: Element) {
  fireEvent.pointerDown(el, { button: 0, pointerId: 5, pointerType: 'touch', clientX: 600, clientY: 400 });
  act(() => vi.advanceTimersByTime(350));
  fireEvent.pointerUp(window, { pointerId: 5, pointerType: 'touch', clientX: 600, clientY: 400 });
}

test('휴대폰: 칸을 길게 눌렀다 떼면 아래에서 칸 메뉴 (소리·전체 화면·채팅·후원·세로·즐겨찾기·창 닫기)', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  mockPhone();
  const vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  const { favorites } = setup();
  pickInto(0, 'A');
  longPress(tiles()[0].querySelector('.tile__bar')!);
  const menu = screen.getByRole('menu', { name: '영상 메뉴' });
  expect(menu.closest('.context-sheet__backdrop')).not.toBeNull(); // 아래 시트
  for (const n of ['소리 끄기', '전체 화면', '채팅 보기', '후원하기', '세로로 보기', '즐겨찾기 해제', '창 닫기']) expect(within(menu).getByRole('menuitem', { name: n })).toBeInTheDocument();
  fireEvent.click(within(menu).getByRole('menuitem', { name: '즐겨찾기 해제' }));
  expect(favorites.list().map((c) => c.name)).toEqual(['B']);
  // 빈 칸·후원 페이지 칸은 칸 메뉴
  longPress(tiles()[1].querySelector('.tile__bar')!);
  expect(screen.getByRole('menu', { name: '2번 화면 메뉴' })).toBeInTheDocument();
  expect(vibrate).toHaveBeenCalled(); // 진동
});

test('취침 타이머: 고른 시간이 지나면 소리를 끄고 모든 방송을 멈춘다', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  mockPhone();
  setup();
  pickInto(0, 'A');
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '메뉴' })).getByRole('button', { name: '취침 타이머' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '취침 타이머' })).getByRole('button', { name: '30분' }));
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
  expect(within(screen.getByRole('dialog', { name: '메뉴' })).getByRole('button', { name: /^취침 타이머 · 30분 남음/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '메뉴' })); // 닫기
  act(() => vi.advanceTimersByTime(30 * 60_000 + 2000));
  expect(paused.A).toBe(true);
  expect(screen.getByText('취침 타이머로 방송을 멈췄습니다')).toBeInTheDocument();
});

test('네트워크가 끊기면 알리고, 다시 연결되면 방송을 새로 불러온다', () => {
  mockPhone();
  setup();
  pickInto(0, 'A');
  const before = screen.getAllByTestId('player').length;
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
  expect(screen.getByRole('status', { name: '연결 상태' })).toHaveTextContent('인터넷 연결이 끊겼습니다');
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
  expect(screen.queryByRole('status', { name: '연결 상태' })).toBeNull();
  expect(screen.getAllByTestId('player').length).toBe(before); // 다시 띄워도 그대로 한 개
});

test('앱 아이콘 바로가기: ?action=overview 로 열면 전체보기, 주소의 ?action 은 지운다', () => {
  mockPhone();
  const { replaceState } = setup({ search: '?action=overview' });
  expect(document.querySelector('.app')).toHaveClass('app--overview');
  expect(replaceState).toHaveBeenCalled();
});

test('다른 앱에서 공유한 방송 링크로 열면 그 방송을 칸에 넣는다 (투네이션에 등록된 크리에이터만)', async () => {
  mockPhone();
  setup({ search: '?text=' + encodeURIComponent('같이 봐요 https://www.twitch.tv/chan_2') });
  await act(async () => {});
  await act(async () => {});
  expect(tiles().some((t) => t.querySelector('.tile__name')?.textContent === 'B')).toBe(true);
});

test('휴대폰 첫 실행 안내는 휴대폰 메뉴로 (전체보기·길게 누르기·채팅·하단 바·메뉴·전체 화면)', async () => {
  mockPhone();
  const { PHONE_TOUR_STEPS } = await import('../../src/ui/Onboarding');
  setup({ onboarded: false });
  const guide = await screen.findByRole('region', { name: '처음 사용 안내' }, { timeout: 4000 });
  expect(within(guide).getByText(PHONE_TOUR_STEPS[0].title)).toBeInTheDocument();
  expect(within(guide).getByText(`1 / ${PHONE_TOUR_STEPS.length}`)).toBeInTheDocument();
  const titles = PHONE_TOUR_STEPS.map((s) => s.title).join(' ');
  for (const w of ['전체보기', '길게', '채팅', '전체 화면']) expect(titles).toContain(w);
});
