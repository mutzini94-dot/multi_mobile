import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { ShortsFeed } from '../../src/ui/ShortsFeed';
import type { Creator } from '../../src/domain/types';
import type { LivePage, LiveQuery } from '../../src/toonation/liveList';
import type { PlayerHandle } from '../../src/players/types';
import { mkCreator } from '../helpers/fixtures';

const handle = { setMuted: vi.fn(), isMuted: () => true } as unknown as PlayerHandle;
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator, onReady }: { creator: Creator; onReady(h: PlayerHandle): void }) => {
    useEffect(() => onReady(handle), [onReady]);
    return <div data-testid={`player-${creator.name}`} />;
  },
}));

const item = (n: number) => ({ creator: { ...mkCreator(n, { name: `방송${n}`, source: 'toonation' as const }), live: { title: `제목${n}`, viewers: 100 * n } }, thumbnail: `https://t/${n}.jpg`, category: '' });
const page = (p: number, size = 3, total = 2): LivePage => ({ items: Array.from({ length: size }, (_, i) => item((p - 1) * size + i + 1)), page: p, totalPages: total, total: size * total });

function setup() {
  const load = vi.fn(async (q: LiveQuery) => page(q.page));
  const onAdd = vi.fn();
  const onDonate = vi.fn();
  const onClose = vi.fn();
  render(<ShortsFeed load={load} onAdd={onAdd} onDonate={onDonate} onClose={onClose} />);
  const feed = () => screen.getByRole('region', { name: '추천 라이브 탐색' });
  const scroller = () => feed().querySelector('.shorts__scroller') as HTMLElement;
  const scrollTo = (i: number) => {
    const s = scroller();
    Object.defineProperty(s, 'clientHeight', { value: 600, configurable: true });
    s.scrollTop = 600 * i;
    fireEvent.scroll(s);
  };
  return { load, onAdd, onDonate, onClose, feed, scrollTo };
}

test('시청자 많은 순 라이브를 한 개씩: 보이는 방송만 재생, 나머지는 썸네일', async () => {
  const { load, feed } = setup();
  expect(await within(feed()).findByTestId('player-방송1')).toBeInTheDocument();
  expect(load).toHaveBeenCalledWith(expect.objectContaining({ page: 1, order: 'VIEWERS' }));
  expect(within(feed()).queryByTestId('player-방송2')).toBeNull();
  expect(within(feed()).getByText('제목1')).toBeInTheDocument();
  expect(within(feed()).getByText('시청자 100명')).toBeInTheDocument();
});

test('스크롤하면 다음 방송이 재생되고, 끝에 가까우면 다음 쪽을 불러온다', async () => {
  const { load, feed, scrollTo } = setup();
  await within(feed()).findByTestId('player-방송1');
  act(() => scrollTo(1));
  expect(within(feed()).getByTestId('player-방송2')).toBeInTheDocument();
  expect(within(feed()).queryByTestId('player-방송1')).toBeNull();
  act(() => scrollTo(2));
  expect(load).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  expect(await within(feed()).findByText('제목4')).toBeInTheDocument();
});

test('↓·↑ 키로 다음·이전 방송', async () => {
  const { feed } = setup();
  await within(feed()).findByTestId('player-방송1');
  const s = feed().querySelector('.shorts__scroller') as HTMLElement;
  const scrollBy = vi.fn();
  s.scrollBy = scrollBy as unknown as typeof s.scrollBy;
  Object.defineProperty(s, 'clientHeight', { value: 600, configurable: true });
  fireEvent.keyDown(s, { key: 'ArrowDown' });
  expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: 600 }));
  fireEvent.keyDown(s, { key: 'ArrowUp' });
  expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ top: -600 }));
});

test('버튼: 창에 넣기 · 후원 · 소리 · 닫기', async () => {
  const { feed, onAdd, onDonate, onClose } = setup();
  await within(feed()).findByTestId('player-방송1');
  fireEvent.click(within(feed()).getByRole('button', { name: '방송1 창에 넣기' }));
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: '방송1' }));
  fireEvent.click(within(feed()).getByRole('button', { name: '방송1 후원하기' }));
  expect(onDonate).toHaveBeenCalledWith(expect.objectContaining({ name: '방송1' }));
  fireEvent.click(within(feed()).getByRole('button', { name: '소리 켜기' }));
  expect(handle.setMuted).toHaveBeenLastCalledWith(false);
  expect(within(feed()).getByRole('button', { name: '소리 끄기' })).toBeInTheDocument();
  fireEvent.click(within(feed()).getByRole('button', { name: '닫기' }));
  expect(onClose).toHaveBeenCalled();
});

test('창 크기를 바꾸는 동안에도 보던 방송을 그대로 (다른 방송으로 넘어가거나 다시 불러오지 않는다)', async () => {
  let resized: (() => void) | null = null;
  const RO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(cb: () => void) {
      resized = cb;
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  try {
    const { feed, scrollTo } = setup();
    await within(feed()).findByTestId('player-방송1');
    act(() => scrollTo(2)); // 높이 600에서 3번째 방송
    expect(within(feed()).getByTestId('player-방송3')).toBeInTheDocument();
    const s = feed().querySelector('.shorts__scroller') as HTMLElement;
    // 높이를 400으로 줄이면: 스크롤 위치(1200)는 그대로라 그냥 두면 4번째(1200/400 = 3)로 넘어간다
    Object.defineProperty(s, 'clientHeight', { value: 400, configurable: true });
    act(() => resized?.());
    expect(s.scrollTop).toBe(800); // 3번째 방송 자리로 맞춘다
    act(() => {
      fireEvent.scroll(s);
    });
    expect(within(feed()).getByTestId('player-방송3')).toBeInTheDocument();
  } finally {
    globalThis.ResizeObserver = RO;
  }
});
