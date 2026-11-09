import { fireEvent, render, screen, within } from '@testing-library/react';
import { TileGrid } from '../../src/ui/TileGrid';
import { Gnb } from '../../src/ui/Gnb';
import { applyLayout } from '../../src/layout/layouts';
import { initialViewState } from '../../src/app/viewState';

test('휴대폰: 칸을 세로로 쌓는다 (나누기 손잡이 없이), 보이는 칸만', () => {
  const state = applyLayout(initialViewState, 'wideSide');
  const { container } = render(<TileGrid state={state} phone onSizes={() => {}} renderTile={(slot) => <div className="t" data-slot={slot} />} />);
  const grid = container.querySelector('.tile-grid')!;
  expect(grid.className).toMatch(/tile-grid--phone/);
  expect(grid.className).toMatch(/tile-grid--wideSide/);
  expect([...container.querySelectorAll('.t')].map((e) => (e as HTMLElement).dataset.slot)).toEqual(['0', '1']);
  expect(container.querySelector('.resize-handle')).toBeNull();
  const quad = render(<TileGrid state={applyLayout(initialViewState, 'quad')} phone onSizes={() => {}} renderTile={(slot) => <div className="q" data-slot={slot} />} />);
  expect(quad.container.querySelectorAll('.q')).toHaveLength(4);
});

test('휴대폰: 세로 방송 칸은 다른 칸의 2배 높이', () => {
  const state = applyLayout(initialViewState, 'oneTwo');
  const { container } = render(<TileGrid state={state} phone tallSlots={[1]} onSizes={() => {}} renderTile={(slot) => <div data-slot={slot} />} />);
  expect((container.querySelector('.tile-grid') as HTMLElement).style.gridTemplateRows).toBe('minmax(var(--phone-row), 1fr) minmax(calc(var(--phone-row) * 2), 2fr) minmax(var(--phone-row), 1fr)');
});

test('휴대폰 상단 메뉴: 메뉴 버튼이 도구·설정을 담은 시트를 열고(화면 모양 없음), 고르면 닫힌다', () => {
  const onLayout = vi.fn();
  const onSettings = vi.fn();
  const onReloadAll = vi.fn();
  const onMode = vi.fn();
  render(
    <Gnb
      layout="wideSide"
      onLayout={onLayout}
      canDonate
      onDonate={() => {}}
      onSettings={onSettings}
      onReloadAll={onReloadAll}
      onLive={() => {}}
      onHelp={() => {}}
      sound={{ on: true, onToggle: () => {} }}
      mode={{ value: 'donor', onChange: onMode }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
  const sheet = screen.getByRole('dialog', { name: '메뉴' });
  expect(within(sheet).queryByRole('button', { name: '큰 화면+1' })).toBeNull(); // 화면 모양은 고르지 않는다 (휴대폰은 세로 한 줄)
  expect(within(sheet).queryByText('화면 모양')).toBeNull();
  for (const n of ['추천 라이브', '전체 새로고침', '전체 음소거', '도움말', '설정', '크리에이터 리모컨']) expect(within(sheet).getByRole('button', { name: n })).toBeInTheDocument();
  fireEvent.click(within(sheet).getByRole('button', { name: '전체 새로고침' }));
  expect(onReloadAll).toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '메뉴' })).getByRole('button', { name: '설정' }));
  expect(onSettings).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '메뉴' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '메뉴' })).getByRole('button', { name: '크리에이터 리모컨' }));
  expect(onMode).toHaveBeenCalledWith('creator');
});
