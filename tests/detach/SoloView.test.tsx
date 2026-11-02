import { act, fireEvent, render, screen } from '@testing-library/react';
import { SoloView } from '../../src/detach/SoloView';
import type { HostToSolo, SoloLink, SoloToHost } from '../../src/detach/channel';
import type { DesktopApi } from '../../src/desktop/desktopApi';
import type { PlayerHandle } from '../../src/players/types';
import { makeDonatePage, makeWebPage } from '../../src/domain/pages';
import { SETTINGS_KEY } from '../../src/settings/settings';
import { safeStorage } from '../../src/storage/safeStorage';
import { mkCreator } from '../helpers/fixtures';

const handle: PlayerHandle = { setMuted: vi.fn(), isMuted: vi.fn(() => true), setVolume: vi.fn() };
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ onReady }: { onReady(h: PlayerHandle): void }) => {
    onReady(handle);
    return <div data-testid="player" />;
  },
}));

function fakeLink() {
  const sent: SoloToHost[] = [];
  let cb: ((m: HostToSolo) => void) | null = null;
  const link: SoloLink = { post: (m) => sent.push(m), onMessage: (f) => ((cb = f), () => (cb = null)) };
  return { link, sent, fromHost: (m: HostToSolo) => act(() => cb?.(m)) };
}

const desktopApi = () => ({ soloSetAlwaysOnTop: vi.fn() }) as unknown as DesktopApi;

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  delete document.documentElement.dataset.theme;
});

test('방송: 전체 창에 플레이어, 처음 소리(분리 전 소리 나던 칸)와 기본 볼륨 적용', () => {
  const kv = safeStorage(undefined);
  kv.set(SETTINGS_KEY, JSON.stringify({ masterVolume: 40, theme: 'dark' }));
  const { link } = fakeLink();
  render(<SoloView payload={{ id: 'd1', item: mkCreator(1, { name: 'A' }), sound: true }} link={link} desktop={null} kv={kv} />);
  expect(screen.getByTestId('player')).toBeInTheDocument();
  expect(handle.setMuted).toHaveBeenLastCalledWith(false);
  expect(handle.setVolume).toHaveBeenLastCalledWith(40);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.title).toBe('A · 투네이션 후원 브라우저');
  fireEvent.click(screen.getByRole('button', { name: '소리 끄기' }));
  expect(handle.setMuted).toHaveBeenLastCalledWith(true);
});

test('방송: 후원하기·되돌리기는 메인 화면에 알린다', () => {
  const { link, sent } = fakeLink();
  render(<SoloView payload={{ id: 'd1', item: mkCreator(1), sound: false }} link={link} desktop={null} kv={safeStorage(undefined)} />);
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  expect(sent).toEqual([{ type: 'donate' }, { type: 'return' }]);
});

test('설치형: 항상 위 · 후원 페이지는 메인 화면에서 고른 크리에이터를 따라간다', () => {
  const { link, fromHost } = fakeLink();
  const desktop = desktopApi();
  render(<SoloView payload={{ id: 'd2', item: makeDonatePage(), sound: false, donateFor: mkCreator(1) }} link={link} desktop={desktop} kv={safeStorage(undefined)} />);
  const wv = () => document.querySelector('webview')!;
  expect(wv().getAttribute('src')).toBe('https://toon.at/donate/don1');
  expect(wv().getAttribute('partition')).toBe('persist:toonation');
  fromHost({ type: 'donateFor', creator: mkCreator(2, { name: 'B' }) });
  expect(wv().getAttribute('src')).toBe('https://toon.at/donate/don2');
  expect(screen.getByText('B 후원 페이지')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '후원하기' })).toBeNull(); // 페이지 자체가 후원 화면
  fireEvent.click(screen.getByRole('button', { name: '항상 위에 표시' }));
  expect(desktop.soloSetAlwaysOnTop).toHaveBeenCalledWith(true);
});

test('웹페이지 (웹은 iframe), 이상한 크리에이터 메시지는 무시', () => {
  const { link, fromHost } = fakeLink();
  const w = makeWebPage('naver.com');
  if (!w.ok) throw new Error();
  render(<SoloView payload={{ id: 'd3', item: w.value, sound: false }} link={link} desktop={null} kv={safeStorage(undefined)} />);
  expect(document.querySelector('iframe')!.getAttribute('src')).toBe('https://naver.com/');
  expect(screen.queryByRole('button', { name: '항상 위에 표시' })).toBeNull(); // 웹은 창을 위에 고정할 수 없다
  fromHost({ type: 'donateFor', creator: { ...mkCreator(1), donateId: '../evil' } });
  expect(document.querySelector('iframe')!.getAttribute('src')).toBe('https://naver.com/');
});
