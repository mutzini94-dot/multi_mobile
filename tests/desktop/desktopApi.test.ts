import { desktopBridge, getDesktopApi, type DesktopApi } from '../../src/desktop/desktopApi';

const api = (over: Partial<DesktopApi> = {}): DesktopApi => ({
  status: vi.fn().mockResolvedValue({ ok: true, data: { account: { name: '나' } } }),
  login: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  logout: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  fillDonate: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  favorites: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  openDonate: vi.fn(),
  closeDonate: vi.fn(),
  setDonateBounds: vi.fn(),
  setDonateMode: vi.fn(),
  onDonateClosed: vi.fn(() => () => {}),
  onDonateMode: vi.fn(() => () => {}),
  ...over,
});

test('getDesktopApi: 설치형 앱이 노출한 객체가 있을 때만 돌려준다', () => {
  expect(getDesktopApi({} as Window)).toBeNull();
  const a = api();
  expect(getDesktopApi({ multiviewDesktop: a } as unknown as Window)).toBe(a);
  expect(getDesktopApi({ multiviewDesktop: { status: 1 } } as unknown as Window)).toBeNull();
});

test('desktopBridge: ok면 data를 돌려준다', async () => {
  const b = desktopBridge(api());
  await expect(b.request('status')).resolves.toEqual({ account: { name: '나' } });
});

test('desktopBridge: ok가 아니면 error 메시지로 실패한다', async () => {
  const b = desktopBridge(api({ favorites: vi.fn().mockResolvedValue({ ok: false, error: 'NOT_LOGGED_IN' }) }));
  await expect(b.request('favorites')).rejects.toThrow('NOT_LOGGED_IN');
});

test('desktopBridge: login은 로그인 창을 연다', async () => {
  const a = api();
  await desktopBridge(a).request('login');
  expect(a.login).toHaveBeenCalled();
});
