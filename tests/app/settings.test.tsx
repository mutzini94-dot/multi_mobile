import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { HOST_KEY } from '../../src/host/hostProfile';
import { SETTINGS_KEY } from '../../src/settings/settings';
import { safeStorage } from '../../src/storage/safeStorage';
import type { DesktopApi } from '../../src/desktop/desktopApi';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function desktopApi(over: Partial<DesktopApi> = {}): DesktopApi {
  return {
    status: vi.fn().mockResolvedValue({ ok: true, data: { account: { name: '나' } } }),
    login: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    logout: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    favorites: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    openDonate: vi.fn(),
    closeDonate: vi.fn(),
    setDonateBounds: vi.fn(),
    setDonateMode: vi.fn(),
    fillDonate: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    onDonateClosed: vi.fn(() => () => {}),
    onDonateMode: vi.fn(() => () => {}),
    ...over,
  };
}

function setup({ desktop = null as DesktopApi | null, bridge }: { desktop?: DesktopApi | null; bridge?: ToonationBridge } = {}) {
  const kv = safeStorage(undefined);
  kv.set(HOST_KEY, JSON.stringify({ name: '나', donateId: 'myTag', platform: 'twitch', channel: 'my_ch' }));
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={bridge ?? (desktop ? undefined : noBridge)} desktop={desktop} />);
  return { kv, favorites };
}

const openSettings = () => {
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  return screen.getByRole('dialog', { name: '설정' });
};

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

test('설정 창: 테마를 바꾸면 바로 적용되고 저장된다', () => {
  const { kv } = setup();
  const dlg = openSettings();
  fireEvent.change(within(dlg).getByLabelText('테마'), { target: { value: 'dark' } });
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(JSON.parse(kv.get(SETTINGS_KEY)!).theme).toBe('dark');
  fireEvent.change(within(dlg).getByLabelText('테마'), { target: { value: 'system' } });
  expect(document.documentElement.dataset.theme).toBeUndefined();
});

test('설정 창: 웹에서는 설치형 전용 항목(항상 위·빠른 후원·후원창 모드)을 보여주지 않는다', () => {
  setup();
  const dlg = openSettings();
  expect(within(dlg).queryByLabelText('항상 위에 표시')).toBeNull();
  expect(within(dlg).queryByLabelText('빠른 후원 금액')).toBeNull();
  expect(within(dlg).queryByLabelText('후원창 기본 모드')).toBeNull();
});

test('설정 창(설치형): 항상 위에 표시를 켜면 앱에 전달한다', () => {
  const desktop = desktopApi();
  setup({ desktop });
  expect(desktop.setAlwaysOnTop).toHaveBeenCalledWith(false); // 시작 시 저장된 값 적용
  const dlg = openSettings();
  fireEvent.click(within(dlg).getByLabelText('항상 위에 표시'));
  expect(desktop.setAlwaysOnTop).toHaveBeenLastCalledWith(true);
});

test('설정 창: 빠른 후원 금액은 쉼표로 입력하고 잘못된 값은 걸러진다 (설치형)', () => {
  const { kv } = setup({ desktop: desktopApi() });
  const dlg = openSettings();
  const input = within(dlg).getByLabelText('빠른 후원 금액');
  fireEvent.change(input, { target: { value: '1,000, 3000, abc, -5, 20000' } });
  fireEvent.blur(input);
  expect(JSON.parse(kv.get(SETTINGS_KEY)!).quickAmounts).toEqual([1000, 3000, 20000]);
});

test('설정 창: 내 방송 정보와 시청 페이지 주소를 바꿀 수 있다', () => {
  const { kv } = setup();
  const dlg = openSettings();
  expect(within(dlg).getByText(/나 · Twitch · my_ch/)).toBeInTheDocument();
  fireEvent.click(within(dlg).getByRole('button', { name: '내 방송 정보 수정' }));
  const host = screen.getByRole('dialog', { name: '내 방송 정보' });
  fireEvent.change(within(host).getByLabelText('이름'), { target: { value: '새이름' } });
  fireEvent.click(within(host).getByRole('button', { name: '저장' }));
  expect(JSON.parse(kv.get(HOST_KEY)!).name).toBe('새이름');
  const base = within(screen.getByRole('dialog', { name: '설정' })).getByLabelText('시청 페이지 주소');
  fireEvent.change(base, { target: { value: 'https://mv.example.com/' } });
  fireEvent.blur(base);
  expect(kv.get('mv.publicBase.v1')).toBe('https://mv.example.com/');
});

test('설정 창: 즐겨찾기 순서 바꾸기', () => {
  const { favorites } = setup();
  const dlg = openSettings();
  fireEvent.click(within(dlg).getByRole('button', { name: 'B 위로' }));
  expect(favorites.list().map((c) => c.name)).toEqual(['B', 'A']);
  expect(within(dlg).getAllByRole('listitem').map((li) => li.textContent?.slice(0, 1))).toEqual(['B', 'A']);
});

test('설정 창: 즐겨찾기 가져오기', async () => {
  const { favorites } = setup();
  const dlg = openSettings();
  const file = new File([JSON.stringify({ version: 1, favorites: [{ name: 'C', donateId: 'c1', platform: 'twitch', channel: 'cccc' }] })], 'fav.json', { type: 'application/json' });
  await act(async () => {
    fireEvent.change(within(dlg).getByLabelText('즐겨찾기 가져오기'), { target: { files: [file] } });
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(favorites.list().map((c) => c.name)).toEqual(['A', 'B', 'C']);
  expect(within(dlg).getByText('즐겨찾기 1개를 가져왔습니다')).toBeInTheDocument();
});

test('설정 창(설치형): 투네이션 로그아웃', async () => {
  const desktop = desktopApi();
  setup({ desktop });
  const dlg = openSettings();
  const btn = await within(dlg).findByRole('button', { name: '투네이션 로그아웃' }); // 열 때 로그인 상태 확인
  await act(async () => {
    fireEvent.click(btn);
  });
  expect(within(dlg).getByText('로그인하지 않음')).toBeInTheDocument();
  expect(desktop.logout).toHaveBeenCalled();
});

test('설정 창: 방송 시작 알림을 켜면 알림 권한을 묻는다', () => {
  const requestPermission = vi.fn().mockResolvedValue('granted');
  vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'default', requestPermission }));
  try {
    const { kv } = setup();
    const dlg = openSettings();
    fireEvent.click(within(dlg).getByLabelText('즐겨찾기 방송 시작 알림'));
    expect(requestPermission).toHaveBeenCalled();
    expect(JSON.parse(kv.get(SETTINGS_KEY)!).liveNotify).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
});
