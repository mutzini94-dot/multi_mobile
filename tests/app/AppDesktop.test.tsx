import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { encodeShare } from '../../src/share/shareLink';
import type { DesktopApi } from '../../src/desktop/desktopApi';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const tFav = { tag: 'tagT', name: '투네A', profile: '', channels: [{ platform: 'twitch', key: 'toon_a' }] };

function setup(hash = '') {
  let closedCb: (() => void) | null = null;
  const desktop: DesktopApi = {
    status: vi.fn().mockResolvedValue({ ok: true, data: { account: { name: '나' } } }),
    login: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    favorites: vi.fn().mockResolvedValue({ ok: true, data: [tFav] }),
    openDonate: vi.fn(),
    closeDonate: vi.fn(),
    setDonateBounds: vi.fn(),
    onDonateClosed: vi.fn((cb) => {
      closedCb = cb;
      return () => {};
    }),
  };
  const kv = safeStorage(undefined);
  const win = {
    open: vi.fn(),
    screen: {} as Screen,
    location: { hash, href: `http://localhost:5230/${hash}` } as Location,
    navigator: {} as Navigator,
  };
  render(<App favorites={localFavorites(kv)} kv={kv} win={win} desktop={desktop} />);
  return { desktop, win, closeFromApp: () => act(() => closedCb?.()) };
}

const tiles = () => document.querySelectorAll('.tile');

async function pickToon() {
  fireEvent.click(within(tiles()[0] as HTMLElement).getByRole('button', { name: '불러오기' }));
  fireEvent.click(await screen.findByRole('button', { name: /^투네A · Twitch/ }));
}

test('설치형: 불러오기 창은 앱의 투네이션 로그인 정보로 즐겨찾기를 보여준다', async () => {
  const { desktop } = setup();
  await pickToon();
  expect(desktop.status).toHaveBeenCalled();
  expect(desktop.favorites).toHaveBeenCalled();
  expect(within(tiles()[0] as HTMLElement).getByText('투네A')).toBeInTheDocument();
});

test('설치형: 후원하기는 팝업 대신 앱의 후원 패널을 열고, 패널 머리에 대상과 닫기를 보여준다', async () => {
  const { desktop, win } = setup();
  await pickToon();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  expect(win.open).not.toHaveBeenCalled();
  expect(desktop.openDonate).toHaveBeenCalledWith({ tag: 'tagT', name: '투네A' });
  const panel = screen.getByRole('complementary', { name: '후원 패널' });
  expect(within(panel).getByText('투네A에게 후원')).toBeInTheDocument();
  expect(desktop.setDonateBounds).toHaveBeenCalled();
  fireEvent.click(within(panel).getByRole('button', { name: '후원 패널 닫기' }));
  expect(desktop.closeDonate).toHaveBeenCalled();
  expect(screen.queryByRole('complementary', { name: '후원 패널' })).toBeNull();
});

test('설치형: 앱이 패널을 닫았다고 알리면 패널 자리도 사라진다', async () => {
  const { closeFromApp } = setup();
  await pickToon();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  expect(screen.getByRole('complementary', { name: '후원 패널' })).toBeInTheDocument();
  closeFromApp();
  expect(screen.queryByRole('complementary', { name: '후원 패널' })).toBeNull();
});

test('설치형: 패널이 열린 채 다른 방송을 고르면 대상 불일치 경고', async () => {
  const kvState = encodeShare({
    layout: 'split2',
    slots: [mkCreator(1, { name: 'A' }), mkCreator(2, { name: 'B' })],
    sizes: {},
    selected: null,
    soundOn: true,
  });
  const { desktop } = setup(kvState);
  fireEvent.click(within(tiles()[0] as HTMLElement).getByText('A'));
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  fireEvent.click(screen.getByRole('button', { name: '확인하고 후원' }));
  expect(desktop.openDonate).toHaveBeenCalledWith({ tag: 'don1', name: 'A' });
  fireEvent.click(within(tiles()[1] as HTMLElement).getByText('B'));
  expect(screen.getByRole('alert')).toHaveTextContent('후원 창은 A, 선택된 방송은 B입니다');
});
