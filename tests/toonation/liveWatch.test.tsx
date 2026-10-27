import { renderHook } from '@testing-library/react';
import { newlyLive, useLiveWatch } from '../../src/toonation/liveWatch';
import type { Creator } from '../../src/domain/types';
import { mkCreator } from '../helpers/fixtures';

const live = (c: Creator, title = '방송 중'): Creator => ({ ...c, live: { title, viewers: 1 } });
const a = mkCreator(1, { source: 'toonation' });
const b = mkCreator(2, { source: 'toonation' });

test('newlyLive: 이전 목록에서 꺼져 있다가 켜진 방송만', () => {
  expect(newlyLive([a, live(b)], [live(a), live(b)]).map((c) => c.key)).toEqual([a.key]);
  expect(newlyLive([], [live(a)])).toEqual([]); // 처음 불러온 목록은 알리지 않는다
  expect(newlyLive([a], [a, live(b)])).toEqual([]); // 새로 생긴 즐겨찾기도 알리지 않는다
});

describe('useLiveWatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('N분마다 갱신하고, 끄면 멈춘다', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook((p: Parameters<typeof useLiveWatch>[0]) => useLiveWatch(p), {
      initialProps: { minutes: 3, active: true, refresh, creators: [] as Creator[], notifyOn: false, notify: vi.fn() },
    });
    vi.advanceTimersByTime(3 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    rerender({ minutes: 0, active: true, refresh, creators: [], notifyOn: false, notify: vi.fn() });
    vi.advanceTimersByTime(10 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test('로그아웃·연동 없음(active=false)이면 갱신하지 않는다', () => {
    const refresh = vi.fn();
    renderHook(() => useLiveWatch({ minutes: 1, active: false, refresh, creators: [], notifyOn: false, notify: vi.fn() }));
    vi.advanceTimersByTime(5 * 60_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('알림을 켜면 방송이 새로 시작된 즐겨찾기를 알린다', () => {
    const notify = vi.fn();
    const props = { minutes: 1, active: true, refresh: vi.fn(), notifyOn: true, notify };
    const { rerender } = renderHook((p: Parameters<typeof useLiveWatch>[0]) => useLiveWatch(p), { initialProps: { ...props, creators: [a, b] } });
    rerender({ ...props, creators: [live(a, '저녁 방송'), b] });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({ key: a.key, live: { title: '저녁 방송' } });
    rerender({ ...props, creators: [live(a, '저녁 방송'), b] }); // 계속 라이브 → 다시 알리지 않음
    expect(notify).toHaveBeenCalledTimes(1);
  });

  test('알림을 끄면 알리지 않는다', () => {
    const notify = vi.fn();
    const props = { minutes: 1, active: true, refresh: vi.fn(), notifyOn: false, notify };
    const { rerender } = renderHook((p: Parameters<typeof useLiveWatch>[0]) => useLiveWatch(p), { initialProps: { ...props, creators: [a] } });
    rerender({ ...props, creators: [live(a)] });
    expect(notify).not.toHaveBeenCalled();
  });
});
