import { act, render, screen } from '@testing-library/react';
import { Splash, SPLASH_MAX_MS, SPLASH_MIN_MS } from '../../src/ui/Splash';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  delete (document as unknown as { fonts?: unknown }).fonts;
});
const splash = () => screen.queryByRole('status', { name: '불러오는 중' });

test('시작 로딩 화면: 로고를 덮개가 걷히듯 보여 주고, 준비되면 바로 닫는다 (최소 잠깐은 보여 준다)', async () => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  render(<Splash />);
  expect(splash()!.querySelector('img.splash__logo')).not.toBeNull();
  expect(splash()!.querySelector('.splash__cover')).not.toBeNull();
  expect(SPLASH_MIN_MS).toBeLessThan(1000);
  await act(async () => vi.advanceTimersByTime(SPLASH_MIN_MS - 100));
  expect(splash()).not.toBeNull(); // 준비됐어도 최소 시간은 보여 준다
  await act(async () => vi.advanceTimersByTime(600)); // 최소 시간 + 흐려지기
  expect(splash()).toBeNull();
});

test('글꼴이 늦어도 최대 시간 뒤에는 닫는다', async () => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise(() => {}) } });
  render(<Splash />);
  await act(async () => vi.advanceTimersByTime(SPLASH_MAX_MS - 400));
  expect(splash()).not.toBeNull();
  await act(async () => vi.advanceTimersByTime(800));
  expect(splash()).toBeNull();
});
