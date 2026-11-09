import { act, renderHook } from '@testing-library/react';
import { isMeteredConnection, useDataSaver, useWakeLock } from '../../src/ui/useDevice';

const setNav = (key: string, value: unknown) => Object.defineProperty(navigator, key, { value, configurable: true });
afterEach(() => {
  setNav('wakeLock', undefined);
  setNav('connection', undefined);
});

test('화면 꺼짐 방지: 켜면 잡고, 끄면 놓고, 다시 보일 때 다시 잡는다', async () => {
  const release = vi.fn(() => Promise.resolve());
  const request = vi.fn(() => Promise.resolve({ release }));
  setNav('wakeLock', { request });
  const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
  await act(async () => {});
  expect(request).toHaveBeenCalledWith('screen');
  rerender({ on: false });
  expect(release).toHaveBeenCalled();
});

test('지원하지 않는 브라우저에서는 아무 일도 없다', () => {
  expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
});

test('데이터 절약: 모바일 데이터·절약 모드·느린 연결을 알아본다', () => {
  expect(isMeteredConnection(undefined)).toBe(false);
  expect(isMeteredConnection({ type: 'cellular' } as never)).toBe(true);
  expect(isMeteredConnection({ saveData: true } as never)).toBe(true);
  expect(isMeteredConnection({ effectiveType: '3g' } as never)).toBe(true);
  expect(isMeteredConnection({ type: 'wifi', effectiveType: '4g' } as never)).toBe(false);
});

test('데이터 절약 설정: 끔·자동(모바일 데이터일 때)·항상', () => {
  const conn = Object.assign(new EventTarget(), { type: 'wifi', effectiveType: '4g' });
  setNav('connection', conn);
  const { result, rerender } = renderHook(({ m }) => useDataSaver(m), { initialProps: { m: 'auto' as 'off' | 'auto' | 'on' } });
  expect(result.current).toBe(false);
  act(() => {
    conn.type = 'cellular';
    conn.dispatchEvent(new Event('change'));
  });
  expect(result.current).toBe(true);
  rerender({ m: 'off' });
  expect(result.current).toBe(false);
  rerender({ m: 'on' });
  expect(result.current).toBe(true);
});
