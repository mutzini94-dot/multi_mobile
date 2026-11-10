import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { SETTINGS_KEY } from '../../src/settings/settings';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup(settings: Record<string, unknown> = {}) {
  const kv = quadKv();
  kv.set(SETTINGS_KEY, JSON.stringify({ ...JSON.parse(kv.get(SETTINGS_KEY) ?? '{}'), ...settings }));
  const favorites = localFavorites(kv);
  for (const [i, n] of ['A', 'B', 'C'].entries()) favorites.add(mkCreator(i + 1, { name: n }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  const pick = (slot: number, name: string) => {
    fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
  };
  pick(0, 'A');
  pick(2, 'B'); // 빈 칸(1번)을 건너뛴다
  pick(3, 'C');
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];

function swipe(dx: number, dy = 0) {
  const zone = document.querySelector('.focus-swipe')!;
  fireEvent.pointerDown(zone, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 300 });
  fireEvent.pointerUp(zone, { pointerId: 2, pointerType: 'touch', clientX: 300 + dx, clientY: 300 + dy });
}

test('전체 화면에서 좌우로 밀면 다음·이전 방송 (빈 칸·페이지는 건너뛰고 돌아간다), ←→ 키도', () => {
  setup();
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '전체 화면' }));
  expect(screen.getByRole('region', { name: 'A 전체 화면' })).toBeInTheDocument();
  expect(screen.getByText('1 / 3')).toBeInTheDocument();
  swipe(-120); // 왼쪽으로 밀기 = 다음
  expect(screen.getByRole('region', { name: 'B 전체 화면' })).toBeInTheDocument();
  expect(tiles()[2]).toHaveClass('tile--selected');
  swipe(-120);
  swipe(-120); // 끝에서 처음으로
  expect(screen.getByRole('region', { name: 'A 전체 화면' })).toBeInTheDocument();
  swipe(120); // 오른쪽으로 밀기 = 이전
  expect(screen.getByRole('region', { name: 'C 전체 화면' })).toBeInTheDocument();
  swipe(-30, 0); // 조금만 움직이면 그대로
  swipe(-120, 120); // 세로로 많이 움직이면 그대로
  expect(screen.getByRole('region', { name: 'C 전체 화면' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByRole('region', { name: 'A 전체 화면' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(screen.getByRole('region', { name: 'C 전체 화면' })).toBeInTheDocument();
});

test('여러 칸 동시 듣기에서 칸을 두 번 탭하면 그 방송 소리만 남긴다', () => {
  setup({ soundMode: 'mix' });
  const soundOf = (i: number) => within(tiles()[i]).getByRole('button', { name: /^소리 (끄기|켜기)$/ });
  // 동시 듣기: 셋 다 소리
  expect(soundOf(0)).toHaveAccessibleName('소리 끄기');
  expect(soundOf(3)).toHaveAccessibleName('소리 끄기');
  const bar = tiles()[2].querySelector('.tile__bar')!;
  for (let k = 0; k < 2; k++) {
    fireEvent.pointerDown(bar, { button: 0, pointerId: 3, clientX: 600, clientY: 400 });
    fireEvent.pointerUp(window, { pointerId: 3, clientX: 600, clientY: 400 });
  }
  expect(soundOf(2)).toHaveAccessibleName('소리 끄기');
  expect(soundOf(0)).toHaveAccessibleName('소리 켜기');
  expect(soundOf(3)).toHaveAccessibleName('소리 켜기');
});

test('전체 화면 오른쪽 절반을 위아래로 밀면 볼륨 (아래로 = 작게), 놓으면 기본 볼륨으로 저장', () => {
  setup();
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '전체 화면' }));
  const zone = document.querySelector('.focus-swipe')!;
  const x = window.innerWidth - 50;
  fireEvent.pointerDown(zone, { pointerId: 4, pointerType: 'touch', clientX: x, clientY: 200 });
  fireEvent.pointerMove(zone, { pointerId: 4, pointerType: 'touch', clientX: x, clientY: 300 });
  expect(screen.getByRole('status', { name: '볼륨' })).toHaveTextContent('50');
  fireEvent.pointerUp(zone, { pointerId: 4, pointerType: 'touch', clientX: x, clientY: 300 });
  expect(screen.queryByRole('status', { name: '볼륨' })).toBeNull();
  expect(screen.getByRole('region', { name: 'A 전체 화면' })).toBeInTheDocument(); // 다른 방송으로 넘어가지 않는다
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  expect(screen.getByRole('slider', { name: '기본 볼륨' })).toHaveValue('50');
});
