import { act, renderHook } from '@testing-library/react';
import { useToonation } from '../../src/toonation/useToonation';
import type { BridgeRequest, ToonationBridge } from '../../src/toonation/bridge';

const fav = { tag: 'tagA', name: 'A', profile: '', channels: [{ platform: 'twitch', key: 'aaaa' }] };

function fakeBridge(impl: Partial<Record<BridgeRequest, () => unknown>>) {
  const request = vi.fn((type: BridgeRequest) => {
    const fn = impl[type];
    if (!fn) return Promise.reject(new Error('NO_EXTENSION'));
    try {
      return Promise.resolve(fn());
    } catch (e) {
      return Promise.reject(e);
    }
  });
  return { request } as unknown as ToonationBridge & { request: typeof request };
}

const flush = () => act(async () => {});

test('처음에는 idle, refresh 전에는 요청하지 않는다', () => {
  const bridge = fakeBridge({});
  const { result } = renderHook(() => useToonation(bridge));
  expect(result.current.state.status).toBe('idle');
  expect(bridge.request).not.toHaveBeenCalled();
});

test('확장이 없으면 no-extension', async () => {
  const { result } = renderHook(() => useToonation(fakeBridge({})));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.state.status).toBe('no-extension');
});

test('로그인 안 됨이면 logged-out', async () => {
  const { result } = renderHook(() => useToonation(fakeBridge({ status: () => ({ account: null }) })));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.state.status).toBe('logged-out');
});

test('로그인 상태면 즐겨찾기를 불러와 ready', async () => {
  const { result } = renderHook(() =>
    useToonation(fakeBridge({ status: () => ({ account: { name: '나' } }), favorites: () => [fav] })),
  );
  await act(async () => { await result.current.refresh(); });
  expect(result.current.state.status).toBe('ready');
  expect(result.current.state.account).toEqual({ name: '나' });
  expect(result.current.state.creators.map((c) => c.donateId)).toEqual(['tagA']);
});

test('즐겨찾기 요청이 실패하면 error와 메시지', async () => {
  const { result } = renderHook(() =>
    useToonation(fakeBridge({ status: () => ({ account: { name: '나' } }), favorites: () => { throw new Error('HTTP 500'); } })),
  );
  await act(async () => { await result.current.refresh(); });
  expect(result.current.state.status).toBe('error');
  expect(result.current.state.error).toBe('HTTP 500');
});

describe('login', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('로그인 창을 열고, 로그인이 감지되면 목록을 불러온다', async () => {
    let account: unknown = null;
    const bridge = fakeBridge({ login: () => ({}), status: () => ({ account }), favorites: () => [fav] });
    const { result } = renderHook(() => useToonation(bridge, { pollMs: 2000, maxWaitMs: 180000 }));
    await act(async () => { await result.current.login(); });
    expect(bridge.request).toHaveBeenCalledWith('login');
    expect(result.current.state.status).toBe('waiting-login');
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.state.status).toBe('waiting-login');
    account = { name: '나' };
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.state.status).toBe('ready');
  });

  test('최대 대기 시간이 지나면 logged-out으로 돌아가고 확인을 멈춘다', async () => {
    const bridge = fakeBridge({ login: () => ({}), status: () => ({ account: null }) });
    const { result } = renderHook(() => useToonation(bridge, { pollMs: 1000, maxWaitMs: 3000 }));
    await act(async () => { await result.current.login(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(result.current.state.status).toBe('logged-out');
    const calls = bridge.request.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(bridge.request.mock.calls.length).toBe(calls);
  });
});
