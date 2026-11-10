import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import type { DesktopApi } from '../../src/desktop/desktopApi';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator }: { creator: { key: string } }) => <iframe title={`player-${creator.key}`} />,
}));

const noBridge: ToonationBridge = { request: () => Promise.reject(new Error('NO_EXTENSION')) };

function setup(desktop: DesktopApi | null = null) {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const win = { open: vi.fn(() => ({ closed: false }) as unknown as Window), screen: { availWidth: 1920, availHeight: 1040 } as Screen, location: { hash: '', href: 'http://x/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={desktop} />);
  for (const [slot, name] of [[0, 'A'], [1, 'B']] as const) {
    fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name} ·`) }));
  }
  fireEvent.click(within(tiles()[0]).getByText('A')); // A 선택 (A만 소리)
  return { win };
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const menu = () => screen.queryByRole('menu', { name: '영상 메뉴' });
const items = () => within(menu()!).getAllByRole('menuitem').map((b) => b.querySelector('.context-menu__label')!.textContent);

test('영상 칸 오른쪽 클릭: 소리 끄기·전체 화면·새 창으로 분리·창 닫기', () => {
  setup();
  fireEvent.contextMenu(tiles()[0], { clientX: 200, clientY: 150 });
  expect(items()).toEqual(['소리 끄기', '전체 화면', '후원하기', '세로로 보기', expect.stringMatching(/^즐겨찾기 (추가|해제)$/), '새 창으로 분리', '창 닫기']);
  fireEvent.click(within(menu()!).getByRole('menuitem', { name: '소리 끄기' }));
  expect(menu()).toBeNull();
  expect(screen.getByRole('button', { name: '음소거 해제' })).toBeInTheDocument(); // 전체 소리 꺼짐
});

test('소리가 안 나는 칸은 소리 켜기 (그 칸을 선택해 그 칸 소리를 켠다)', () => {
  setup();
  fireEvent.contextMenu(tiles()[1]);
  fireEvent.click(within(menu()!).getByRole('menuitem', { name: '소리 켜기' }));
  expect(tiles()[1].className).toMatch(/tile--selected/);
});

test('창 닫기: 방송을 내리고 그 창도 닫는다 (레이아웃이 한 단계 작아진다)', () => {
  setup();
  fireEvent.contextMenu(tiles()[1]);
  fireEvent.click(within(menu()!).getByRole('menuitem', { name: '창 닫기' }));
  expect(tiles()).toHaveLength(3);
  expect(screen.queryByTitle('player-twitch:chan_2')).toBeNull();
});

test('영상 위(잡는 층)에서 오른쪽 클릭해도 메뉴가 뜬다, 빈 칸은 빈 창 메뉴', () => {
  setup();
  const grab = document.querySelector<HTMLElement>('.player-layer__item[data-slot="1"] .player-layer__grab')!;
  fireEvent.contextMenu(grab, { clientX: 300, clientY: 200 });
  expect(items()).toContain('새 창으로 분리');
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.contextMenu(tiles()[3]);
  expect(menu()).toBeNull();
  expect(screen.getByRole('menu', { name: '빈 창 메뉴' })).toBeInTheDocument();
});

test('설치형: 영상(iframe) 안에서 오른쪽 클릭한 자리를 앱이 알려 주면 그 칸 메뉴', () => {
  let frameMenu: ((p: { x: number; y: number }) => void) | null = null;
  const desktop = {
    onDonateClosed: () => () => {},
    onDonateMode: () => () => {},
    onFrameContextMenu: (cb: (p: { x: number; y: number }) => void) => {
      frameMenu = cb;
      return () => {};
    },
  } as unknown as DesktopApi;
  setup(desktop);
  const item = document.querySelector<HTMLElement>('.player-layer__item[data-slot="0"]')!;
  document.elementsFromPoint = () => [item.querySelector('iframe')!, item];
  act(() => frameMenu!({ x: 120, y: 90 }));
  expect(items()).toEqual(['소리 끄기', '전체 화면', '후원하기', '세로로 보기', expect.stringMatching(/^즐겨찾기 (추가|해제)$/), '새 창으로 분리', '창 닫기']);
});
