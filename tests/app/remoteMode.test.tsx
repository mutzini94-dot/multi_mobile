import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { CREATOR_REMOTE_URL, MODE_KEY, REMOTE_PARTITION } from '../../src/app/remoteMode';
import type { DesktopApi } from '../../src/desktop/desktopApi';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage, type KV } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function setup(kv: KV = quadKv(), desktop: DesktopApi | null = null) {
  const request = vi.fn(async () => {
    throw new Error('NOT_LOGGED_IN');
  });
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const r = render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={desktop} quickPollMs={600000} />);
  return { kv, ...r };
}
const switcher = () => screen.getByRole('radiogroup', { name: '리모컨 전환' });

test('상단 스위치: 후원 리모컨(기본) ↔ 크리에이터 리모컨', () => {
  setup();
  const sw = switcher();
  expect(within(sw).getAllByRole('radio').map((r) => r.textContent)).toEqual(['크리에이터 리모컨', '후원 리모컨']);
  expect(within(sw).getByRole('radio', { name: '후원 리모컨' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.queryByTitle('크리에이터 리모컨')).toBeNull(); // 처음 바꿀 때 불러온다
  expect(document.querySelectorAll('.tile')).toHaveLength(4);
});

test('크리에이터 리모컨으로 바꾸면 리모컨을 띄우고 멀티뷰 메뉴·칸·퀵패널은 숨긴다, 다시 바꾸면 그대로 돌아온다', () => {
  setup();
  fireEvent.click(within(switcher()).getByRole('radio', { name: '크리에이터 리모컨' }));
  const frame = screen.getByTitle('크리에이터 리모컨') as HTMLIFrameElement;
  expect(frame.getAttribute('src')).toBe(CREATOR_REMOTE_URL);
  expect(document.querySelector('.app')!.className).toMatch(/app--creator/);
  expect(screen.queryByRole('button', { name: '추천 라이브' })).toBeNull();
  expect(screen.queryByRole('complementary', { name: '퀵패널' })).toBeNull();
  fireEvent.click(within(switcher()).getByRole('radio', { name: '후원 리모컨' }));
  expect(document.querySelector('.app')!.className).not.toMatch(/app--creator/);
  expect(screen.getByRole('button', { name: '추천 라이브' })).toBeInTheDocument();
  expect(screen.getByTitle('크리에이터 리모컨')).toBeInTheDocument(); // 상태를 지키려고 띄운 채 숨긴다
});

test('고른 리모컨은 다음 실행에도 그대로', () => {
  const { kv, unmount } = setup();
  fireEvent.click(within(switcher()).getByRole('radio', { name: '크리에이터 리모컨' }));
  expect(kv.get(MODE_KEY)).toBe('creator');
  unmount();
  setup(kv);
  expect(within(switcher()).getByRole('radio', { name: '크리에이터 리모컨' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByTitle('크리에이터 리모컨')).toBeInTheDocument();
});

test('설치형: 크리에이터 리모컨은 자기 세션의 webview로 띄운다 (실시간 후원·위젯 분리 등 설치형 기능을 앱이 넣어 준다)', () => {
  const desktop = { onDonateClosed: () => () => {}, onDonateMode: () => () => {} } as unknown as DesktopApi;
  setup(quadKv(), desktop);
  fireEvent.click(within(switcher()).getByRole('radio', { name: '크리에이터 리모컨' }));
  const view = document.querySelector('.creator-remote webview')!;
  expect(view.getAttribute('src')).toBe(CREATOR_REMOTE_URL);
  expect(view.getAttribute('partition')).toBe(REMOTE_PARTITION);
  expect(document.querySelector('.creator-remote iframe')).toBeNull();
});
