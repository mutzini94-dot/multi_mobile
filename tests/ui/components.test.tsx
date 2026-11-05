import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Gnb } from '../../src/ui/Gnb';
import { Tile } from '../../src/ui/Tile';
import { TileGrid } from '../../src/ui/TileGrid';
import { FavoritesPicker } from '../../src/ui/FavoritesPicker';
import { DonationBar } from '../../src/ui/DonationBar';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { initialViewState } from '../../src/app/viewState';
import { applyLayout } from '../../src/layout/layouts';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const noop = () => {};
const gnbProps = { layout: 'quad' as const, onLayout: noop, canDonate: true, onDonate: noop };
const tileProps = { creator: null, selected: false, soundOn: true, onSelect: noop, onLoad: noop, onToggleSound: noop };

describe('Gnb', () => {
  test('레이아웃 버튼 4개와 현재 레이아웃 표시', () => {
    render(<Gnb {...gnbProps} />);
    for (const l of ['1화면', '2분할', '1+2']) expect(screen.getByRole('button', { name: l })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '4분할' })).toHaveAttribute('aria-pressed', 'true');
  });
  test('레이아웃 클릭 시 onLayout', async () => {
    const onLayout = vi.fn();
    render(<Gnb {...gnbProps} onLayout={onLayout} />);
    await userEvent.click(screen.getByRole('button', { name: '1+2' }));
    expect(onLayout).toHaveBeenCalledWith('oneTwo');
  });
  test('도구 버튼은 같은 모양의 아이콘 버튼 (이름은 툴팁·aria-label로)', () => {
    const noop2 = () => {};
    render(<Gnb {...gnbProps} onLive={noop2} onReloadAll={noop2} sound={{ on: true, onToggle: noop2 }} onMini={noop2} onPresets={noop2} onSettings={noop2} account={{ cash: 51200, onHistory: noop2 }} />);
    const tools = screen.getByRole('toolbar', { name: '도구' });
    const names = ['추천 라이브', '전체 새로고침', '전체 음소거', '미니 모드', '화면 구성', '설정'];
    for (const n of names) {
      const b = within(tools).getByRole('button', { name: n });
      expect(b.querySelector('svg')).not.toBeNull();
      expect(b).toHaveAttribute('data-tip');
      expect(b.textContent).toBe('');
    }
    const cash = screen.getByRole('button', { name: '내 후원 내역 · 캐시 51,200' });
    expect(cash.querySelector('svg')).not.toBeNull();
    expect(cash.textContent).toBe('51,200');
    expect(screen.getByRole('button', { name: '후원하기' }).querySelector('svg')).not.toBeNull();
  });
  test('canDonate=false면 후원하기 비활성', () => {
    render(<Gnb {...gnbProps} canDonate={false} />);
    expect(screen.getByRole('button', { name: '후원하기' })).toBeDisabled();
  });
});

describe('Tile', () => {
  test('빈 칸은 불러오기만', () => {
    render(<Tile {...tileProps} />);
    expect(screen.getByRole('button', { name: '불러오기' })).toBeInTheDocument();
    expect(screen.queryByTestId('player')).toBeNull();
    expect(screen.queryByRole('button', { name: /소리/ })).toBeNull();
  });
  test('트위치가 자동 재생을 시작하는 동안(starting)은 영상 위 바를 숨긴다 (겹치면 트위치가 재생을 막는다)', () => {
    const { container } = render(<Tile {...tileProps} creator={mkCreator(1)} starting />);
    expect(container.querySelector('.tile')!.className).toMatch(/tile--starting/);
  });
  test('빈 칸: 점선 영역에 불러오기 버튼과 최근 본 크리에이터 바로 넣기 (방송 중이면 표시), 더보기는 불러오기', async () => {
    const onLoad = vi.fn();
    const onQuickPick = vi.fn();
    const a = mkCreator(1, { name: '하나' });
    render(<Tile {...tileProps} onLoad={onLoad} quickPicks={[{ creator: a, live: true }, { creator: mkCreator(2, { name: '둘' }), live: false }]} onQuickPick={onQuickPick} />);
    expect(document.querySelector('.tile__empty')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '하나 · 방송 중 · 이 칸에 넣기' }));
    expect(onQuickPick).toHaveBeenCalledWith(a);
    await userEvent.click(screen.getByRole('button', { name: '더보기' }));
    await userEvent.click(screen.getByRole('button', { name: '불러오기' }));
    expect(onLoad).toHaveBeenCalledTimes(2);
    expect(screen.getByText('카드를 끌어 놓아도 돼요')).toBeInTheDocument();
  });
  test('빈 칸: 최근 본 크리에이터가 없으면 불러오기와 안내만', () => {
    render(<Tile {...tileProps} />);
    expect(screen.queryByRole('button', { name: '더보기' })).toBeNull();
    expect(screen.getAllByRole('button', { name: '불러오기' })).toHaveLength(1);
  });
  test('선택되면 tile--selected', () => {
    const { container } = render(<Tile {...tileProps} creator={mkCreator(1)} selected />);
    expect(container.firstChild).toHaveClass('tile--selected');
  });
  test('사운드 버튼 라벨', () => {
    const { rerender } = render(<Tile {...tileProps} creator={mkCreator(1)} selected soundOn />);
    expect(screen.getByRole('button', { name: '소리 끄기' })).toBeInTheDocument();
    rerender(<Tile {...tileProps} creator={mkCreator(1)} selected soundOn={false} />);
    expect(screen.getByRole('button', { name: '소리 켜기' })).toBeInTheDocument();
    rerender(<Tile {...tileProps} creator={mkCreator(1)} selected={false} soundOn />);
    expect(screen.getByRole('button', { name: '소리 켜기' })).toBeInTheDocument();
  });
  test('칸 클릭 시 onSelect, 사운드 버튼 클릭 시 onToggleSound만', async () => {
    const onSelect = vi.fn();
    const onToggleSound = vi.fn();
    render(<Tile {...tileProps} creator={mkCreator(1)} selected onSelect={onSelect} onToggleSound={onToggleSound} />);
    await userEvent.click(screen.getByText('크리에이터1'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: '소리 끄기' }));
    expect(onToggleSound).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('TileGrid', () => {
  test('oneTwo: 0,1은 왼쪽 열, 2는 오른쪽 열', () => {
    const state = applyLayout(initialViewState, 'oneTwo');
    const { container } = render(<TileGrid state={state} renderTile={(i) => <span data-slot={i} />} onSizes={noop} />);
    const slotCol = (i: number) => container.querySelector(`[data-slot="${i}"]`)!.closest('[data-col]')!.getAttribute('data-col');
    expect([slotCol(0), slotCol(1), slotCol(2)]).toEqual(['left', 'left', 'right']);
  });
  test.each([['single', 1], ['split2', 2], ['quad', 4]] as const)('%s는 칸 %i개', (layout, n) => {
    const { container } = render(
      <TileGrid state={applyLayout(initialViewState, layout)} renderTile={(i) => <span data-slot={i} />} onSizes={noop} />,
    );
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(n);
  });
});

describe('FavoritesPicker', () => {
  const source = () => localFavorites(safeStorage(undefined));
  test('목록 항목 클릭 시 onPick', async () => {
    const s = source();
    s.add(mkCreator(1));
    const onPick = vi.fn();
    render(<FavoritesPicker source={s} onPick={onPick} onClose={noop} />);
    await userEvent.click(screen.getByRole('button', { name: /^크리에이터1 ·/ }));
    expect(onPick).toHaveBeenCalledWith(mkCreator(1));
  });
  test('유튜브 @핸들은 오류, 저장 안 됨', async () => {
    const s = source();
    render(<FavoritesPicker source={s} onPick={noop} onClose={noop} />);
    await userEvent.type(screen.getByLabelText('이름'), '유튜버');
    await userEvent.selectOptions(screen.getByLabelText('플랫폼'), 'youtube');
    await userEvent.type(screen.getByLabelText('채널'), '@foo');
    await userEvent.type(screen.getByLabelText('투네이션 후원 아이디'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(screen.getByText('유튜브는 채널 ID(UC로 시작)를 입력해 주세요')).toBeInTheDocument();
    expect(s.list()).toEqual([]);
  });
  test('올바른 입력은 저장되고 목록에 나타남', async () => {
    const s = source();
    render(<FavoritesPicker source={s} onPick={noop} onClose={noop} />);
    await userEvent.type(screen.getByLabelText('이름'), '스트리머');
    await userEvent.type(screen.getByLabelText('채널'), 'https://twitch.tv/Some_One');
    await userEvent.type(screen.getByLabelText('투네이션 후원 아이디'), 'toon.at/donate/xyz');
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(s.list()).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^스트리머 ·/ })).toBeInTheDocument();
  });
  test('삭제 버튼', async () => {
    const s = source();
    s.add(mkCreator(1));
    render(<FavoritesPicker source={s} onPick={noop} onClose={noop} />);
    await userEvent.click(screen.getByRole('button', { name: '크리에이터1 삭제' }));
    expect(s.list()).toEqual([]);
  });
});

describe('DonationBar', () => {
  test('현재 후원 창, 경고, 메시지', () => {
    render(<DonationBar popupCreator={mkCreator(1)} warning="경고문" message="알림" />);
    expect(screen.getByText('현재 후원 창: 크리에이터1')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('경고문');
    expect(screen.getByText('알림')).toBeInTheDocument();
  });
  test('아무것도 없으면 경고 없음', () => {
    render(<DonationBar popupCreator={null} warning={null} message={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('PlayerLayer', () => {
  test('경계를 드래그하는 동안에는 플레이어가 포인터를 받지 않는다', async () => {
    const { PlayerLayer } = await import('../../src/ui/PlayerLayer');
    const state = { ...applyLayout(initialViewState, 'split2'), slots: [mkCreator(1), null] };
    const ref = { current: null };
    const { container, rerender } = render(<PlayerLayer state={state} stageRef={ref} slotEls={{ current: [] }} onReady={noop} dragging={false} />);
    expect(container.firstChild).not.toHaveClass('player-layer--dragging');
    rerender(<PlayerLayer state={state} stageRef={ref} slotEls={{ current: [] }} onReady={noop} dragging />);
    expect(container.firstChild).toHaveClass('player-layer--dragging');
  });
});

describe('선택 강조', () => {
  test('선택된 칸의 플레이어에만 강조 표시가 붙는다 (영상 위에 그려 가려지지 않게)', async () => {
    const { PlayerLayer } = await import('../../src/ui/PlayerLayer');
    const state = { ...applyLayout(initialViewState, 'split2'), slots: [mkCreator(1), mkCreator(2)], selected: 1 };
    const { container, rerender } = render(<PlayerLayer state={state} stageRef={{ current: null }} slotEls={{ current: [] }} onReady={noop} />);
    const items = () => [...container.querySelectorAll('.player-layer__item')];
    expect(items().map((el) => el.classList.contains('player-layer__item--selected'))).toEqual([false, true]);
    expect(items()[1].querySelector('.player-layer__highlight')).not.toBeNull();
    rerender(<PlayerLayer state={{ ...state, selected: null }} stageRef={{ current: null }} slotEls={{ current: [] }} onReady={noop} />);
    expect(container.querySelector('.player-layer__item--selected')).toBeNull();
  });
});

