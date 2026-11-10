import { nativeToonationBridge } from '../../src/native/toonation/nativeBridge';

// 안드로이드 앱의 투네이션 연동 플러그인을 흉내: 주소에 따라 투네이션 응답을 돌려준다
const { calls, flags, plugin } = vi.hoisted(() => {
const calls: { url: string; method?: string }[] = [];
const flags = { loggedIn: false };
const plugin = {
  fetch: vi.fn(async ({ url, method }: { url: string; method?: string }) => {
    calls.push({ url, method });
    const json = (o: unknown) => ({ status: 200, url, body: JSON.stringify(o) });
    if (url.endsWith('/dapi/donator/common')) return json({ Account: flags.loggedIn ? { DisplayName: '후원자', Cash: 5000, TitleHash: 'abc' } : null });
    if (url.includes('/dapi/donator/favorites/1/5/1'))
      return flags.loggedIn ? json({ list: [{ tag: 'crea1', name: '크리', channel: [{ url: 'https://www.twitch.tv/abc_chan' }] }], PageInfo: { PageCount: 1 } }) : { status: 200, url: 'https://toon.at/donator/login', body: '<html>' };
    return { status: 404, url, body: '' };
  }),
  cookies: vi.fn(async () => ({ cookies: [] })),
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
};
return { calls, flags, plugin };
});
vi.mock('@capacitor/core', () => ({ registerPlugin: () => plugin, Capacitor: { isNativePlatform: () => true } }));

beforeEach(() => {
  calls.length = 0;
  flags.loggedIn = false;
});

test('로그인 전: 상태는 계정 없음, 즐겨찾기는 NOT_LOGGED_IN, 로그인은 공식 로그인 화면을 연다', async () => {
  const b = nativeToonationBridge();
  expect(await b.request('status')).toEqual({ account: null });
  await expect(b.request('favorites')).rejects.toThrow('NOT_LOGGED_IN');
  await b.request('login');
  expect(plugin.login).toHaveBeenCalled();
  expect(calls.every((c) => new URL(c.url).hostname.endsWith('toon.at') || c.url.includes('twitch') || c.url.includes('youtube'))).toBe(true);
});

test('로그인 뒤: 계정(이름·캐시)과 투네이션 즐겨찾기를 앱이 대신 가져온다, 로그아웃은 앱의 로그인 쿠키를 지운다', async () => {
  flags.loggedIn = true;
  const b = nativeToonationBridge();
  expect(await b.request('status')).toMatchObject({ account: { name: '후원자', cash: 5000 } });
  const favs = await b.request<{ tag: string; name: string; channels: { platform: string; key: string }[] }[]>('favorites');
  expect(favs[0]).toMatchObject({ tag: 'crea1', name: '크리', channels: [expect.objectContaining({ platform: 'twitch', key: 'abc_chan' })] });
  await b.request('logout');
  expect(plugin.logout).toHaveBeenCalled();
});
