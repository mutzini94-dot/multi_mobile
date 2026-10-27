import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { DesktopApi } from '../../src/desktop/desktopApi';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const tFav = { tag: 'tagT', name: '투네A', profile: '', channels: [{ platform: 'twitch', key: 'toon_a' }] };

function setup(hash = '') {
  let closedCb: (() => void) | null = null;
  let modeCb: ((m: 'modal' | 'pip') => void) | null = null;
  const desktop: DesktopApi = {
    status: vi.fn().mockResolvedValue({ ok: true, data: { account: { name: '나' } } }),
    login: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    favorites: vi.fn().mockResolvedValue({ ok: true, data: [tFav] }),
    openDonate: vi.fn(),
    closeDonate: vi.fn(),
    setDonateBounds: vi.fn(),
    setDonateMode: vi.fn(),
    onDonateClosed: vi.fn((cb) => {
      closedCb = cb;
      return () => {};
    }),
    onDonateMode: vi.fn((cb) => {
      modeCb = cb;
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
  return {
    desktop,
    win,
    closeFromApp: () => act(() => closedCb?.()),
    modeFromApp: (m: 'modal' | 'pip') => act(() => modeCb?.(m)),
  };
}

const tiles = () => document.querySelectorAll('.tile');
const donateDialog = () => screen.queryByRole('dialog', { name: '후원창' });

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

test('설치형: 후원하기는 팝업 대신 앱 가운데 모달 후원창을 연다', async () => {
  const { desktop, win } = setup();
  await pickToon();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  expect(win.open).not.toHaveBeenCalled();
  expect(desktop.openDonate).toHaveBeenCalledWith({ tag: 'tagT', name: '투네A' });
  const dialog = donateDialog()!;
  expect(within(dialog).getByText('투네A에게 후원')).toBeInTheDocument();
  expect(desktop.setDonateBounds).toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: '후원창 닫기' }));
  expect(desktop.closeDonate).toHaveBeenCalled();
  expect(donateDialog()).toBeNull();
});

test('설치형: Esc로 모달 후원창을 닫는다', async () => {
  const { desktop } = setup();
  await pickToon();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(desktop.closeDonate).toHaveBeenCalled();
  expect(donateDialog()).toBeNull();
});

test('설치형: PIP 모드로 바꾸면 모달이 사라지고 하단에 PIP 상태와 되돌리기·닫기가 보인다', async () => {
  const { desktop, modeFromApp } = setup();
  await pickToon();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  fireEvent.click(within(donateDialog()!).getByRole('button', { name: 'PIP 모드' }));
  expect(desktop.setDonateMode).toHaveBeenCalledWith('pip');
  modeFromApp('pip');
  expect(donateDialog()).toBeNull();
  const bar = screen.getByRole('status', { name: 'PIP 후원창' });
  expect(bar).toHaveTextContent('PIP 창에서 후원 중: 투네A');
  fireEvent.click(within(bar).getByRole('button', { name: '모달로 보기' }));
  expect(desktop.setDonateMode).toHaveBeenLastCalledWith('modal');
  modeFromApp('modal');
  expect(donateDialog()).not.toBeNull();
});

test('설치형: PIP 상태에서 닫기', async () => {
  const { desktop, modeFromApp } = setup();
  await pickToon();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  modeFromApp('pip');
  fireEvent.click(within(screen.getByRole('status', { name: 'PIP 후원창' })).getByRole('button', { name: '후원창 닫기' }));
  expect(desktop.closeDonate).toHaveBeenCalled();
  expect(screen.queryByRole('status', { name: 'PIP 후원창' })).toBeNull();
});

test('설치형: 앱이 후원창을 닫았다고 알리면(PIP 창 ✕ 등) 모달·PIP 표시가 사라진다', async () => {
  const { closeFromApp, modeFromApp } = setup();
  await pickToon();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  modeFromApp('pip');
  closeFromApp();
  expect(donateDialog()).toBeNull();
  expect(screen.queryByRole('status', { name: 'PIP 후원창' })).toBeNull();
});

test('설치형: 후원창이 열린 채 다른 방송을 고르면 대상 불일치 경고', async () => {
  const { desktop, modeFromApp } = setup();
  await pickToon();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  expect(desktop.openDonate).toHaveBeenCalledWith({ tag: 'tagT', name: '투네A' });
  modeFromApp('pip');
  fireEvent.click(within(tiles()[1] as HTMLElement).getByRole('button', { name: '불러오기' }));
  fireEvent.click(await screen.findByRole('button', { name: /^투네A · Twitch/ }));
  // 같은 크리에이터를 두 칸에 띄운 경우는 경고 없음 → 직접 추가한 다른 방송으로 확인
  fireEvent.click(within(tiles()[0] as HTMLElement).getByText('투네A'));
  expect(screen.queryByRole('alert')).toBeNull();
});
