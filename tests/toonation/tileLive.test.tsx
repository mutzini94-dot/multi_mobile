import { renderHook, waitFor, render, screen, within, fireEvent } from '@testing-library/react';
import { formatElapsed, useTileLiveInfo } from '../../src/toonation/tileLive';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { LivePage, LiveQuery } from '../../src/toonation/liveList';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';
import { SETTINGS_KEY } from '../../src/settings/settings';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const a = mkCreator(1, { name: 'A' });
const page = (items: LivePage['items']): LivePage => ({ items, page: 1, totalPages: 1, total: items.length });

test('formatElapsed', () => {
  expect(formatElapsed(65 * 60_000)).toBe('1시간 5분');
  expect(formatElapsed(9 * 60_000)).toBe('9분');
  expect(formatElapsed(20_000)).toBe('방금 시작');
});

test('useTileLiveInfo: 창의 방송을 투네이션 라이브 목록에서 이름으로 찾아 제목·시청자·시작 시각', async () => {
  const load = vi.fn(async (q: LiveQuery) =>
    page(q.q === 'A' ? [{ creator: { ...a, live: { title: '오늘 방송', viewers: 1234, startedAt: 1000 } }, thumbnail: '', category: '' }] : []),
  );
  const { result } = renderHook(() => useTileLiveInfo({ streams: [a], known: [], load, enabled: true }));
  await waitFor(() => expect(result.current[a.key]).toEqual({ title: '오늘 방송', viewers: 1234, startedAt: 1000 }));
  expect(load).toHaveBeenCalledWith(expect.objectContaining({ q: 'A', platform: 'twitch' }));
});

test('useTileLiveInfo: 투네이션 즐겨찾기에 이미 있는 라이브 정보도 쓴다, 끄면 아무것도 묻지 않는다', async () => {
  const load = vi.fn(async () => page([]));
  const known = [{ ...a, live: { title: '즐겨찾기 정보', viewers: 7 } }];
  const { result, rerender } = renderHook((p: { enabled: boolean }) => useTileLiveInfo({ streams: [a], known, load, enabled: p.enabled }), { initialProps: { enabled: false } });
  expect(result.current).toEqual({});
  expect(load).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current[a.key]).toMatchObject({ title: '즐겨찾기 정보', viewers: 7 }));
});

test('창 위쪽 바에 방송 정보 (설정으로 끌 수 있다)', async () => {
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  const favorites = localFavorites(kv);
  favorites.add(a);
  const lives = vi.fn(async (q: LiveQuery) => page(q.q === 'A' ? [{ creator: { ...a, live: { title: '오늘 방송', viewers: 1234, startedAt: Date.now() - 65 * 60_000 } }, thumbnail: '', category: '' }] : []));
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} lives={lives} />);
  const tile = () => document.querySelectorAll<HTMLElement>('.tile')[0];
  fireEvent.click(within(tile()).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: /^A ·/ }));
  const info = await within(tile()).findByLabelText('방송 정보');
  expect(info.textContent).toBe('1,234명 · 1시간 5분 · 오늘 방송');
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '설정' })).getByLabelText('창에 방송 정보 표시'));
  expect(within(tile()).queryByLabelText('방송 정보')).toBeNull();
  expect(JSON.parse(kv.get(SETTINGS_KEY)!).showLiveInfo).toBe(false);
});
