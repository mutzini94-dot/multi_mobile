import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { FavoritesPicker } from '../../src/ui/FavoritesPicker';
import { mkCreator } from '../helpers/fixtures';

const source = () => localFavorites(safeStorage(undefined));

test('불러오기: 방송 주소를 붙여넣으면 투네이션에 등록된 방송을 바로 넣는다', async () => {
  const onPick = vi.fn();
  const found = mkCreator(7, { name: 'Z' });
  render(<FavoritesPicker source={source()} onPick={onPick} onClose={() => {}} findLink={async () => found} />);
  fireEvent.change(screen.getByLabelText('방송 주소로 바로 넣기'), { target: { value: 'https://www.twitch.tv/chan_7' } });
  fireEvent.click(screen.getByRole('button', { name: '넣기' }));
  await waitFor(() => expect(onPick).toHaveBeenCalledWith(found));
});

test('불러오기: 찾지 못한 트위치 주소는 직접 추가 양식에 채널을 채워 둔다 (후원 아이디는 짐작하지 않음)', async () => {
  render(<FavoritesPicker source={source()} onPick={() => {}} onClose={() => {}} compact findLink={async () => null} />);
  expect(screen.queryByLabelText('채널')).toBeNull(); // 휴대폰: 양식은 접혀 있다
  fireEvent.change(screen.getByLabelText('방송 주소로 바로 넣기'), { target: { value: 'twitch.tv/abc_def' } });
  fireEvent.change(screen.getByLabelText('방송 주소로 바로 넣기'), { target: { value: 'https://twitch.tv/abc_def' } });
  fireEvent.click(screen.getByRole('button', { name: '넣기' }));
  await waitFor(() => expect((screen.getByLabelText('채널') as HTMLInputElement).value).toBe('abc_def'));
  expect((screen.getByLabelText('투네이션 후원 아이디') as HTMLInputElement).value).toBe('');
  expect(screen.getByRole('status').textContent).toContain('후원 아이디');
});
