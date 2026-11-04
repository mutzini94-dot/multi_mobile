import { act, render, screen } from '@testing-library/react';
import { Splash, SPLASH_MS } from '../../src/ui/Splash';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('시작 로딩 화면: 투네이션 로고를 덮개가 걷히듯 보여 주고, 잠시 뒤 사라진다', () => {
  render(<Splash />);
  const splash = screen.getByRole('status', { name: '불러오는 중' });
  expect(splash.querySelector('img.splash__logo')).not.toBeNull();
  expect(splash.querySelector('.splash__cover')).not.toBeNull();
  expect(SPLASH_MS).toBe(2500); // toonation.co.kr/main과 같이: 2초 뒤 0.5초 동안 흐려진다
  act(() => vi.advanceTimersByTime(SPLASH_MS - 100));
  expect(screen.getByRole('status', { name: '불러오는 중' })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(200));
  expect(screen.queryByRole('status', { name: '불러오는 중' })).toBeNull();
});
