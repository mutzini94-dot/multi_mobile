import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { BACKUP_KEYS, exportBackup, importBackup } from '../../src/app/backup';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';
import { localFavorites } from '../../src/favorites/favorites';
import { SETTINGS_KEY } from '../../src/settings/settings';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

describe('backup', () => {
  test('설정·즐겨찾기·화면 구성 등을 파일 하나로, 다른 PC에서 그대로 되살린다', () => {
    const a = safeStorage(undefined);
    a.set(SETTINGS_KEY, JSON.stringify({ theme: 'dark', quickMessages: ['파이팅'] }));
    localFavorites(a).add(mkCreator(1, { name: 'A' }));
    a.set('mv.presets.v1', JSON.stringify([]));
    a.set('mv.unrelated', 'x');
    const text = exportBackup(a, 1700000000000);
    const raw = JSON.parse(text);
    expect(raw).toMatchObject({ app: 'multiview-donate', v: 1, savedAt: 1700000000000 });
    expect(Object.keys(raw.data).every((k) => BACKUP_KEYS.includes(k))).toBe(true);

    const b = safeStorage(undefined);
    expect(importBackup(b, text)).toEqual({ ok: true, value: 3 });
    expect(JSON.parse(b.get(SETTINGS_KEY)!).theme).toBe('dark');
    expect(localFavorites(b).list().map((c) => c.name)).toEqual(['A']);
    expect(b.get('mv.unrelated')).toBeNull();
  });

  test('다른 파일·깨진 값은 거부하고 아무것도 바꾸지 않는다', () => {
    const kv = safeStorage(undefined);
    kv.set(SETTINGS_KEY, '{"theme":"light"}');
    expect(importBackup(kv, 'not json').ok).toBe(false);
    expect(importBackup(kv, JSON.stringify({ app: 'other', v: 1, data: {} })).ok).toBe(false);
    expect(importBackup(kv, JSON.stringify({ app: 'multiview-donate', v: 1, data: { [SETTINGS_KEY]: '{broken' } })).ok).toBe(false);
    expect(importBackup(kv, JSON.stringify({ app: 'multiview-donate', v: 1, data: { 'mv.evil': '1' } })).ok).toBe(false);
    expect(kv.get(SETTINGS_KEY)).toBe('{"theme":"light"}');
  });
});

function setup(kv = safeStorage(undefined)) {
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  const reload = vi.fn();
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/', reload } as unknown as Location, navigator: {} as Navigator };
  render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { kv, reload };
}

test('설정 창: 백업 파일을 불러오면 저장하고 화면을 다시 읽는다', async () => {
  const { kv, reload } = setup();
  const src = safeStorage(undefined);
  src.set(SETTINGS_KEY, JSON.stringify({ theme: 'dark' }));
  const file = new File([exportBackup(src)], 'multiview-backup.json', { type: 'application/json' });
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  const dlg = screen.getByRole('dialog', { name: '설정' });
  await act(async () => {
    fireEvent.change(within(dlg).getByLabelText('백업 불러오기'), { target: { files: [file] } });
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(JSON.parse(kv.get(SETTINGS_KEY)!).theme).toBe('dark');
  expect(reload).toHaveBeenCalled();
});

test('첫 실행 안내: 처음에만 보이고, 넘겨 보거나 닫으면 다시 나오지 않는다', () => {
  const kv = safeStorage(undefined);
  setup(kv);
  const guide = screen.getByRole('region', { name: '처음 사용 안내' });
  expect(within(guide).getByText('1 / 4')).toBeInTheDocument();
  fireEvent.click(within(guide).getByRole('button', { name: '다음' }));
  expect(within(guide).getByText('2 / 4')).toBeInTheDocument();
  fireEvent.click(within(guide).getByRole('button', { name: '안내 닫기' }));
  expect(screen.queryByRole('region', { name: '처음 사용 안내' })).toBeNull();
  expect(kv.get(ONBOARDED_KEY)).toBe('1');
});

test('첫 실행 안내: 이미 봤으면 나오지 않고, 설정에서 다시 볼 수 있다', () => {
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  setup(kv);
  expect(screen.queryByRole('region', { name: '처음 사용 안내' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '설정' })).getByRole('button', { name: '사용 안내 다시 보기' }));
  expect(screen.getByRole('region', { name: '처음 사용 안내' })).toBeInTheDocument();
});
