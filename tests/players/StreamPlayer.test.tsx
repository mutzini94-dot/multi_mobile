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
