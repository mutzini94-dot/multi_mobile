import { renderHook } from '@testing-library/react';
import { useAudioMix } from '../../src/players/useAudioFocus';
import { usePlaybackPolicy } from '../../src/players/usePlaybackPolicy';
import type { PlayerHandle } from '../../src/players/types';

function handle() {
  const h = {
    muted: true,
    volume: 100,
    paused: false,
    low: false,
    calls: [] as string[],
    setMuted: vi.fn((m: boolean) => { h.muted = m; }),
    isMuted: () => h.muted,
    setVolume: vi.fn((v: number) => { h.volume = v; }),
    setPaused: vi.fn((p: boolean) => { h.paused = p; h.calls.push(p ? 'pause' : 'play'); }),
    setLowQuality: vi.fn((l: boolean) => { h.low = l; h.calls.push(l ? 'low' : 'auto'); }),
  };
  return h as typeof h & PlayerHandle;
}

describe('useAudioMix', () => {
  test('들리는 칸만 소리를 켜고 칸별 볼륨을 적용한다 (여러 칸 동시)', () => {
    const hs = [handle(), handle(), handle()];
    renderHook(() => useAudioMix(hs, [true, true, false], [80, 30, 100]));
    expect(hs.map((h) => h.muted)).toEqual([false, false, true]);
    expect(hs[0].volume).toBe(80);
    expect(hs[1].volume).toBe(30);
  });

  test('볼륨이 바뀔 때만 다시 적용한다', () => {
    const h = handle();
    const { rerender } = renderHook(({ v }) => useAudioMix([h], [true], [v]), { initialProps: { v: 50 } });
    rerender({ v: 50 });
    expect(h.setVolume).toHaveBeenCalledTimes(1);
    rerender({ v: 20 });
    expect(h.setVolume).toHaveBeenLastCalledWith(20);
  });
});

describe('usePlaybackPolicy', () => {
  test('숨긴 칸은 정지하고, 다시 보이면 재생한다 (바뀔 때만 명령)', () => {
    const hs = [handle(), handle()];
    const { rerender } = renderHook(({ pause }) => usePlaybackPolicy(hs, pause, [false, false]), { initialProps: { pause: [false, true] } });
    expect(hs[1].calls).toEqual(['pause']);
    expect(hs[0].calls).toEqual([]); // 처음부터 재생 중이면 건드리지 않는다
    rerender({ pause: [false, true] });
    expect(hs[1].calls).toEqual(['pause']);
    rerender({ pause: [false, false] });
    expect(hs[1].calls).toEqual(['pause', 'play']);
  });

  test('낮은 화질 켜고 끄기, 지원하지 않는 플레이어(유튜브)는 건너뛴다', () => {
    const tw = handle();
    const yt = handle() as PlayerHandle;
    delete (yt as Partial<PlayerHandle>).setLowQuality;
    const { rerender } = renderHook(({ low }) => usePlaybackPolicy([tw, yt], [false, false], low), { initialProps: { low: [true, true] } });
    expect(tw.calls).toEqual(['low']);
    rerender({ low: [false, true] });
    expect(tw.calls).toEqual(['low', 'auto']);
  });
});
