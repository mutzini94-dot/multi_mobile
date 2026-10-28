import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { SETTINGS_KEY } from '../../src/settings/settings';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge, ToonationFavorite } from '../../src/toonation/bridge';
import type { StreamStatus } from '../../src/players/types';
import { mkCreator } from '../helpers/fixtures';

// 방송 이름별로 플레이어 상태 알림을 보낼 수 있게
const statusOf: Record<string, (s: StreamStatus) => void> = {};
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator, onStatus }: { creator: { name: string }; onStatus?(s: StreamStatus): void }) => {
    if (onStatus) statusOf[creator.name] = onStatus;
    return <div data-testid="player" />;
  },
}));

const toonFavs: ToonationFavorite[] = [
  { tag: 'tagL', name: '라이브엘', profile: '', channels: [{ platform: 'twitch', key: 'live_el', live: true, title: '켜짐', viewers: 9 }] },
  { tag: 'tagO', name: '꺼진오', profile: '', channels: [{ platform: 'twitch', key: 'off_o', live: false }] },
];

function setup(settings?: object) {
  const kv = safeStorage(undefined);
  if (settings) kv.set(SETTINGS_KEY, JSON.stringify(settings));
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  const bridge: ToonationBridge = {
    request: vi.fn(async (type: string) => (type === 'status' ? { account: { name: '나' } } : type === 'favorites' ? toonFavs : {})) as ToonationBridge['request'],
  };
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={bridge} desktop={null} />);
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
async function pickA() {
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '불러오기' }));
  const dlg = screen.getByRole('dialog', { name: '불러오기' });
  await within(dlg).findByRole('button', { name: /^라이브엘 ·/ }); // 투네이션 즐겨찾기(라이브 여부)를 불러온 뒤
  fireEvent.click(within(dlg).getByRole('button', { name: /^A ·/ }));
}

test('방송이 끝나면 "방송 종료"와 라이브 중인 즐겨찾기로 바꾸기 버튼', async () => {
  setup();
  await pickA();
  act(() => statusOf.A('ended'));
  const notice = screen.getByRole('status', { name: 'A 방송 상태' });
  expect(within(notice).getByText('방송 종료')).toBeInTheDocument();
  fireEvent.click(await within(notice).findByRole('button', { name: '라이브로 바꾸기 · 라이브엘' }));
  expect(within(tiles()[0]).getByText('라이브엘')).toBeInTheDocument();
  expect(screen.queryByRole('status', { name: /방송 상태/ })).toBeNull();
});

test('다시 방송이 켜지면 안내를 지운다, 재생할 수 없는 방송도 안내', async () => {
  setup();
  await pickA();
  act(() => statusOf.A('unavailable'));
  expect(within(screen.getByRole('status', { name: 'A 방송 상태' })).getByText('재생할 수 없는 방송')).toBeInTheDocument();
  act(() => statusOf.A('live'));
  expect(screen.queryByRole('status', { name: 'A 방송 상태' })).toBeNull();
});

test('설정: 방송이 끝나면 라이브 중인 즐겨찾기로 자동으로 바꾼다', async () => {
  setup({ autoReplaceEnded: true });
  await pickA();
  act(() => statusOf.A('ended'));
  expect(await within(tiles()[0]).findByText('라이브엘')).toBeInTheDocument();
});
