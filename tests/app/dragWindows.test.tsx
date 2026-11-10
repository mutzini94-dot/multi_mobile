import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import type { DetachHost, SoloToHost } from '../../src/detach/channel';
import type { SoloPayload } from '../../src/detach/soloLink';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

/** 창 사이 끌어 놓기: 창을 메인 창 밖에 놓으면 그 자리에 분리 창, 분리 창을 메인 창 창에 놓으면 그 창으로 */
function fakeHost() {
  let onMsg: ((id: string, m: SoloToHost) => void) | null = null;
  let onDropped: ((id: string, x: number, y: number) => void) | null = null;
  let onHover: ((p: { x: number; y: number } | null) => void) | null = null;
  const opened: { p: SoloPayload; title: string; at?: { x: number; y: number } }[] = [];
  const host: DetachHost = {
    open: vi.fn((p, title, at) => {
      opened.push({ p, title, at });
      return true;
    }),
    close: vi.fn(),
    post: vi.fn(),
    onMessage: (cb) => ((onMsg = cb), () => (onMsg = null)),
    onClosed: () => () => {},
    onDropped: (cb) => ((onDropped = cb), () => (onDropped = null)),
    onDragHover: (cb) => ((onHover = cb), () => (onHover = null)),
  };
  return {
    host,
    opened,
    fromSolo: (id: string, m: SoloToHost) => act(() => onMsg?.(id, m)),
    dropped: (id: string, x: number, y: number) => act(() => onDropped?.(id, x, y)),
    hover: (p: { x: number; y: number } | null) => act(() => onHover?.(p)),
  };
}

let under: Element | null = null;
beforeEach(() => {
  under = null;
  (document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = () => (under ? [under] : []);
});

function setup() {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  favorites.add(mkCreator(3, { name: 'C' }));
  const f = fakeHost();
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} detachHost={f.host} />);
  return f;
}

const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const grip = (i: number) => within(tiles()[i]).getByRole('button', { name: '끌어서 자리 옮기기' });
const nameOf = (i: number) => tiles()[i].querySelector('.tile__name')?.textContent;

test('창을 메인 창 밖으로 끌면 안내가 뜨고, 놓으면 놓은 자리에 분리 창을 연다', () => {
  const { opened } = setup();
  pick(0, 'A');
  fireEvent.pointerDown(grip(0), { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: -80, clientY: 40 });
  expect(screen.getByRole('status', { name: '창 밖으로 끌기' })).toHaveTextContent('놓으면 새 창으로 분리');
  fireEvent.pointerUp(window, { pointerId: 1, clientX: -80, clientY: 40 });
  expect(opened).toHaveLength(1);
  expect(opened[0].p.item).toMatchObject({ name: 'A' });
  expect(opened[0].at).toEqual({ x: -80, y: 40 });
  expect(within(tiles()[0]).getByText('A · 새 창으로 분리됨')).toBeInTheDocument();
  expect(screen.queryByRole('status', { name: '창 밖으로 끌기' })).toBeNull();
});

test('빈 창이나 분리할 수 없는 창은 창 밖에 놓아도 분리하지 않는다', () => {
  const { opened } = setup();
  fireEvent.pointerDown(tiles()[1].querySelector('.tile__bar')!, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: -80, clientY: 40 });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: -80, clientY: 40 });
  expect(opened).toHaveLength(0);
});

test('분리 창을 메인 창의 빈 창에 놓으면: 그 창으로 돌아오고 분리 표시 창은 비운다', () => {
  const f = setup();
  pick(0, 'A');
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '새 창으로 분리' }));
  const id = f.opened[0].p.id;
  under = tiles()[2];
  f.hover({ x: 300, y: 300 });
  expect(tiles()[2]).toHaveClass('tile--drop'); // 끄는 동안 놓일 창 강조
  f.dropped(id, 300, 300);
  expect(f.host.close).toHaveBeenCalledWith(id);
  expect(nameOf(2)).toBe('A');
  expect(tiles()[0]).toHaveClass('tile--empty');
  f.hover(null);
  expect(tiles()[2]).not.toHaveClass('tile--drop');
});

test('분리 창을 방송이 있는 창에 놓으면: 자리 바꾸기 (그 방송은 분리 표시 창으로)', () => {
  const f = setup();
  pick(0, 'A');
  pick(1, 'B');
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '새 창으로 분리' }));
  under = tiles()[1];
  f.dropped(f.opened[0].p.id, 300, 300);
  expect(nameOf(1)).toBe('A');
  expect(nameOf(0)).toBe('B');
});

test('분리 창을 놓은 곳에 창이 없으면 아무 일도 없다', () => {
  const f = setup();
  pick(0, 'A');
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '새 창으로 분리' }));
  under = null;
  f.dropped(f.opened[0].p.id, 300, 300);
  expect(f.host.close).not.toHaveBeenCalled();
  expect(within(tiles()[0]).getByText('A · 새 창으로 분리됨')).toBeInTheDocument();
});

test('창 위를 지나 창 밖에서 놓으면: 지나간 창과 바꾸지 않고 분리', () => {
  const { opened } = setup();
  pick(0, 'A');
  pick(1, 'B');
  fireEvent.pointerDown(grip(0), { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
  under = tiles()[1];
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 200, clientY: 200 });
  under = null;
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 2000, clientY: 40 });
  expect(opened).toHaveLength(1);
  expect(nameOf(1)).toBe('B');
});
