import { render } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { ONBOARDED_KEY } from '../../src/ui/Onboarding';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function mockPhone(matches: boolean) {
  window.matchMedia = ((q: string) => ({ matches: matches && q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

function setup() {
  const kv = safeStorage(undefined);
  kv.set(ONBOARDED_KEY, '1');
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={noBridge} desktop={null} />);
}

test('휴대폰 폭이면 칸을 세로로 쌓는 배치, 앱에 phone 표시', () => {
  mockPhone(true);
  setup();
  expect(document.querySelector('.tile-grid')!.className).toMatch(/tile-grid--phone/);
  expect(document.querySelector('.app')!.className).toMatch(/app--phone/);
});

test('넓은 화면이면 지금처럼 나누기 손잡이가 있는 배치', () => {
  mockPhone(false);
  setup();
  expect(document.querySelector('.tile-grid')!.className).not.toMatch(/tile-grid--phone/);
  expect(document.querySelector('.resize-handle')).not.toBeNull();
});
