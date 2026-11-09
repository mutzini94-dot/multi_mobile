import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { readSharedView, shareUrl, VIEW_HASH } from '../../src/app/shareView';
import { applyLayout } from '../../src/layout/layouts';
import { initialViewState } from '../../src/app/viewState';
import { makeDonatePage } from '../../src/domain/pages';
import { localFavorites } from '../../src/favorites/favorites';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

test('공유 링크: 보이는 칸과 화면 모양을 담고, 받는 쪽은 검사해서 연다', () => {
  const state = { ...applyLayout(initialViewState, 'quad'), slots: [mkCreator(1, { name: 'A' }), null, makeDonatePage(), null, mkCreator(9), null, null, null, null] };
  const url = shareUrl('https://multi.example.com/?source=pwa#old', state);
  expect(url.startsWith(`https://multi.example.com/${VIEW_HASH}`)).toBe(true);
  const v = readSharedView(new URL(url).hash)!;
  expect(v.layout).toBe('quad');
  expect(v.slots[0]).toMatchObject({ name: 'A', platform: 'twitch', channel: 'chan_1' });
  expect(v.slots[2]).toMatchObject({ kind: 'donate' });
  expect(v.slots[4]).toBeNull(); // 보이지 않는 칸(4분할의 5번째)은 담지 않는다
  expect(readSharedView('#view=@@@')).toBeNull();
  expect(readSharedView('#other')).toBeNull();
});

function setup(hash = '') {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  const replaceState = vi.fn();
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash, href: `http://localhost:5230/${hash}` } as Location, navigator: {} as Navigator, history: { replaceState } as unknown as History };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { replaceState };
}

test('메뉴의 화면 공유: 링크·QR을 보여 준다', () => {
  setup();
  fireEvent.click(within(document.querySelectorAll<HTMLElement>('.tile')[0]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: /^A ·/ }));
  fireEvent.click(screen.getByRole('button', { name: '화면 공유' }));
  const dlg = screen.getByRole('dialog', { name: '화면 구성 공유' });
  const url = (within(dlg).getByRole('textbox', { name: '공유 링크' }) as HTMLInputElement).value;
  expect(readSharedView(new URL(url).hash)!.slots[0]).toMatchObject({ name: 'A' });
  expect(within(dlg).getByRole('img', { name: '공유 QR 코드' }).querySelector('svg')).not.toBeNull();
});

test('공유 링크로 열면 그 화면 구성으로 시작하고 주소에서 #view= 를 지운다', () => {
  const url = shareUrl('http://localhost:5230/', { ...applyLayout(initialViewState, 'split2'), slots: [mkCreator(5, { name: '공유방송' }), null, null, null, null, null, null, null, null] });
  const { replaceState } = setup(new URL(url).hash);
  const tiles = document.querySelectorAll<HTMLElement>('.tile');
  expect(tiles).toHaveLength(2);
  expect(tiles[0].querySelector('.tile__name')?.textContent).toBe('공유방송');
  expect(replaceState).toHaveBeenCalled();
});
