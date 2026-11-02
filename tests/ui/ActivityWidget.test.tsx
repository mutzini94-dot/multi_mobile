import { fireEvent, render, screen, within } from '@testing-library/react';
import { ActivityWidget } from '../../src/ui/ActivityWidget';
import type { LiveTarget } from '../../src/activity/liveTargets';
import type { TimelineItem } from '../../src/activity/timeline';
import { mkCreator } from '../helpers/fixtures';

const now = Date.parse('2026-11-02T15:00:00+09:00');
const liveC = (n: number, viewers: number) => ({ ...mkCreator(n), live: { title: `방송${n}`, viewers, startedAt: now - 3_600_000 } });
const live: LiveTarget[] = [
  { creator: liveC(1, 1203), reason: { kind: 'favorite' } },
  { creator: liveC(2, 80), reason: { kind: 'donated', count: 3 } },
];
const timeline: TimelineItem[] = [
  { kind: 'watch', at: now - 60_000, creator: mkCreator(5) },
  { kind: 'donation', at: now - 120_000, name: '에이', cash: 5000 },
  { kind: 'settings', at: now - 180_000, text: '테마: 라이트 → 다크' },
  { kind: 'watch', at: now - 240_000, creator: mkCreator(6) },
  { kind: 'watch', at: now - 300_000, creator: mkCreator(7) },
];

function setup(over: Partial<Parameters<typeof ActivityWidget>[0]> = {}) {
  const onOpen = vi.fn();
  const onLogin = vi.fn();
  const isLive = (key: string) => (key === 'twitch:chan_5' ? true : key === 'twitch:chan_6' ? false : null);
  render(<ActivityWidget loggedIn live={live} timeline={timeline} isLive={isLive} now={now} onOpen={onOpen} onLogin={onLogin} {...over} />);
  return { onOpen, onLogin };
}

test('지금 라이브: 개수·이유 배지, 누르면 그 방송을 연다', () => {
  const { onOpen } = setup();
  expect(screen.getByText('지금 라이브 · 2')).toBeInTheDocument();
  const list = screen.getByRole('list', { name: '지금 라이브' });
  expect(within(list).getByText('즐겨찾기')).toBeInTheDocument();
  expect(within(list).getByText('후원 3회')).toBeInTheDocument();
  fireEvent.click(within(list).getByRole('button', { name: /크리에이터2/ }));
  expect(onOpen).toHaveBeenCalledWith(live[1].creator);
});

test('최근 활동: 시청 줄만 누를 수 있고 LIVE·종료·모름을 표시한다', () => {
  const { onOpen } = setup();
  const list = screen.getByRole('list', { name: '최근 활동' });
  expect(within(list).getByText('크리에이터5 시청')).toBeInTheDocument();
  expect(within(list).getByText('에이에게 5,000캐시 후원')).toBeInTheDocument();
  expect(within(list).getByText('테마: 라이트 → 다크')).toBeInTheDocument();
  expect(within(list).getAllByRole('button')).toHaveLength(3); // 시청 3줄만
  const rows = within(list).getAllByRole('listitem');
  expect(within(rows[0]).getByText('LIVE')).toBeInTheDocument();
  expect(within(rows[3]).getByText('종료')).toBeInTheDocument();
  expect(within(rows[4]).queryByText(/LIVE|종료/)).toBeNull();
  fireEvent.click(within(list).getByRole('button', { name: /크리에이터5 시청/ }));
  expect(onOpen).toHaveBeenCalledWith(mkCreator(5));
});

test('로그인 안 함: 라이브 자리에 안내와 로그인 버튼, 최근 활동은 그대로', () => {
  const { onLogin } = setup({ loggedIn: false, live: null });
  expect(screen.getByText('투네이션에 로그인하면 즐겨찾기·후원한 크리에이터의 라이브를 볼 수 있습니다')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
  expect(onLogin).toHaveBeenCalled();
  expect(screen.getByText('크리에이터5 시청')).toBeInTheDocument();
});

test('라이브가 없을 때·불러오는 중·기록이 없을 때 안내', () => {
  setup({ live: [], timeline: [] });
  expect(screen.getByText('지금 방송 중인 즐겨찾기·후원 크리에이터가 없습니다')).toBeInTheDocument();
  expect(screen.getByText('아직 활동 기록이 없습니다')).toBeInTheDocument();
});

test('라이브를 불러오는 중', () => {
  setup({ live: null });
  expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
});
