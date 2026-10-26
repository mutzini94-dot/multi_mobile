import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { encodeShare } from '../../src/share/shareLink';
import { mkCreator } from '../helpers/fixtures';
import type { ViewState } from '../../src/domain/types';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup(opts: { hash?: string; popup?: { closed: boolean } | null; clipboardFails?: boolean } = {}) {
  const kv = safeStorage(undefined);
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A', donateId: 'donA' }));
  favorites.add(mkCreator(2, { name: 'B', donateId: 'donB' }));
  const popup = opts.popup === undefined ? { closed: false } : opts.popup;
  const writeText = vi.fn(() => (opts.clipboardFails ? Promise.reject(new Error('no')) : Promise.resolve()));
  const win = {
    open: vi.fn(() => popup as unknown as Window),
    screen: { availWidth: 1920, availHeight: 1040 } as Screen,
    location: { hash: opts.hash ?? '', href: `http://localhost:5230/${opts.hash ?? ''}` } as Location,
    navigator: { clipboard: { writeText } } as unknown as Navigator,
  };
  render(<App favorites={favorites} kv={kv} win={win} />);
  return { win, popup, writeText, favorites };
}

const tiles = () => document.querySelectorAll('.tile');
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot] as HTMLElement).getByRole('button', { name: '불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const donate = () => fireEvent.click(screen.getByRole('button', { name: '후원하기' }));

afterEach(() => vi.useRealTimers());

test('빈 화면에서 후원하기 비활성', () => {
  setup();
  expect(tiles()).toHaveLength(4);
  expect(screen.getByRole('button', { name: '후원하기' })).toBeDisabled();
});

test('즐겨찾기 고르기 → 칸에 표시·선택 → 후원하기 → 팝업', () => {
  const { win } = setup();
  pick(0, 'A');
  expect(tiles()[0]).toHaveClass('tile--selected');
  expect(within(tiles()[0] as HTMLElement).getByText('A')).toBeInTheDocument();
  donate();
  expect(win.open).toHaveBeenCalledWith('https://toon.at/donate/donA', 'mv-donate', expect.any(String));
  expect(screen.getByText('현재 후원 창: A')).toBeInTheDocument();
});

const linkState: ViewState = {
  layout: 'split2',
  slots: [mkCreator(5, { name: 'L', donateId: 'donL' }), null],
  sizes: {},
  selected: null,
  soundOn: true,
};

test('링크로 연 크리에이터: 배지, 첫 후원은 확인, 두 번째는 바로', () => {
  const { win } = setup({ hash: encodeShare(linkState) });
  expect(tiles()).toHaveLength(2);
  expect(screen.getByText('검증되지 않음')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '원래 구성으로' })).toBeInTheDocument();
  fireEvent.click(within(tiles()[0] as HTMLElement).getByText('L'));
  donate();
  expect(win.open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '확인하고 후원' }));
  expect(win.open).toHaveBeenCalledTimes(1);
  donate();
  expect(win.open).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('확인 대화상자에서 취소하면 팝업을 열지 않는다', () => {
  const { win } = setup({ hash: encodeShare(linkState) });
  fireEvent.click(within(tiles()[0] as HTMLElement).getByText('L'));
  donate();
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(win.open).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('원래 구성으로: 레이아웃을 바꾼 뒤 링크 구성으로 복원', () => {
  setup({ hash: encodeShare(linkState) });
  fireEvent.click(screen.getByRole('button', { name: '4분할' }));
  expect(tiles()).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: '원래 구성으로' }));
  expect(tiles()).toHaveLength(2);
});

test('링크 크리에이터를 즐겨찾기에 추가', () => {
  const { favorites } = setup({ hash: encodeShare(linkState) });
  fireEvent.click(screen.getByRole('button', { name: '즐겨찾기에 추가' }));
  expect(favorites.list().map((c) => c.name)).toContain('L');
});

test("잘못된 #s= 해시는 '링크가 올바르지 않습니다'", () => {
  setup({ hash: '#s=@@@' });
  expect(screen.getByText('링크가 올바르지 않습니다')).toBeInTheDocument();
  expect(tiles()).toHaveLength(4);
});

test('팝업 차단 시 안내', () => {
  setup({ popup: null });
  pick(0, 'A');
  donate();
  expect(screen.getByText('팝업이 차단되었습니다. 팝업을 허용해 주세요')).toBeInTheDocument();
  expect(screen.queryByText(/현재 후원 창/)).toBeNull();
});

test('A 팝업 뒤 B 선택 → 경고, 팝업을 닫으면 1초 뒤 경고 사라짐', () => {
  vi.useFakeTimers();
  const { popup } = setup();
  pick(0, 'A');
  pick(1, 'B');
  fireEvent.click(within(tiles()[0] as HTMLElement).getByText('A'));
  donate();
  fireEvent.click(within(tiles()[1] as HTMLElement).getByText('B'));
  expect(screen.getByRole('alert')).toHaveTextContent('후원 창은 A, 선택된 방송은 B입니다');
  popup!.closed = true;
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.queryByRole('alert')).toBeNull();
});

test('4분할에서 4번 칸 선택 후 1+2로 바꾸면 후원하기 비활성', () => {
  setup();
  pick(3, 'A');
  expect(screen.getByRole('button', { name: '후원하기' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '1+2' }));
  expect(screen.getByRole('button', { name: '후원하기' })).toBeDisabled();
});

test("합방 링크 만들기 → 클립보드에 '#s=' URL", async () => {
  const { writeText } = setup();
  pick(0, 'A');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '합방 링크 만들기' }));
  });
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('http://localhost:5230/#s='));
  expect(screen.getByText('합방 링크를 복사했습니다')).toBeInTheDocument();
});

test('클립보드 실패 시 링크를 직접 보여준다', async () => {
  setup({ clipboardFails: true });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '합방 링크 만들기' }));
  });
  expect(screen.getByText(/복사하지 못했습니다. 아래 링크를 직접 복사하세요: http:\/\/localhost:5230\/#s=/)).toBeInTheDocument();
});
