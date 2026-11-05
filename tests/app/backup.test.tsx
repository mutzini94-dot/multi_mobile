import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { BACKUP_KEYS, describeBackup, exportBackup, importBackup } from '../../src/app/backup';
import { ONBOARDED_KEY, TOUR_STEPS } from '../../src/ui/Onboarding';
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
    expect(importBackup(b, text)).toEqual({ ok: true, value: { count: 3, desktop: null } });
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
  // 되살리기 전에 무엇이 들어 있는지 보여 주고 확인을 받는다
  const confirm = screen.getByRole('dialog', { name: '백업 불러오기' });
  expect(within(confirm).getByText('설정', { selector: 'dt' })).toBeInTheDocument();
  expect(kv.get(SETTINGS_KEY)).toBeNull();
  expect(reload).not.toHaveBeenCalled();
  fireEvent.click(within(confirm).getByRole('button', { name: '불러오기' }));
  expect(JSON.parse(kv.get(SETTINGS_KEY)!).theme).toBe('dark');
  expect(reload).toHaveBeenCalled();
});

test('백업 강화: 리모컨 모드·추천 라이브 창 크기·최근 본 방송도 담고, 빈 값은 건너뛴다', () => {
  const a = safeStorage(undefined);
  a.set('mv.mode.v1', 'creator');
  a.set('mv.shortsWidth.v1', '520');
  a.set('mv.shortsHeight.v1', ''); // 기본 크기로 되돌린 값
  a.set('mv.watchLog.v1', JSON.stringify([{ at: 1, creator: mkCreator(1) }]));
  localFavorites(a).add(mkCreator(2, { name: 'B' }));
  a.set('mv.presets.v1', JSON.stringify([{ id: 'p1' }, { id: 'p2' }]));
  const text = exportBackup(a, 1700000000000, { windowBounds: { x: 0, y: 0, width: 1200, height: 800 } });
  const raw = JSON.parse(text);
  expect(raw.data['mv.shortsHeight.v1']).toBeUndefined();
  expect(raw.desktop).toEqual({ windowBounds: { x: 0, y: 0, width: 1200, height: 800 } });

  const d = describeBackup(text);
  expect(d.ok && d.value).toMatchObject({ savedAt: 1700000000000, favorites: 1, presets: 2, recent: 1, settings: false, windows: true });

  const b = safeStorage(undefined);
  const r = importBackup(b, text);
  expect(r.ok).toBe(true);
  expect(b.get('mv.mode.v1')).toBe('creator');
  expect(b.get('mv.shortsWidth.v1')).toBe('520');
  expect(r.ok && r.value.desktop).toEqual({ windowBounds: { x: 0, y: 0, width: 1200, height: 800 } });
  // 틀린 모양의 값은 거부
  const bad = JSON.stringify({ ...raw, data: { ...raw.data, 'mv.mode.v1': 'hacker' } });
  expect(importBackup(safeStorage(undefined), bad).ok).toBe(false);
});

test('첫 실행 둘러보기: 실제 메뉴를 하나씩 비추며 안내하고, 닫으면 다시 나오지 않는다', () => {
  const kv = safeStorage(undefined);
  setup(kv);
  const guide = screen.getByRole('region', { name: '처음 사용 안내' });
  const n = TOUR_STEPS.length;
  expect(n).toBeGreaterThanOrEqual(7);
  expect(within(guide).getByText(`1 / ${n}`)).toBeInTheDocument();
  expect(within(guide).getByText(TOUR_STEPS[0].title)).toBeInTheDocument();
  // 비추는 메뉴가 화면에 있으면 그 자리를 강조한다
  expect(document.querySelector(TOUR_STEPS[0].target)).not.toBeNull();
  expect(document.querySelector('.tour__spot')).not.toBeNull();
  fireEvent.click(within(guide).getByRole('button', { name: '다음' }));
  expect(within(guide).getByText(`2 / ${n}`)).toBeInTheDocument();
  // 새 기능(퀵패널·창 추가·크리에이터 리모컨·도움말)을 안내한다
  const titles = TOUR_STEPS.map((t) => t.title).join(' ');
  for (const w of ['퀵패널', '창 추가', '크리에이터 리모컨', '도움말']) expect(titles).toMatch(w);
  for (let i = 2; i < n; i++) fireEvent.click(within(guide).getByRole('button', { name: '다음' }));
  expect(within(guide).getByRole('button', { name: '시작하기' })).toBeInTheDocument();
  fireEvent.click(within(guide).getByRole('button', { name: '이전' }));
  expect(within(guide).getByText(`${n - 1} / ${n}`)).toBeInTheDocument();
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
