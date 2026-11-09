import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { embedUrl } from '../../src/ui/pipWindow';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

test('작은 창 임베드 주소: 트위치는 부모 도메인, 유튜브는 영상 ID가 있으면 영상으로', () => {
  expect(embedUrl(mkCreator(1), 'multi.example.com')).toBe('https://player.twitch.tv/?channel=chan_1&parent=multi.example.com&autoplay=true');
  expect(embedUrl(mkCreator(2, { platform: 'youtube', channel: 'UCaaaaaaaaaaaaaaaaaaaaaa', videoId: 'abcdefghijk' }), 'x')).toContain('/embed/abcdefghijk?');
  expect(embedUrl(mkCreator(2, { platform: 'youtube', channel: 'UCaaaaaaaaaaaaaaaaaaaaaa' }), 'x')).toContain('live_stream?channel=UCaaaaaaaaaaaaaaaaaaaaaa');
});

function setup() {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  fireEvent.click(within(document.querySelectorAll<HTMLElement>('.tile')[0]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: /^A ·/ }));
}

afterEach(() => {
  delete (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture;
});

test('문서 PIP를 지원하면 미니 모드는 늘 위에 떠 있는 작은 창: 방송을 띄우고 메인 소리는 끄며, 닫으면 되돌린다', async () => {
  const pipDoc = document.implementation.createHTMLDocument('pip');
  const listeners: Record<string, () => void> = {};
  const pw = { document: pipDoc, addEventListener: (t: string, f: () => void) => (listeners[t] = f) };
  const requestWindow = vi.fn(async () => pw);
  (window as unknown as { documentPictureInPicture: unknown }).documentPictureInPicture = { requestWindow };
  setup();
  expect(document.querySelector('.tile--selected')).not.toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '미니 모드' }));
  });
  expect(requestWindow).toHaveBeenCalled();
  expect(pipDoc.querySelector('iframe')!.src).toContain('player.twitch.tv/?channel=chan_1');
  expect(document.querySelector('.app')).not.toHaveClass('app--mini'); // 앱 안 미니 모드가 아니다
  expect(screen.getByRole('button', { name: '음소거 해제' })).toBeInTheDocument(); // 메인 소리 끔
  act(() => listeners.pagehide());
  expect(screen.getByRole('button', { name: '전체 음소거' })).toBeInTheDocument(); // 소리 되돌림
});

test('지원하지 않으면 지금처럼 앱 안 미니 모드', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '미니 모드' }));
  expect(screen.getByRole('region', { name: 'A 미니 모드' })).toBeInTheDocument();
});
