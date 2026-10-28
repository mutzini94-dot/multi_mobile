import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { LAST_VIEW_KEY } from '../../src/app/lastView';
import { localFavorites } from '../../src/favorites/favorites';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from '../../src/settings/settings';
import { safeStorage, type KV } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: ({ creator }: { creator: { key: string } }) => <iframe title={`player-${creator.key}`} /> }));

const noBridge: ToonationBridge = { request: () => Promise.reject(new Error('NO_EXTENSION')) };

function setup({ kv = safeStorage(undefined), settings = {} as Partial<Settings>, hash = '' } = {}) {
  kv.set(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const win = { open: vi.fn(() => ({ closed: false }) as unknown as Window), screen: { availWidth: 1920, availHeight: 1040 } as Screen, location: { hash, href: 'http://x/' + hash } as Location, navigator: {} as Navigator };
  const r = render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { kv, win, unmount: r.unmount };
}
const tiles = () => document.querySelectorAll('.tile');
const tile = (i: number) => tiles()[i] as HTMLElement;
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tile(slot)).getByRole('button', { name: '불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name} ·`) }));
};

describe('마지막 화면 복원 · 기본 레이아웃', () => {
  test('켜져 있으면 다음 실행에서 레이아웃·칸이 그대로 돌아온다', () => {
    const kv = safeStorage(undefined);
    const first = setup({ kv });
    fireEvent.click(screen.getByRole('button', { name: '1+2' }));
    pick(2, 'B');
    first.unmount();
    setup({ kv });
    expect(tiles()).toHaveLength(3);
    expect(within(tile(2)).getByText('B')).toBeInTheDocument();
  });

  test('꺼져 있으면 기본 레이아웃의 빈 화면으로 시작한다', () => {
    const kv = safeStorage(undefined);
    const first = setup({ kv });
    pick(0, 'A');
    first.unmount();
    setup({ kv, settings: { restoreLastView: false, defaultLayout: 'split2' } });
    expect(tiles()).toHaveLength(2);
    expect(within(tile(0)).getByRole('button', { name: '불러오기' })).toBeInTheDocument();
  });

  test('저장값이 깨졌으면 기본 레이아웃', () => {
    const kv = safeStorage(undefined);
    kv.set(LAST_VIEW_KEY, '{bad');
    setup({ kv, settings: { defaultLayout: 'single' } });
    expect(tiles()).toHaveLength(1);
  });

});

test('영상 클릭을 "플레이어"로 바꾸면 영상 위 잡는 층이 없어진다 (위쪽 바로는 계속 끌 수 있음)', () => {
  setup({ settings: { videoClick: 'player' } });
  pick(0, 'A');
  expect(document.querySelector('.player-layer__grab')).toBeNull();
  expect(within(tile(0)).getByRole('button', { name: '끌어서 자리 옮기기' })).toBeInTheDocument();
});

describe('단축키', () => {
  test('1~4 칸 선택, M 소리, F 전체 화면, D 후원하기', () => {
    const { win } = setup();
    pick(0, 'A');
    pick(1, 'B');
    fireEvent.keyDown(window, { key: '1' });
    expect(tile(0)).toHaveClass('tile--selected');
    fireEvent.keyDown(window, { key: 'm' });
    expect(within(tile(0)).getByRole('button', { name: '소리 켜기' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'M' });
    expect(within(tile(0)).getByRole('button', { name: '소리 끄기' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'd' });
    expect(win.open).toHaveBeenCalledWith('https://toon.at/donate/don1', 'mv-donate', expect.any(String));
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByRole('region', { name: 'A 전체 화면' })).toBeInTheDocument();
  });

  test('입력 중이거나 창(대화상자)이 열려 있으면 동작하지 않는다', () => {
    setup();
    pick(0, 'A');
    pick(1, 'B');
    fireEvent.click(within(tile(2)).getByRole('button', { name: '불러오기' }));
    const input = within(screen.getByRole('dialog')).getByLabelText('이름');
    fireEvent.keyDown(input, { key: '1' });
    expect(tile(1)).toHaveClass('tile--selected');
  });

  test('설정에서 끄면 동작하지 않는다', () => {
    setup({ settings: { shortcuts: false } });
    pick(0, 'A');
    pick(1, 'B');
    fireEvent.keyDown(window, { key: '1' });
    expect(tile(1)).toHaveClass('tile--selected');
  });
});
