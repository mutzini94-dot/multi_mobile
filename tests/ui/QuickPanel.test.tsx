import { fireEvent, render, screen, within } from '@testing-library/react';
import { QuickPanel } from '../../src/ui/QuickPanel';
import { mkCreator } from '../helpers/fixtures';

const fav = [
  { creator: mkCreator(1, { name: '하나', profile: 'https://p/1.png' }), live: true },
  { creator: mkCreator(2, { name: '둘' }), live: false },
];
const recent = [{ creator: mkCreator(3, { name: '셋' }), live: null }];

function setup(over: Partial<Parameters<typeof QuickPanel>[0]> = {}) {
  const onPick = vi.fn();
  const onDismiss = vi.fn();
  render(<QuickPanel side="left" favorites={fav} recent={recent} started={[]} onPick={onPick} onDismiss={onDismiss} {...over} />);
  return { onPick, onDismiss, panel: screen.getByRole('complementary', { name: '퀵패널' }) };
}

test('즐겨찾기(기본)·최근 본 목록을 프로필로, 방송 중이면 표시', () => {
  const { panel } = setup();
  expect(within(panel).getByRole('tab', { name: '즐겨찾기' })).toHaveAttribute('aria-selected', 'true');
  const first = within(panel).getByRole('button', { name: '하나 · 방송 중' });
  expect(first.className).toMatch(/quick-panel__item--live/);
  expect(first.querySelector('img')?.getAttribute('src')).toBe('https://p/1.png');
  expect(within(panel).getByRole('button', { name: '둘' })).toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('tab', { name: '최근 본' }));
  expect(within(panel).getByRole('button', { name: '셋' })).toBeInTheDocument();
  expect(within(panel).queryByRole('button', { name: /하나/ })).toBeNull();
});

test('크리에이터를 누르면 그 크리에이터를 고른다', () => {
  const { panel, onPick } = setup();
  fireEvent.click(within(panel).getByRole('button', { name: '둘' }));
  expect(onPick).toHaveBeenCalledWith(fav[1].creator);
});

test('목록이 비면 안내', () => {
  const { panel } = setup({ favorites: [], recent: [] });
  expect(within(panel).getByText('즐겨찾기 없음')).toBeInTheDocument();
});

test('방송 시작 알림: 프로필에 새로 시작 표시 + 알림 카드, 누르면 고르기, ✕는 닫기', () => {
  const { panel, onPick, onDismiss } = setup({ started: [fav[0].creator] });
  expect(within(panel).getByRole('button', { name: '하나 · 방송 중 · 방금 시작' }).className).toMatch(/quick-panel__item--new/);
  const alert = within(panel).getByRole('status', { name: '방송 시작 알림' });
  expect(within(alert).getByText('하나 방송 시작')).toBeInTheDocument();
  fireEvent.click(within(alert).getByRole('button', { name: '하나 방송 칸에 넣기' }));
  expect(onPick).toHaveBeenCalledWith(fav[0].creator);
  fireEvent.click(within(alert).getByRole('button', { name: '하나 알림 닫기' }));
  expect(onDismiss).toHaveBeenCalledWith(fav[0].creator.key);
});

test('최근 본 탭을 보고 있어도 즐겨찾기 탭에 새 방송 표시', () => {
  const { panel } = setup({ started: [fav[0].creator] });
  fireEvent.click(within(panel).getByRole('tab', { name: '최근 본' }));
  expect(within(panel).getByRole('tab', { name: '즐겨찾기 · 새 방송' })).toBeInTheDocument();
});
