import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';

let broken = true;
function Flaky() {
  if (broken) throw new Error('boom');
  return <p>앱 화면</p>;
}

beforeEach(() => {
  broken = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

test('그리다 오류가 나면 까만 화면 대신 안내와 복구 버튼을 보여 준다', () => {
  render(
    <ErrorBoundary>
      <Flaky />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('화면을 그리는 중 오류가 났습니다');
  expect(screen.getByRole('button', { name: '다시 그리기' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
});

test('다시 그리기: 오류가 사라졌으면 앱 화면으로 돌아온다', () => {
  render(
    <ErrorBoundary>
      <Flaky />
    </ErrorBoundary>,
  );
  broken = false;
  fireEvent.click(screen.getByRole('button', { name: '다시 그리기' }));
  expect(screen.getByText('앱 화면')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('새로고침 버튼은 창을 다시 읽는다', () => {
  const reload = vi.fn();
  render(
    <ErrorBoundary onReload={reload}>
      <Flaky />
    </ErrorBoundary>,
  );
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  expect(reload).toHaveBeenCalled();
});
