import { donatePageUrl, followDonateCreator, isPage, isStream, makeActivityPage, makeDonatePage, makeWebPage, normalizePageUrl } from '../../src/domain/pages';
import { viewReducer, initialViewState } from '../../src/app/viewState';
import { loadLastView, saveLastView } from '../../src/app/lastView';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ViewState } from '../../src/domain/types';
import { mkCreator } from '../helpers/fixtures';

test('normalizePageUrl: 주소만 넣어도 https로, http·https 외에는 거부', () => {
  expect(normalizePageUrl('naver.com')).toEqual({ ok: true, value: 'https://naver.com/' });
  expect(normalizePageUrl('  https://www.youtube.com/watch?v=abc ')).toEqual({ ok: true, value: 'https://www.youtube.com/watch?v=abc' });
  expect(normalizePageUrl('http://example.com')).toEqual({ ok: true, value: 'http://example.com/' });
  expect(normalizePageUrl('javascript:alert(1)').ok).toBe(false);
  expect(normalizePageUrl('file:///C:/x').ok).toBe(false);
  expect(normalizePageUrl('').ok).toBe(false);
  expect(normalizePageUrl('not a url').ok).toBe(false);
});

test('makeWebPage: 이름은 사이트 주소(www 제외), 키는 창마다 다르다', () => {
  const a = makeWebPage('https://www.naver.com/');
  const b = makeWebPage('https://www.naver.com/');
  expect(a.ok && a.value).toMatchObject({ kind: 'web', name: 'naver.com', url: 'https://www.naver.com/' });
  expect(a.ok && b.ok && a.value.key !== b.value.key).toBe(true);
  expect(makeWebPage('ftp://x').ok).toBe(false);
});

test('isStream: 방송만 true', () => {
  expect(isStream(mkCreator(1))).toBe(true);
  expect(isStream(makeDonatePage())).toBe(false);
  expect(isStream(null)).toBe(false);
});

test('donatePageUrl: 투네이션 후원 페이지 주소', () => {
  expect(donatePageUrl(mkCreator(1))).toBe('https://toon.at/donate/don1');
});

describe('후원 페이지 창이 따라갈 크리에이터', () => {
  const a = mkCreator(1);
  const b = mkCreator(2);
  const base: ViewState = { ...initialViewState, slots: [a, makeDonatePage(), b, null] };

  test('선택한 방송이 있으면 그 방송', () => {
    expect(followDonateCreator({ ...base, selected: 2 }, a)).toBe(b);
  });
  test('선택이 없으면 마지막으로 따라간 방송 (아직 창에 있을 때)', () => {
    expect(followDonateCreator({ ...base, selected: null }, b)).toBe(b);
  });
  test('마지막 방송이 창에서 빠졌으면 보이는 첫 방송', () => {
    expect(followDonateCreator({ ...base, selected: null }, mkCreator(9))).toBe(a);
  });
  test('방송이 없으면 null', () => {
    expect(followDonateCreator({ ...initialViewState, slots: [makeDonatePage(), null, null, null] }, null)).toBeNull();
  });
});

describe('viewReducer: 페이지 창', () => {
  const a = mkCreator(1);
  test('assignPage는 창에 넣되 선택(소리)은 바꾸지 않는다', () => {
    const s1 = viewReducer({ ...initialViewState, slots: [a, null, null, null], selected: 0 }, { type: 'assignPage', slot: 1, page: makeDonatePage() });
    expect(s1.slots[1]).toMatchObject({ kind: 'donate' });
    expect(s1.selected).toBe(0);
  });
  test('선택된 방송 창을 페이지로 바꾸면 선택을 푼다', () => {
    const s = viewReducer({ ...initialViewState, slots: [a, null, null, null], selected: 0 }, { type: 'assignPage', slot: 0, page: makeDonatePage() });
    expect(s.selected).toBeNull();
  });
  test('페이지 창은 선택되지 않는다 (방송 소리가 꺼지지 않게)', () => {
    const s = { ...initialViewState, slots: [a, makeDonatePage(), null, null], selected: 0 };
    expect(viewReducer(s, { type: 'select', slot: 1 }).selected).toBe(0);
  });
});

test('마지막 화면 복원: 후원 페이지·웹페이지 창도 저장하고 불러온다', () => {
  const kv = safeStorage(undefined);
  const web = makeWebPage('https://www.naver.com/');
  if (!web.ok) throw new Error();
  saveLastView(kv, { ...initialViewState, slots: [mkCreator(1), makeDonatePage(), web.value, null] });
  const v = loadLastView(kv)!;
  expect(v.slots[0]).toMatchObject({ name: '크리에이터1' });
  expect(v.slots[1]).toMatchObject({ kind: 'donate' });
  expect(v.slots[2]).toMatchObject({ kind: 'web', url: 'https://www.naver.com/', name: 'naver.com' });
});

test('마지막 화면 복원: 이상한 주소의 웹페이지 창은 버린다', () => {
  const kv = safeStorage(undefined);
  kv.set('mv.lastView.v1', JSON.stringify({ v: 1, layout: 'quad', sizes: {}, slots: [{ kind: 'web', url: 'javascript:alert(1)' }, null, null, null] }));
  expect(loadLastView(kv)!.slots[0]).toBeNull();
});

test('활동 위젯 창은 페이지 창', () => {
  const p = makeActivityPage();
  expect(p).toMatchObject({ kind: 'activity', name: '활동 위젯' });
  expect(isPage(p)).toBe(true);
  expect(isStream(p)).toBe(false);
});

test('활동 위젯 창도 마지막 화면으로 저장·복원된다', () => {
  const kv = safeStorage(undefined);
  const slots = Array(9).fill(null);
  slots[1] = makeActivityPage();
  saveLastView(kv, { ...initialViewState, slots });
  expect(loadLastView(kv)?.slots[1]).toMatchObject({ kind: 'activity', name: '활동 위젯' });
});

test('pageTarget: 고정한 방송이 있으면 그 방송, 없으면 따라가는 방송 (웹·활동 창은 없음)', async () => {
  const { pageTarget, makeSignaturePage, makeChatPage, makeWebPage } = await import('../../src/domain/pages');
  const follow = mkCreator(1);
  const pinned = mkCreator(2);
  expect(pageTarget(makeSignaturePage(), follow)).toBe(follow);
  expect(pageTarget({ ...makeChatPage(), pin: pinned }, follow)).toBe(pinned);
  expect(pageTarget({ ...makeDonatePage(), pin: pinned }, null)).toBe(pinned);
  const w = makeWebPage('naver.com');
  expect(w.ok && pageTarget(w.value, follow)).toBeNull();
});

test('고정한 방송도 마지막 화면으로 저장·복원된다', async () => {
  const { makeSignaturePage } = await import('../../src/domain/pages');
  const kv = safeStorage(undefined);
  const slots = Array(9).fill(null);
  slots[3] = { ...makeSignaturePage(), pin: mkCreator(5, { name: '다섯', donateId: 'five' }) };
  saveLastView(kv, { ...initialViewState, slots });
  expect(loadLastView(kv)?.slots[3]).toMatchObject({ kind: 'signature', pin: { name: '다섯', donateId: 'five', channel: 'chan_5', platform: 'twitch' } });
});

test('후원 페이지를 창 안에 띄울 수 있는 주소: 투네이션이 허용한 곳(localhost)과 설정으로 더한 주소만', async () => {
  const { canFrameDonate } = await import('../../src/domain/pages');
  expect(canFrameDonate('localhost')).toBe(true);
  expect(canFrameDonate('127.0.0.1')).toBe(true);
  expect(canFrameDonate('multi-mobile.vercel.app')).toBe(false);
  expect(canFrameDonate('multi-mobile.vercel.app', 'multi-mobile.vercel.app, mv.toon.at')).toBe(true);
  expect(canFrameDonate('mv.toon.at', 'multi-mobile.vercel.app, mv.toon.at')).toBe(true);
  expect(canFrameDonate('evil.vercel.app', 'multi-mobile.vercel.app')).toBe(false);
});
