import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { DesktopApi } from '../../src/desktop/desktopApi';
import type { PlayerHandle } from '../../src/players/types';
import { mkCreator } from '../helpers/fixtures';

// 유튜브 플레이어는 재생이 시작된 뒤에야 지금 라이브 영상 ID를 알려 준다
const ytVideo: { id: string | null } = { id: null };
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator, onReady }: { creator: { platform: string }; onReady(h: PlayerHandle): void }) => {
    const h: PlayerHandle = { setMuted: () => {}, isMuted: () => true, ...(creator.platform === 'youtube' ? { videoId: () => ytVideo.id } : {}) };
    setTimeout(() => onReady(h));
    return <div data-testid="player" />;
  },
}));

const UC = 'UC' + 'b'.repeat(22);

function desktopApi(): DesktopApi {
  return {
    status: vi.fn().mockResolvedValue({ ok: true, data: { account: null } }),
    login: vi.fn(),
    logout: vi.fn(),
    favorites: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    openDonate: vi.fn(),
    closeDonate: vi.fn(),
    setDonateBounds: vi.fn(),
    setDonateMode: vi.fn(),
    fillDonate: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    onDonateClosed: vi.fn(() => () => {}),
    onDonateMode: vi.fn(() => () => {}),
  } as unknown as DesktopApi;
}

function setup() {
  ytVideo.id = null;
  const kv = safeStorage(undefined);
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'TW', channel: 'tw_one' }));
  favorites.add(mkCreator(2, { name: 'YT', platform: 'youtube', channel: UC, key: `youtube:${UC}` }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} desktop={desktopApi()} />);
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const addChat = (slot: number) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  const dlg = screen.getByRole('dialog', { name: '불러오기' });
  fireEvent.click(within(dlg).getByRole('tab', { name: '채팅' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '채팅 칸 넣기' }));
};
const chatView = () => [...document.querySelectorAll('webview')].find((w) => /chat/.test(w.getAttribute('src') ?? ''));

test('채팅 칸: 선택한 방송의 채팅을 보여주고, 다른 방송을 선택하면 따라간다', async () => {
  setup();
  pick(0, 'YT');
  pick(1, 'TW'); // 넣은 칸이 선택된다
  addChat(2);
  expect(chatView()?.getAttribute('src')).toBe('https://www.twitch.tv/popout/tw_one/chat');
  expect(chatView()?.getAttribute('partition')).toBe('persist:mvweb');
  expect(within(tiles()[2]).getByText('TW 채팅')).toBeInTheDocument();

  // 유튜브: 영상 ID를 알기 전에는 안내, 플레이어가 알려 주면 채팅
  fireEvent.click(tiles()[0].querySelector('.tile__bar')!);
  expect(screen.getByText('유튜브 채팅은 방송이 재생되면 표시됩니다')).toBeInTheDocument();
  ytVideo.id = 'm8HaYP0qcRM';
  await act(async () => {
    await new Promise((r) => setTimeout(r, 2100));
  });
  expect(chatView()?.getAttribute('src')).toBe('https://www.youtube.com/live_chat?is_popout=1&v=m8HaYP0qcRM');
});

test('채팅 칸: 방송이 없으면 안내', () => {
  setup();
  addChat(0);
  expect(screen.getByText('채팅을 볼 방송 칸을 선택하세요')).toBeInTheDocument();
});
