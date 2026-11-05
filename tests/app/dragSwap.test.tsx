import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

const mounts: string[] = [];
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator }: { creator: { key: string } }) => {
    useEffect(() => {
      mounts.push(creator.key);
    }, [creator.key]);
    return <iframe title={`player-${creator.key}`} />;
  },
}));

const noBridge: ToonationBridge = { request: () => Promise.reject(new Error('NO_EXTENSION')) };

function setup() {
  mounts.length = 0;
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'https://mv.example.com/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
}

const tiles = () => document.querySelectorAll('.tile');
const tile = (i: number) => tiles()[i] as HTMLElement;
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tile(slot)).getByRole('button', { name: '불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name} ·`) }));
};

/** 포인터 드래그: 칸의 잡는 곳(⠿)을 눌러 끌고 다른 칸 위에서 놓는다 (jsdom은 레이아웃이 없어 커서 아래 칸을 흉내) */
let under: Element | null = null;
beforeEach(() => {
  under = null;
  (document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = () => (under ? [under] : []);
});
const grip = (i: number) => within(tile(i)).getByRole('button', { name: '끌어서 자리 옮기기' });
function startDrag(from: number) {
  fireEvent.pointerDown(grip(from), { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
}
function moveOver(to: number | null) {
  under = to === null ? null : tile(to);
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 200, clientY: 200 });
}
function drop() {
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 200, clientY: 200 });
}
function drag(from: number, to: number) {
  startDrag(from);
  moveOver(to);
  drop();
}

test('칸을 끌어 다른 칸에 놓으면 두 방송이 자리를 바꾼다', () => {
  setup();
  pick(0, 'A');
  pick(1, 'B');
  drag(0, 1);
  expect(within(tile(0)).getByText('B')).toBeInTheDocument();
  expect(within(tile(1)).getByText('A')).toBeInTheDocument();
});

test('자리를 바꿔도 플레이어를 다시 불러오지 않고, 문서 안 순서도 그대로다 (iframe 재로딩 방지)', () => {
  setup();
  pick(0, 'A');
  pick(1, 'B');
  const before = [...document.querySelectorAll('.player-layer iframe')];
  drag(0, 1);
  expect(mounts).toEqual(['twitch:chan_1', 'twitch:chan_2']);
  const after = [...document.querySelectorAll('.player-layer iframe')];
  expect(after).toEqual(before);
  // 영상을 클릭해 선택하는 기능도 바뀐 자리를 따른다
  const itemA = screen.getByTitle('player-twitch:chan_1').closest('.player-layer__item') as HTMLElement;
  expect(itemA.dataset.slot).toBe('1');
});

test('빈 칸에 놓으면 그 칸으로 옮겨 간다', () => {
  setup();
  pick(0, 'A');
  drag(0, 3);
  expect(within(tile(0)).getByRole('button', { name: '불러오기' })).toBeInTheDocument();
  expect(within(tile(3)).getByText('A')).toBeInTheDocument();
});

test('끄는 동안 놓을 칸을 강조하고, 영상이 드래그를 가로채지 않게 플레이어 레이어를 잠근다', () => {
  setup();
  pick(0, 'A');
  startDrag(0);
  // 누르기만 해서는 끌기가 아니다 (짧게 누르면 선택) — 기준 거리 이상 움직여야 시작
  expect(document.querySelector('.player-layer')).not.toHaveClass('player-layer--dragging');
  moveOver(2);
  expect(document.querySelector('.player-layer')).toHaveClass('player-layer--dragging');
  expect(tile(2)).toHaveClass('tile--drop');
  moveOver(null);
  expect(tile(2)).not.toHaveClass('tile--drop');
  drop();
  expect(document.querySelector('.player-layer')).not.toHaveClass('player-layer--dragging');
  expect(within(tile(0)).getByText('A')).toBeInTheDocument();
});

test('Esc로 끌기를 취소한다', () => {
  setup();
  pick(0, 'A');
  startDrag(0);
  moveOver(3);
  fireEvent.keyDown(window, { key: 'Escape' });
  drop();
  expect(within(tile(0)).getByText('A')).toBeInTheDocument();
  expect(document.querySelector('.player-layer__item--floating')).toBeNull();
});

describe('칸 어디를 잡아도 끌기 (위쪽 바·영상)', () => {
  const bar = (i: number) => tile(i).querySelector('.tile__bar') as HTMLElement;
  const grab = (slot: number) => document.querySelector(`.player-layer__item[data-slot="${slot}"] .player-layer__grab`) as HTMLElement;
  const pressAt = (el: HTMLElement) => fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
  const nudge = (dx: number) => fireEvent.pointerMove(window, { pointerId: 1, clientX: 10 + dx, clientY: 10 });

  test('위쪽 바(버튼이 아닌 곳)를 잡고 끌면 자리를 바꾼다', () => {
    setup();
    pick(0, 'A');
    pick(1, 'B');
    pressAt(bar(0));
    moveOver(1);
    drop();
    expect(within(tile(0)).getByText('B')).toBeInTheDocument();
    expect(within(tile(1)).getByText('A')).toBeInTheDocument();
  });

  test('영상 위의 잡는 층을 잡고 끌면 자리를 바꾼다', () => {
    setup();
    pick(0, 'A');
    pick(1, 'B');
    expect(grab(0)).not.toBeNull();
    pressAt(grab(0));
    moveOver(1);
    drop();
    expect(within(tile(1)).getByText('A')).toBeInTheDocument();
  });

  test('움직이지 않고 짧게 누르면 끌기가 아니라 그 칸 선택 (그 칸만 소리)', () => {
    setup();
    pick(0, 'A');
    pick(1, 'B'); // 1번 칸이 선택된 상태
    pressAt(grab(0));
    nudge(3); // 기준(6px)보다 작은 흔들림
    under = tile(1);
    drop();
    expect(within(tile(0)).getByText('A')).toBeInTheDocument();
    expect(tile(0)).toHaveClass('tile--selected');
    expect(within(tile(0)).getByRole('button', { name: '소리 끄기' })).toBeInTheDocument();
    expect(document.querySelector('.player-layer')).not.toHaveClass('player-layer--dragging');
  });

  test('선택된 칸은 잡는 층이 없어 클릭이 플레이어로 간다 (재생 버튼 등) — 끌기는 위쪽 바로', () => {
    setup();
    pick(0, 'A');
    pick(1, 'B'); // 1번 칸이 선택된 상태
    expect(grab(1)).toBeNull();
    expect(grab(0)).not.toBeNull();
    pressAt(grab(0)); // 0번 칸을 짧게 눌러 선택하면
    drop();
    expect(grab(0)).toBeNull(); // 이제 0번 칸 영상은 플레이어가 직접 받는다
    expect(grab(1)).not.toBeNull();
  });

  test('바의 버튼을 누르는 것은 끌기를 시작하지 않는다', () => {
    setup();
    pick(0, 'A');
    pressAt(within(tile(0)).getByRole('button', { name: '전체 화면' }));
    moveOver(2);
    expect(document.querySelector('.player-layer')).not.toHaveClass('player-layer--dragging');
    drop();
  });

});

describe('끄는 동안 작은 창 효과', () => {
  const item = (key: string) => screen.getByTitle(`player-${key}`).closest('.player-layer__item') as HTMLElement;

  test('끌기가 시작되면 그 방송이 작은 창으로 커서를 따라다니고, 원래 자리는 빈자리로 보인다', () => {
    setup();
    pick(0, 'A');
    pick(1, 'B');
    const iframeA = screen.getByTitle('player-twitch:chan_1');
    startDrag(0);
    moveOver(2); // 커서 (200, 200)
    const a = item('twitch:chan_1');
    expect(a).toHaveClass('player-layer__item--floating');
    expect(a.style.width).toBe('260px');
    expect(parseFloat(a.style.height)).toBeCloseTo(146.25, 1); // 크기를 모르면 16:9
    // 커서를 가운데로 (jsdom에서 무대 위치는 0,0)
    expect(a.style.left).toBe(`${200 - 130}px`);
    expect(within(a).getByText('A')).toBeInTheDocument(); // 이름표
    expect(item('twitch:chan_2')).not.toHaveClass('player-layer__item--floating');
    expect(tile(0)).toHaveClass('tile--drag-source');
    expect(screen.getByTitle('player-twitch:chan_1')).toBe(iframeA); // 다시 만들지 않음
  });

  test('놓으면 작은 창 효과가 끝나고 제자리로 들어가는 동안 부드럽게 움직인다', () => {
    vi.useFakeTimers();
    setup();
    pick(0, 'A');
    pick(1, 'B');
    startDrag(0);
    moveOver(1);
    drop();
    const a = item('twitch:chan_1');
    expect(a).not.toHaveClass('player-layer__item--floating');
    expect(a).toHaveClass('player-layer__item--settling');
    expect(tile(0)).not.toHaveClass('tile--drag-source');
    act(() => vi.advanceTimersByTime(400));
    expect(item('twitch:chan_1')).not.toHaveClass('player-layer__item--settling');
    vi.useRealTimers();
  });

  test('짧게 누르기만 하면 작은 창이 되지 않는다', () => {
    setup();
    pick(0, 'A');
    startDrag(0);
    expect(item('twitch:chan_1')).not.toHaveClass('player-layer__item--floating');
    drop();
  });
});
