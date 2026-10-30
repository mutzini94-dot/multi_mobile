import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { GROUPS_KEY, useFavoriteGroups } from '../../src/favorites/groups';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

describe('useFavoriteGroups', () => {
  test('그룹에 넣고 빼기, 새 이름이면 그룹이 생기고 저장된다', () => {
    const kv = safeStorage(undefined);
    const a = mkCreator(1);
    const { result } = renderHook(() => useFavoriteGroups(kv));
    act(() => result.current.assign(a, ' 게임 '));
    expect(result.current.names).toEqual(['게임']);
    expect(result.current.groupOf(a)).toBe('게임');
    expect(JSON.parse(kv.get(GROUPS_KEY)!)).toEqual({ names: ['게임'], of: { [`${a.key}|${a.donateId}`]: '게임' } });
    act(() => result.current.assign(a, null));
    expect(result.current.groupOf(a)).toBeUndefined();
    expect(result.current.names).toEqual(['게임']); // 빈 그룹도 남는다
  });

  test('그룹 지우기: 그 그룹에 있던 즐겨찾기는 그룹 없음으로', () => {
    const kv = safeStorage(undefined);
    const a = mkCreator(1);
    const { result } = renderHook(() => useFavoriteGroups(kv));
    act(() => result.current.assign(a, '주식'));
    act(() => result.current.remove('주식'));
    expect(result.current.names).toEqual([]);
    expect(result.current.groupOf(a)).toBeUndefined();
  });

  test('이름은 1~20자, 깨진 저장값은 무시', () => {
    const kv = safeStorage(undefined);
    kv.set(GROUPS_KEY, '{oops');
    const { result } = renderHook(() => useFavoriteGroups(kv));
    expect(result.current.names).toEqual([]);
    act(() => result.current.assign(mkCreator(1), 'x'.repeat(21)));
    expect(result.current.names).toEqual([]);
  });
});

test('불러오기 창: 그룹 편집으로 즐겨찾기를 그룹에 넣고, 그룹 칩으로 거른다', () => {
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  fireEvent.click(within(document.querySelectorAll<HTMLElement>('.tile')[0]).getByRole('button', { name: '불러오기' }));
  const dlg = screen.getByRole('dialog', { name: '불러오기' });
  fireEvent.click(within(dlg).getByRole('button', { name: '그룹 편집' }));
  fireEvent.change(within(dlg).getByLabelText('A 그룹'), { target: { value: '__new' } });
  fireEvent.change(within(dlg).getByLabelText('새 그룹 이름'), { target: { value: '게임' } });
  fireEvent.click(within(dlg).getByRole('button', { name: '그룹 만들기' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '그룹 편집 끝' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '그룹 게임' }));
  expect(within(dlg).getByRole('button', { name: /^A ·/ })).toBeInTheDocument();
  expect(within(dlg).queryByRole('button', { name: /^B ·/ })).toBeNull();
  fireEvent.click(within(dlg).getByRole('button', { name: '그룹 전체' }));
  expect(within(dlg).getByRole('button', { name: /^B ·/ })).toBeInTheDocument();
});
