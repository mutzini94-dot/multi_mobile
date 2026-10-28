import { render, waitFor } from '@testing-library/react';
import { StreamPlayer } from '../../src/players/StreamPlayer';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/loadScript', () => ({ loadScript: vi.fn().mockResolvedValue(undefined) }));

const UC = 'UC' + 'a'.repeat(22);

afterEach(() => {
  delete (window as any).YT;
  delete (window as any).Twitch;
});

test('유튜브: live_stream 임베드 iframe과 handle', async () => {
  const yt = { mute: vi.fn(), unMute: vi.fn(), isMuted: vi.fn(() => true), destroy: vi.fn() };
  (window as any).YT = {
    Player: vi.fn((_el: HTMLIFrameElement, opts: any) => {
      setTimeout(() => opts.events.onReady());
      return yt;
    }),
  };
  const onReady = vi.fn();
  const { container } = render(
    <StreamPlayer creator={mkCreator(1, { platform: 'youtube', channel: UC, key: `youtube:${UC}` })} onReady={onReady} />,
  );
  const iframe = container.querySelector('iframe')!;
  expect(iframe.getAttribute('src')).toBe(
    `https://www.youtube.com/embed/live_stream?channel=${UC}&enablejsapi=1&autoplay=1&mute=1`,
  );
  await waitFor(() => expect(onReady).toHaveBeenCalled());
  const h = onReady.mock.calls[0][0];
  h.setMuted(false);
  expect(yt.unMute).toHaveBeenCalled();
  h.setMuted(true);
  expect(yt.mute).toHaveBeenCalled();
  expect(h.isMuted()).toBe(true);
});

test('트위치: Twitch.Player 옵션과 handle', async () => {
  const listeners: Record<string, () => void> = {};
  const tw = { setMuted: vi.fn(), getMuted: vi.fn(() => false), addEventListener: vi.fn((e: string, cb: () => void) => (listeners[e] = cb)) };
  const Player: any = vi.fn(() => {
    setTimeout(() => listeners.ready?.());
    return tw;
  });
  Player.READY = 'ready';
  (window as any).Twitch = { Player };
  const onReady = vi.fn();
  render(<StreamPlayer creator={mkCreator(1)} onReady={onReady} />);
  await waitFor(() => expect(Player).toHaveBeenCalled());
  expect(Player.mock.calls[0][1]).toEqual(
    expect.objectContaining({ channel: 'chan_1', parent: [window.location.hostname], muted: true, autoplay: true }),
  );
  await waitFor(() => expect(onReady).toHaveBeenCalled());
  const h = onReady.mock.calls[0][0];
  h.setMuted(false);
  expect(tw.setMuted).toHaveBeenCalledWith(false);
  expect(h.isMuted()).toBe(false);
});

test('유튜브: 볼륨·정지 명령, 화질 지정은 지원하지 않음', async () => {
  const yt = { mute: vi.fn(), unMute: vi.fn(), isMuted: vi.fn(() => true), setVolume: vi.fn(), pauseVideo: vi.fn(), playVideo: vi.fn() };
  (window as any).YT = { Player: vi.fn((_el: HTMLIFrameElement, opts: any) => { setTimeout(() => opts.events.onReady()); return yt; }) };
  const onReady = vi.fn();
  render(<StreamPlayer creator={mkCreator(1, { platform: 'youtube', channel: UC, key: `youtube:${UC}` })} onReady={onReady} />);
  await waitFor(() => expect(onReady).toHaveBeenCalled());
  const h = onReady.mock.calls[0][0];
  h.setVolume(40);
  expect(yt.setVolume).toHaveBeenCalledWith(40);
  h.setPaused(true);
  expect(yt.pauseVideo).toHaveBeenCalled();
  h.setPaused(false);
  expect(yt.playVideo).toHaveBeenCalled();
  expect(h.setLowQuality).toBeUndefined();
});

test('트위치: 볼륨(0~1)·정지·낮은 화질(가장 낮은 화질 ↔ 자동)', async () => {
  const listeners: Record<string, () => void> = {};
  const tw = {
    setMuted: vi.fn(), getMuted: vi.fn(() => false), setVolume: vi.fn(), pause: vi.fn(), play: vi.fn(), setQuality: vi.fn(),
    getQualities: vi.fn(() => [{ group: 'auto' }, { group: 'chunked' }, { group: '720p60' }, { group: '360p30' }, { group: '160p30' }]),
    addEventListener: vi.fn((e: string, cb: () => void) => (listeners[e] = cb)),
  };
  const Player: any = vi.fn(() => { setTimeout(() => listeners.ready?.()); return tw; });
  Player.READY = 'ready';
  (window as any).Twitch = { Player };
  const onReady = vi.fn();
  render(<StreamPlayer creator={mkCreator(1)} onReady={onReady} />);
  await waitFor(() => expect(onReady).toHaveBeenCalled());
  const h = onReady.mock.calls[0][0];
  h.setVolume(40);
  expect(tw.setVolume).toHaveBeenCalledWith(0.4);
  h.setPaused(true);
  expect(tw.pause).toHaveBeenCalled();
  h.setPaused(false);
  expect(tw.play).toHaveBeenCalled();
  h.setLowQuality(true);
  expect(tw.setQuality).toHaveBeenLastCalledWith('160p30');
  h.setLowQuality(false);
  expect(tw.setQuality).toHaveBeenLastCalledWith('auto');
});

test('유튜브: 라이브 영상 ID를 알면(투네이션 라이브 목록) 그 영상으로 임베드', () => {
  (window as any).YT = { Player: vi.fn(() => ({})) };
  const { container } = render(
    <StreamPlayer creator={mkCreator(1, { platform: 'youtube', channel: UC, key: `youtube:${UC}`, videoId: 'm8HaYP0qcRM' })} onReady={vi.fn()} />,
  );
  expect(container.querySelector('iframe')!.getAttribute('src')).toBe('https://www.youtube.com/embed/m8HaYP0qcRM?enablejsapi=1&autoplay=1&mute=1');
});
