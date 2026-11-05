import { act, render } from '@testing-library/react';
import { StreamPlayer } from '../../src/players/StreamPlayer';
import { TWITCH_START_TIMEOUT_MS } from '../../src/players/TwitchPlayer';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/loadScript', () => ({ loadScript: vi.fn().mockResolvedValue(undefined) }));

// 트위치 임베드는 영상 위에 다른 요소가 겹쳐 있으면 '보이지 않는다'고 보고 자동 재생을 막는다.
// 그래서 가려져 있으면 걷힐 때까지 기다렸다 띄우고, 시작하는 동안(onStarting true) 앱이 겹치는 층을 숨긴다.
function fakeTwitch() {
  const players: { listeners: Record<string, () => void> }[] = [];
  const Player: any = vi.fn(() => {
    const p = { listeners: {} as Record<string, () => void>, setMuted: vi.fn(), getMuted: vi.fn(), addEventListener: vi.fn((e: string, cb: () => void) => (p.listeners[e] = cb)) };
    players.push(p);
    return p;
  });
  Object.assign(Player, { READY: 'ready', ONLINE: 'online', OFFLINE: 'offline', PLAYING: 'playing' });
  (window as any).Twitch = { Player };
  return { Player, players, last: () => players[players.length - 1] };
}
const flush = () => act(async () => {});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  delete (window as any).Twitch;
});

test('시작하는 동안 starting, 재생이 시작되면 끝', async () => {
  const tw = fakeTwitch();
  const onStarting = vi.fn();
  render(<StreamPlayer creator={mkCreator(1)} onReady={() => {}} onStarting={onStarting} />);
  await flush();
  expect(onStarting).toHaveBeenLastCalledWith(true);
  act(() => tw.last().listeners.online());
  act(() => tw.last().listeners.playing());
  expect(onStarting).toHaveBeenLastCalledWith(false);
  act(() => vi.advanceTimersByTime(TWITCH_START_TIMEOUT_MS * 3));
  expect(tw.Player).toHaveBeenCalledTimes(1);
});

test('방송 중인데 재생이 시작되지 않으면(막힘) 기다리기를 그만두고 다시 띄우지 않는다', async () => {
  const tw = fakeTwitch();
  const onStarting = vi.fn();
  render(<StreamPlayer creator={mkCreator(1)} onReady={() => {}} onStarting={onStarting} />);
  await flush();
  act(() => tw.last().listeners.online());
  expect(onStarting).toHaveBeenLastCalledWith(true);
  await act(async () => vi.advanceTimersByTime(TWITCH_START_TIMEOUT_MS + 100));
  expect(onStarting).toHaveBeenLastCalledWith(false);
  await act(async () => vi.advanceTimersByTime(TWITCH_START_TIMEOUT_MS * 3));
  expect(tw.Player).toHaveBeenCalledTimes(1); // 한 번 막히면 다시 띄워도 막히므로 다시 띄우지 않는다
});

test('대화상자 등에 가려져 있으면 걷힐 때까지 기다렸다가 띄운다 (가려진 채 시작하면 트위치가 막는다)', async () => {
  const tw = fakeTwitch();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  document.body.appendChild(backdrop);
  render(<StreamPlayer creator={mkCreator(1)} onReady={() => {}} onStarting={() => {}} />);
  await flush();
  await act(async () => vi.advanceTimersByTime(3000));
  expect(tw.Player).not.toHaveBeenCalled();
  backdrop.remove();
  await act(async () => vi.advanceTimersByTime(600));
  expect(tw.Player).toHaveBeenCalledTimes(1);
});

test('방송이 꺼져 있으면 다시 띄우지 않는다', async () => {
  const tw = fakeTwitch();
  const onStarting = vi.fn();
  render(<StreamPlayer creator={mkCreator(1)} onReady={() => {}} onStarting={onStarting} />);
  await flush();
  act(() => tw.last().listeners.offline());
  expect(onStarting).toHaveBeenLastCalledWith(false);
  await act(async () => vi.advanceTimersByTime(TWITCH_START_TIMEOUT_MS * 3));
  expect(tw.Player).toHaveBeenCalledTimes(1);
});
