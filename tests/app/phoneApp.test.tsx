import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { mkCreator } from '../helpers/fixtures';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function mockPhone(matches: boolean) {
  window.matchMedia = ((q: string) => ({ matches: matches && q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

function setup() {
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { win };
}

test('휴대폰 폭이면 칸을 세로로 쌓는 배치, 앱에 phone 표시', () => {
  mockPhone(true);
  setup();
  expect(document.querySelector('.tile-grid')!.className).toMatch(/tile-grid--phone/);
  expect(document.querySelector('.app')!.className).toMatch(/app--phone/);
});

test('넓은 화면이면 지금처럼 나누기 손잡이가 있는 배치', () => {
  mockPhone(false);
  setup();
  expect(document.querySelector('.tile-grid')!.className).not.toMatch(/tile-grid--phone/);
  expect(document.querySelector('.resize-handle')).not.toBeNull();
});

const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pickInto = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const pickA = () => pickInto(0, 'A');

test('휴대폰: 후원하기는 위에 뜨는 창으로 (소리 유지)', () => {
  mockPhone(true);
  const { win } = setup();
  pickA();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  const sheet = screen.getByRole('dialog', { name: 'A 후원하기' });
  expect(sheet).toHaveClass('donate-modal'); // 아래 시트가 아니라 위에 뜨는 창
  expect(document.querySelector('.page-sheet__backdrop')).toHaveClass('donate-modal__backdrop');
  expect(document.querySelector('.tile--selected')).not.toBeNull(); // 선택(소리)은 그대로
  // 투네이션이 허용한 주소(테스트의 localhost)에서는 창 안에 후원 페이지, 아니면 '새 창으로 후원 페이지 열기' (domain/pages canFrameDonate)
  expect(sheet.querySelector('iframe')!.getAttribute('src')).toBe('https://toon.at/donate/don1');
  expect(win.open).not.toHaveBeenCalled();
  fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }));
  expect(screen.queryByRole('dialog', { name: 'A 후원하기' })).toBeNull();
});

test('휴대폰: 채팅 버튼은 선택한 방송의 채팅을 시트로', () => {
  mockPhone(true);
  setup();
  expect(screen.getByRole('button', { name: '채팅' })).toBeDisabled(); // 방송이 없으면
  pickA();
  fireEvent.click(screen.getByRole('button', { name: '채팅' }));
  const sheet = screen.getByRole('dialog', { name: 'A 채팅' });
  expect(sheet.querySelector('iframe')!.getAttribute('src')).toContain('twitch.tv/embed/chan_1/chat');
});

test('휴대폰: 방송을 고르지 않아도 후원 페이지 칸이 따라가는 크리에이터가 있으면 그 크리에이터로', () => {
  mockPhone(true);
  setup();
  pickA();
  fireEvent.click(tiles()[0].querySelector('.tile__bar')!); // A 선택
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  expect(screen.getByRole('dialog', { name: 'A 후원하기' })).toBeInTheDocument();
});

test('넓은 화면: 후원하기는 지금처럼 새 창(팝업)', () => {
  mockPhone(false);
  const { win } = setup();
  pickA();
  fireEvent.click(screen.getByRole('button', { name: '후원하기' }));
  expect(win.open).toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: 'A 후원하기' })).toBeNull();
});

test('휴대폰: 전체 화면이면 가로 화면으로 돌리고, 나오면 풀어 준다', async () => {
  mockPhone(true);
  const lock = vi.fn(() => Promise.resolve());
  const unlock = vi.fn();
  Object.defineProperty(window.screen, 'orientation', { value: { lock, unlock, type: 'portrait-primary' }, configurable: true });
  const req = vi.fn(() => Promise.resolve());
  Object.defineProperty(document.documentElement, 'requestFullscreen', { value: req, configurable: true });
  setup();
  pickA();
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '전체 화면' }));
  await act(async () => {});
  expect(req).toHaveBeenCalled();
  expect(lock).toHaveBeenCalledWith('landscape');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(unlock).toHaveBeenCalled();
});

test('휴대폰: 창 추가는 자리를 묻지 않고 맨 위에 빈 창, 최대 6개', () => {
  mockPhone(true);
  setup();
  pickA();
  expect(tiles()).toHaveLength(2);
  const add = () => fireEvent.click(screen.getByRole('button', { name: '창 추가' }));
  add();
  expect(screen.queryByRole('dialog', { name: '창 추가' })).toBeNull();
  expect(tiles()).toHaveLength(3);
  expect(tiles()[0]).toHaveClass('tile--empty');
  expect(tiles()[1].querySelector('.tile__name')?.textContent).toBe('A');
  add();
  expect(tiles()).toHaveLength(4);
  add();
  expect(tiles()).toHaveLength(6);
  expect(screen.getByRole('button', { name: '창 추가' })).toBeDisabled();
});

test('휴대폰: 채팅을 열면 그 방송이 맨 위 칸으로 올라가고 채팅은 아래에 (방송을 가리지 않음)', () => {
  mockPhone(true);
  setup();
  pickInto(0, 'A');
  pickInto(1, 'B'); // B 선택
  fireEvent.click(screen.getByRole('button', { name: '채팅' }));
  expect(tiles()[0].querySelector('.tile__name')?.textContent).toBe('B');
  expect(tiles()[0]).toHaveClass('tile--selected');
  const sheet = screen.getByRole('dialog', { name: 'B 채팅' });
  expect(sheet).toHaveClass('page-sheet--dock');
  expect(document.querySelector('.app')).toHaveClass('app--chat-dock');
  fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }));
  expect(document.querySelector('.app')).not.toHaveClass('app--chat-dock');
});

test('휴대폰: 퀵패널에서 고른 방송은 칸을 묻지 않고 빈 칸에, 빈 칸이 없으면 맨 위에 창을 더해 넣는다', () => {
  mockPhone(true);
  setup();
  const card = (name: string) => within(document.querySelector('.quick-panel') as HTMLElement).getByRole('button', { name });
  fireEvent.click(card('A'));
  expect(screen.queryByRole('dialog', { name: '넣을 칸 고르기' })).toBeNull();
  expect(tiles()[0].querySelector('.tile__name')?.textContent).toBe('A'); // 첫 빈 칸
  expect(tiles()).toHaveLength(2);
  // 빈 칸이 없으면 (두 번째 칸은 후원 페이지) 맨 위에 새 창
  fireEvent.click(card('B'));
  expect(screen.queryByRole('dialog', { name: '넣을 칸 고르기' })).toBeNull();
  expect(tiles()).toHaveLength(3);
  expect(tiles()[0].querySelector('.tile__name')?.textContent).toBe('B');
  expect(tiles()[0]).toHaveClass('tile--selected');
  // 이미 보이는 방송이면 그 칸을 고르기만
  fireEvent.click(card('A'));
  expect(tiles()).toHaveLength(3);
  expect(tiles()[1]).toHaveClass('tile--selected');
});
