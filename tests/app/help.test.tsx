import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { SETTINGS_KEY } from '../../src/settings/settings';
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
  render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { kv, win };
}
const keysDialog = () => screen.queryByRole('dialog', { name: '단축키' });

test('? 키를 누르면 단축키 안내, Esc나 닫기로 닫는다', () => {
  setup();
  fireEvent.keyDown(window, { key: '?' });
  const dlg = keysDialog()!;
  for (const k of ['1 ~ 9', 'M', 'F', 'D', 'Esc', '?']) expect(within(dlg).getByText(k)).toBeInTheDocument();
  expect(within(dlg).getByText(/^칸 선택/)).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(keysDialog()).toBeNull();
  fireEvent.keyDown(window, { key: '?' });
  fireEvent.click(within(keysDialog()!).getByRole('button', { name: '닫기' }));
  expect(keysDialog()).toBeNull();
});

test('입력 중에는 ?를 눌러도 열리지 않는다, 단축키를 끈 상태면 안내에 알려 준다', () => {
  setup({ shortcuts: false });
  const input = document.createElement('input');
  document.body.appendChild(input);
  fireEvent.keyDown(input, { key: '?' });
  expect(keysDialog()).toBeNull();
  input.remove();
  fireEvent.keyDown(window, { key: '?' });
  expect(within(keysDialog()!).getByText(/단축키가 꺼져 있습니다/)).toBeInTheDocument();
});

test('상단 도움말: 자주 묻는 질문을 펼쳐 보고, 단축키·둘러보기를 연다', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '도움말' }));
  const help = screen.getByRole('dialog', { name: '도움말' });
  const faq = within(help).getByRole('list', { name: '자주 묻는 질문' });
  expect(within(faq).getAllByRole('listitem').length).toBeGreaterThanOrEqual(6);
  expect(within(faq).getByText('트위치 방송이 자동으로 재생되지 않아요')).toBeInTheDocument();
  fireEvent.click(within(help).getByRole('button', { name: '단축키 보기' }));
  expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull();
  expect(keysDialog()).not.toBeNull();
  fireEvent.click(within(keysDialog()!).getByRole('button', { name: '닫기' }));
  fireEvent.click(screen.getByRole('button', { name: '도움말' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '도움말' })).getByRole('button', { name: '둘러보기 다시 보기' }));
  expect(screen.getByRole('region', { name: '처음 사용 안내' })).toBeInTheDocument();
});
