import { fireEvent, render, screen, within } from '@testing-library/react';
import { SignatureView } from '../../src/ui/SignatureView';
import type { Signature } from '../../src/toonation/signatures';
import { mkCreator } from '../helpers/fixtures';

const sigs: Signature[] = [
  { hash: 'a', name: '슈퍼맨', cash: 20000, count: 88, image: 'https://img/a_thumb.img' },
  { hash: 'b', name: '딱밤', cash: 5000, count: 3, image: null },
  { hash: 'c', name: '가나다', cash: 12345, count: 10, image: null },
];
const creator = mkCreator(1, { name: '투깝이', donateId: 'tjd' });

function setup(load = vi.fn(async () => sigs), c: typeof creator | null = creator) {
  const r = render(<SignatureView creator={c} load={load} />);
  return { load, ...r };
}
const names = () => within(screen.getByRole('list', { name: '시그니처 목록' })).getAllByRole('listitem').map((li) => li.querySelector('.signature-card__name')?.textContent);

test('선택한 방송 크리에이터의 시그니처를 불러와 인기순으로 보여 준다', async () => {
  const { load } = setup();
  expect(load).toHaveBeenCalledWith('tjd');
  expect(await screen.findByText('투깝이 시그니처 · 3개')).toBeInTheDocument();
  expect(names()).toEqual(['슈퍼맨', '가나다', '딱밤']);
  const first = within(screen.getByRole('list', { name: '시그니처 목록' })).getAllByRole('listitem')[0];
  expect(within(first).getByText('20,000캐시')).toBeInTheDocument();
  expect(within(first).getByText('88회')).toBeInTheDocument();
  expect(first.querySelector('img')?.getAttribute('src')).toBe('https://img/a_thumb.img');
});

test('정렬 바꾸기', async () => {
  setup();
  await screen.findByText('투깝이 시그니처 · 3개');
  fireEvent.change(screen.getByLabelText('시그니처 정렬'), { target: { value: 'cashAsc' } });
  expect(names()).toEqual(['딱밤', '가나다', '슈퍼맨']);
  fireEvent.change(screen.getByLabelText('시그니처 정렬'), { target: { value: 'name' } });
  expect(names()).toEqual(['가나다', '딱밤', '슈퍼맨']);
});

test('검색: 이름·금액, 결과가 없으면 안내', async () => {
  setup();
  await screen.findByText('투깝이 시그니처 · 3개');
  fireEvent.change(screen.getByLabelText('시그니처 검색'), { target: { value: '딱' } });
  expect(names()).toEqual(['딱밤']);
  fireEvent.change(screen.getByLabelText('시그니처 검색'), { target: { value: '12,345' } });
  expect(names()).toEqual(['가나다']);
  fireEvent.change(screen.getByLabelText('시그니처 검색'), { target: { value: '없는이름' } });
  expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
});

test('방송 칸이 없으면 안내, 시그니처가 없으면 안내', async () => {
  const { rerender } = setup(vi.fn(async () => []), null);
  expect(screen.getByText('시그니처를 볼 방송 칸을 선택하세요')).toBeInTheDocument();
  rerender(<SignatureView creator={creator} load={vi.fn(async () => [])} />);
  expect(await screen.findByText('등록된 시그니처가 없습니다')).toBeInTheDocument();
});

test('불러오지 못하면 다시 시도', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(sigs);
  setup(load);
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('투깝이 시그니처 · 3개')).toBeInTheDocument();
});

test('다른 크리에이터를 선택하면 그 크리에이터의 시그니처로 바뀐다 (검색어는 비운다)', async () => {
  const load = vi.fn(async (tag: string) => (tag === 'tjd' ? sigs : [{ hash: 'z', name: '다른시그', cash: 1000, count: 0, image: null }]));
  const { rerender } = setup(load);
  await screen.findByText('투깝이 시그니처 · 3개');
  fireEvent.change(screen.getByLabelText('시그니처 검색'), { target: { value: '슈퍼' } });
  rerender(<SignatureView creator={mkCreator(2, { name: '둘', donateId: 'two' })} load={load} />);
  expect(await screen.findByText('둘 시그니처 · 1개')).toBeInTheDocument();
  expect(screen.getByLabelText('시그니처 검색')).toHaveValue('');
});
