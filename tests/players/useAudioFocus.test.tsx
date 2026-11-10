import { renderHook } from '@testing-library/react';
import { useAudioFocus } from '../../src/players/useAudioFocus';
import type { PlayerHandle } from '../../src/players/types';

const handle = (muted = true) => {
  const h = { muted, setMuted: vi.fn((m: boolean) => { h.muted = m; }), isMuted: () => h.muted };
  return h as PlayerHandle & { muted: boolean };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('선택된 창만 unmute, 나머지 mute', () => {
  const hs = [handle(false), handle(true), handle(false)];
  renderHook(() => useAudioFocus(hs, 1, true));
  expect(hs.map((h) => h.muted)).toEqual([true, false, true]);
});

test('soundOn=false면 전부 mute', () => {
  const hs = [handle(false), handle(false)];
  renderHook(() => useAudioFocus(hs, 1, false));
  expect(hs.map((h) => h.muted)).toEqual([true, true]);
});

test('selected=null이면 전부 mute', () => {
  const hs = [handle(false), handle(false)];
  renderHook(() => useAudioFocus(hs, null, true));
  expect(hs.map((h) => h.muted)).toEqual([true, true]);
});

test('비선택 창이 외부에서 unmute되면 1000ms 안에 다시 mute', () => {
  const hs = [handle(), handle()];
  renderHook(() => useAudioFocus(hs, 0, true));
  hs[1].muted = false;
  vi.advanceTimersByTime(1000);
  expect(hs[1].muted).toBe(true);
  expect(hs[0].muted).toBe(false);
});

test('선택이 바뀌면 이전 창 mute, 새 창 unmute', () => {
  const hs = [handle(), handle()];
  const { rerender } = renderHook(({ sel }) => useAudioFocus(hs, sel, true), { initialProps: { sel: 0 } });
  expect(hs.map((h) => h.muted)).toEqual([false, true]);
  rerender({ sel: 1 });
  expect(hs.map((h) => h.muted)).toEqual([true, false]);
});

test('null handle은 건너뛴다', () => {
  const h = handle(false);
  renderHook(() => useAudioFocus([null, h], 0, true));
  expect(h.muted).toBe(true);
});

test('상태가 이미 맞으면 setMuted를 호출하지 않는다', () => {
  const h = handle(true);
  renderHook(() => useAudioFocus([h], null, true));
  vi.advanceTimersByTime(3000);
  expect(h.setMuted).not.toHaveBeenCalled();
});

test('선택된 창을 사용자가 플레이어 버튼으로 끄면 주기 검사에서 다시 켜지 않는다', () => {
  const hs = [handle()];
  renderHook(() => useAudioFocus(hs, 0, true));
  expect(hs[0].muted).toBe(false);
  hs[0].muted = true;
  vi.advanceTimersByTime(3000);
  expect(hs[0].muted).toBe(true);
});
