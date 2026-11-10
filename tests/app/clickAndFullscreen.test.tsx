import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

// 실제 플레이어처럼 iframe을 그린다 (클릭하면 포커스가 iframe으로 들어간다)
vi.mock('../../src/players/StreamPlayer', () => ({
  StreamPlayer: ({ creator }: { creator: { key: string } }) => <iframe title={`player-${creator.key}`} />,
}));

const noBridge: ToonationBridge = { request: () => Promise.reject(new Error('NO_EXTENSION')) };

function setup() {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const win = {
    open: vi.fn(() => ({ closed: false }) as unknown as Window),
    screen: { availWidth: 1920, availHeight: 1040 } as Screen,
    location: { hash: '', href: 'http://x/' } as Location,
    navigator: {} as Navigator,
  };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  // 1·2번 창에 A·B를 불러오고 1번 창을 선택한 상태에서 시작
  for (const [slot, name] of [[0, 'A'], [1, 'B']] as const) {
    fireEvent.click(within(document.querySelectorAll('.tile')[slot] as HTMLElement).getByRole('button', { name: '불러오기' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name} ·`) }));
  }
  fireEvent.click(within(document.querySelectorAll('.tile')[0] as HTMLElement).getByText('A'));
  return { win };
}

const tiles = () => document.querySelectorAll('.tile');
const iframe = (key: string) => screen.getByTitle(`player-${key}`) as HTMLIFrameElement;

/** 사용자가 영상(iframe)을 클릭: 포커스가 iframe으로 옮겨가고 페이지 window는 blur된다 */
function clickVideo(key: string) {
  act(() => {
    iframe(key).focus();
    window.dispatchEvent(new Event('blur'));
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('영상 클릭으로 선택', () => {
  test('영상을 클릭하면 그 창이 선택되고 그 창만 소리가 난다', () => {
    setup();
    clickVideo('twitch:chan_2');
    act(() => vi.runOnlyPendingTimers());
    expect(tiles()[1]).toHaveClass('tile--selected');
    expect(within(tiles()[1] as HTMLElement).getByRole('button', { name: '소리 끄기' })).toBeInTheDocument();
    expect(within(tiles()[0] as HTMLElement).getByRole('button', { name: '소리 켜기' })).toBeInTheDocument();
  });

  test('다른 영상을 이어서 클릭해도 선택이 옮겨간다', () => {
    setup();
    clickVideo('twitch:chan_1');
    act(() => vi.runOnlyPendingTimers());
    expect(tiles()[0]).toHaveClass('tile--selected');
    clickVideo('twitch:chan_2');
    act(() => vi.runOnlyPendingTimers());
    expect(tiles()[1]).toHaveClass('tile--selected');
    expect(tiles()[0]).not.toHaveClass('tile--selected');
  });

  test('영상이 아닌 곳으로 포커스가 나가면(다른 프로그램 등) 선택은 그대로', () => {
    setup();
    clickVideo('twitch:chan_1');
    act(() => vi.runOnlyPendingTimers());
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.dispatchEvent(new Event('blur'));
    });
    act(() => vi.runOnlyPendingTimers());
    expect(tiles()[0]).toHaveClass('tile--selected');
  });
});

describe('창 전체 화면', () => {
  test('전체 화면 버튼은 방송이 있는 창에만 있다', () => {
    setup();
    expect(within(tiles()[0] as HTMLElement).getByRole('button', { name: '전체 화면' })).toBeInTheDocument();
    expect(within(tiles()[2] as HTMLElement).queryByRole('button', { name: '전체 화면' })).toBeNull();
  });

  test('누르면 그 창이 선택되고 화면 전체를 채우며, 종료 버튼과 Esc로 돌아온다', () => {
    setup();
    fireEvent.click(within(tiles()[1] as HTMLElement).getByRole('button', { name: '전체 화면' }));
    expect(tiles()[1]).toHaveClass('tile--selected');
    const focus = screen.getByRole('region', { name: 'B 전체 화면' });
    expect(focus).toBeInTheDocument();
    expect(document.querySelector('.stage')).toHaveClass('stage--focus');
    // 다른 방송은 끊지 않는다 (플레이어 그대로)
    expect(iframe('twitch:chan_1')).toBeInTheDocument();
    fireEvent.click(within(focus).getByRole('button', { name: '전체 화면 종료' }));
    expect(screen.queryByRole('region', { name: 'B 전체 화면' })).toBeNull();
    expect(document.querySelector('.stage')).not.toHaveClass('stage--focus');

    fireEvent.click(within(tiles()[0] as HTMLElement).getByRole('button', { name: '전체 화면' }));
    expect(screen.getByRole('region', { name: 'A 전체 화면' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'A 전체 화면' })).toBeNull();
  });

  test('전체 화면 중 레이아웃 축소로 그 창이 사라지면 전체 화면도 끝난다', () => {
    setup();
    fireEvent.click(within(tiles()[1] as HTMLElement).getByRole('button', { name: '전체 화면' }));
    fireEvent.click(screen.getByRole('button', { name: '1화면' }));
    expect(screen.queryByRole('region', { name: 'B 전체 화면' })).toBeNull();
  });

  test('전체 화면에서는 위·아래 바를 숨기고, 전체 화면 바에서 후원할 수 있다', () => {
    const { win } = setup();
    fireEvent.click(within(tiles()[1] as HTMLElement).getByRole('button', { name: '전체 화면' }));
    expect(document.querySelector('.app')).toHaveClass('app--focus');
    const focus = screen.getByRole('region', { name: 'B 전체 화면' });
    fireEvent.click(within(focus).getByRole('button', { name: '후원하기' }));
    expect(win.open).toHaveBeenCalledWith('https://toon.at/donate/don2', 'mv-donate', expect.any(String));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.app')).not.toHaveClass('app--focus');
  });
});

describe('방송 삭제', () => {
  test('방송이 있는 창에만 삭제 버튼이 있고, 누르면 창이 비고 플레이어도 사라진다', () => {
    setup();
    expect(within(tiles()[2] as HTMLElement).queryByRole('button', { name: '방송 삭제' })).toBeNull();
    fireEvent.click(within(tiles()[1] as HTMLElement).getByRole('button', { name: '방송 삭제' }));
    expect(within(tiles()[1] as HTMLElement).queryByText('B', { selector: '.tile__name' })).toBeNull();
    expect(within(tiles()[1] as HTMLElement).getByRole('button', { name: '불러오기' })).toBeInTheDocument();
    expect(screen.queryByTitle('player-twitch:chan_2')).toBeNull();
    expect(iframe('twitch:chan_1')).toBeInTheDocument();
  });

  test('선택된 창을 지우면 선택이 풀리고, 후원하기는 남은 방송에서 고르게 된다', () => {
    setup();
    fireEvent.click(within(tiles()[0] as HTMLElement).getByText('A'));
    expect(screen.getByRole('button', { name: '후원하기' })).toBeEnabled();
    fireEvent.click(within(tiles()[0] as HTMLElement).getByRole('button', { name: '방송 삭제' }));
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '후원하기' })).toBeEnabled();
  });

  test('삭제 버튼을 눌러도 창 선택이 바뀌지 않는다', () => {
    setup();
    fireEvent.click(within(tiles()[0] as HTMLElement).getByText('A'));
    fireEvent.click(within(tiles()[1] as HTMLElement).getByRole('button', { name: '방송 삭제' }));
    expect(tiles()[0]).toHaveClass('tile--selected');
  });
});
