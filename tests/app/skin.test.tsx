import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_KEY, SKINS } from '../../src/settings/settings';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup(settings?: object) {
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  if (settings) kv.set(SETTINGS_KEY, JSON.stringify(settings));
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const r = render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { kv, unmount: r.unmount };
}

afterEach(() => {
  delete document.documentElement.dataset.skin;
});

test('스킨: 기본·브리즈·퓨어, 기본값은 브리즈', () => {
  expect(SKINS.map((s) => s.label)).toEqual(['기본', '브리즈', '퓨어']);
  expect(DEFAULT_SETTINGS.skin).toBe('breeze');
  const kv = safeStorage(undefined);
  kv.set(SETTINGS_KEY, JSON.stringify({ skin: 'neon' }));
  expect(loadSettings(kv).skin).toBe('breeze');
});

test('상단 스킨 메뉴에서 기본을 고르면 바로 바뀌고 다음 실행에도 그대로', () => {
  const { kv, unmount } = setup();
  expect(document.documentElement.dataset.skin).toBe('breeze');
  fireEvent.click(screen.getByRole('button', { name: '스킨' }));
  const menu = screen.getByRole('menu', { name: '스킨' });
  expect(within(menu).getByRole('menuitem', { name: /브리즈/ })).toHaveTextContent('사용 중');
  fireEvent.click(within(menu).getByRole('menuitem', { name: /기본/ }));
  expect(document.documentElement.dataset.skin).toBe('classic');
  expect(loadSettings(kv).skin).toBe('classic');
  unmount();
  setup(JSON.parse(kv.get(SETTINGS_KEY)!));
  expect(document.documentElement.dataset.skin).toBe('classic');
});

test('설정 창 화면 항목에서도 스킨을 바꾼다', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  const dlg = screen.getByRole('dialog', { name: '설정' });
  fireEvent.change(within(dlg).getByLabelText('스킨'), { target: { value: 'classic' } });
  expect(document.documentElement.dataset.skin).toBe('classic');
});

test('퓨어 스킨을 고르면 바로 바뀐다', () => {
  const { kv } = setup();
  fireEvent.click(screen.getByRole('button', { name: '스킨' }));
  fireEvent.click(within(screen.getByRole('menu', { name: '스킨' })).getByRole('menuitem', { name: /퓨어/ }));
  expect(document.documentElement.dataset.skin).toBe('pure');
  expect(loadSettings(kv).skin).toBe('pure');
});
