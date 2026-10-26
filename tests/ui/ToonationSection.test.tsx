import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToonationSection } from '../../src/ui/ToonationSection';
import type { ToonationState } from '../../src/toonation/useToonation';
import { mkCreator } from '../helpers/fixtures';

const noop = () => {};
const props = (state: Partial<ToonationState>) => ({
  state: { status: 'idle', account: null, creators: [], ...state } as ToonationState,
  onLogin: noop,
  onRefresh: noop,
  onPick: noop,
});

test('확장이 없으면 설치 안내', () => {
  render(<ToonationSection {...props({ status: 'no-extension' })} />);
  expect(screen.getByText(/연동 확장을 설치하면 투네이션 즐겨찾기를 불러올 수 있습니다/)).toBeInTheDocument();
});

test('로그인 전이면 투네이션 로그인 버튼', async () => {
  const onLogin = vi.fn();
  render(<ToonationSection {...props({ status: 'logged-out' })} onLogin={onLogin} />);
  await userEvent.click(screen.getByRole('button', { name: '투네이션 로그인' }));
  expect(onLogin).toHaveBeenCalled();
});

test('로그인 대기 중 안내', () => {
  render(<ToonationSection {...props({ status: 'waiting-login' })} />);
  expect(screen.getByText(/로그인 창에서 로그인을 마치면 목록이 나타납니다/)).toBeInTheDocument();
});

test('목록: 계정 이름, 크리에이터·플랫폼 버튼, 클릭 시 onPick', async () => {
  const onPick = vi.fn();
  const c = mkCreator(1, { source: 'toonation', name: 'A', profile: 'https://img/a.png' });
  render(<ToonationSection {...props({ status: 'ready', account: { name: '나' }, creators: [c] })} onPick={onPick} />);
  expect(screen.getByText('나 님의 즐겨찾기')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /^A · Twitch/ }));
  expect(onPick).toHaveBeenCalledWith(c);
});

test('목록이 비면 안내', () => {
  render(<ToonationSection {...props({ status: 'ready', account: { name: '나' }, creators: [] })} />);
  expect(screen.getByText(/유튜브·트위치 채널이 연결된 즐겨찾기가 없습니다/)).toBeInTheDocument();
});

test('오류면 메시지와 다시 시도', async () => {
  const onRefresh = vi.fn();
  render(<ToonationSection {...props({ status: 'error', error: 'HTTP 500' })} onRefresh={onRefresh} />);
  expect(screen.getByText(/즐겨찾기를 불러오지 못했습니다 \(HTTP 500\)/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(onRefresh).toHaveBeenCalled();
});
