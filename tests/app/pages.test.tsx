import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { DesktopApi } from '../../src/desktop/desktopApi';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { LiveQuery, LivePage } from '../../src/toonation/liveList';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function desktopApi(): DesktopApi {
  return {
    status: vi.fn().mockResolvedValue({ ok: true, data: { account: null } }),
    login: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    logout: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    favorites: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    openDonate: vi.fn(),
    closeDonate: vi.fn(),
    setDonateBounds: vi.fn(),
    setDonateMode: vi.fn(),
    fillDonate: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    onDonateClosed: vi.fn(() => () => {}),
    onDonateMode: vi.fn(() => () => {}),
  };
}

const livePage: LivePage = {
  items: [
    { creator: { ...mkCreator(7, { name: '라이브칠', donateId: 'live7', source: 'toonation' }), live: { title: '저녁 방송', viewers: 1234 } }, thumbnail: 'https://img/t.jpg', category: '게임' },
  ],
  page: 1,
  totalPages: 1,
  total: 1,
};

function setup({ desktop = null as DesktopApi | null, lives = vi.fn(async (_q: LiveQuery) => livePage) } = {}) {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={desktop ? undefined : noBridge} desktop={desktop} lives={lives} />);
  return { win, lives };
}

const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const openPicker = (slot: number) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  return screen.getByRole('dialog', { name: '불러오기' });
};
const pickFav = (slot: number, name: string) => {
  const dlg = openPicker(slot);
  fireEvent.click(within(dlg).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const addDonatePage = (slot: number) => {
  const dlg = openPicker(slot);
  fireEvent.click(within(dlg).getByRole('tab', { name: '후원 페이지' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '후원 페이지 창 넣기' }));
};
const openUrl = (slot: number, url: string) => {
  const dlg = openPicker(slot);
  fireEvent.click(within(dlg).getByRole('tab', { name: '웹페이지' }));
  fireEvent.change(within(dlg).getByLabelText('웹 주소'), { target: { value: url } });
  fireEvent.click(within(dlg).getByRole('button', { name: '열기' }));
};
const webviews = () => [...document.querySelectorAll('webview')];

test('불러오기 창: 방송·투네이션 라이브·후원 페이지·웹페이지 탭', () => {
  setup();
  const dlg = openPicker(0);
  expect(within(dlg).getAllByRole('tab').map((t) => t.textContent)).toEqual(['방송', '투네이션 라이브', '활동 위젯', '후원 페이지', '시그니처', '채팅', '웹페이지']);
});

test('웹페이지: 주소를 넣으면 그 창에 사이트가 열린다 (웹은 iframe)', () => {
  setup();
  openUrl(1, 'naver.com');
  expect(within(tiles()[1]).getByText('naver.com')).toBeInTheDocument();
  const frame = document.querySelector<HTMLIFrameElement>('.player-layer iframe[title="naver.com"]');
  expect(frame?.getAttribute('src')).toBe('https://naver.com/');
});

test('웹페이지: 잘못된 주소는 알려주고 넣지 않는다, 바로가기 버튼', () => {
  setup();
  const dlg = openPicker(0);
  fireEvent.click(within(dlg).getByRole('tab', { name: '웹페이지' }));
  fireEvent.change(within(dlg).getByLabelText('웹 주소'), { target: { value: 'javascript:alert(1)' } });
  fireEvent.click(within(dlg).getByRole('button', { name: '열기' }));
  expect(within(dlg).getByText(/웹 주소만 열 수 있습니다/)).toBeInTheDocument();
  fireEvent.click(within(dlg).getByRole('button', { name: '네이버' }));
  expect(within(tiles()[0]).getByText('naver.com')).toBeInTheDocument();
});

test('설치형: 웹페이지는 창 안 브라우저(webview)로, 후원 페이지는 투네이션 로그인 세션으로 연다', () => {
  setup({ desktop: desktopApi() });
  pickFav(0, 'A');
  openUrl(1, 'https://www.youtube.com/');
  addDonatePage(2);
  const [web, donate] = [webviews().find((w) => w.getAttribute('partition') === 'persist:mvweb'), webviews().find((w) => w.getAttribute('partition') === 'persist:toonation')];
  expect(web?.getAttribute('src')).toBe('https://www.youtube.com/');
  expect(donate?.getAttribute('src')).toBe('https://toon.at/donate/don1');
  // 후원 페이지는 화면 폭으로 PC판·모바일판을 고르므로, 창 크기에 맞춰 키우는 틀 안에서 모바일판으로 (mobileFit)
  expect(donate).toHaveClass('page-view--mobile');
  expect(donate?.parentElement).toHaveClass('page-view-fit');
  expect(web).not.toHaveClass('page-view--mobile');
});

test('후원 페이지 창은 선택한 방송 크리에이터를 따라간다', () => {
  setup({ desktop: desktopApi() });
  pickFav(0, 'A');
  pickFav(1, 'B'); // 넣은 창이 선택된다
  addDonatePage(2);
  const donate = () => webviews().find((w) => w.getAttribute('partition') === 'persist:toonation')!;
  expect(donate().getAttribute('src')).toBe('https://toon.at/donate/don2');
  expect(within(tiles()[2]).getByText('B 후원 페이지')).toBeInTheDocument();
  fireEvent.click(tiles()[0].querySelector('.tile__bar')!); // A 선택
  expect(donate().getAttribute('src')).toBe('https://toon.at/donate/don1');
  // 후원 페이지 창을 눌러도 선택(소리)은 A 그대로
  fireEvent.click(tiles()[2].querySelector('.tile__bar')!);
  expect(tiles()[0]).toHaveClass('tile--selected');
  expect(tiles()[2]).not.toHaveClass('tile--selected');
});

test('웹: 후원 페이지 창은 창 안에 띄울 수 없어 새 창으로 여는 버튼을 보여준다', () => {
  const { win } = setup();
  pickFav(0, 'A');
  addDonatePage(1);
  fireEvent.click(screen.getByRole('button', { name: '새 창으로 후원 페이지 열기' }));
  expect(win.open).toHaveBeenCalledWith(expect.stringContaining('toon.at/donate/don1'), expect.anything(), expect.anything());
});

test('후원 페이지 창: 방송이 없으면 안내', () => {
  setup({ desktop: desktopApi() });
  addDonatePage(0);
  expect(screen.getByText('후원할 방송 창을 선택하세요')).toBeInTheDocument();
});

test('투네이션 라이브: 목록에서 고르면 방송이 창에 들어가고 후원 대상이 된다', async () => {
  const { lives } = setup();
  const dlg = openPicker(0);
  fireEvent.click(within(dlg).getByRole('tab', { name: '투네이션 라이브' }));
  const item = await within(dlg).findByRole('button', { name: /라이브칠/ });
  expect(lives).toHaveBeenCalledWith(expect.objectContaining({ page: 1, order: 'VIEWERS' }));
  expect(within(item).getByText('저녁 방송')).toBeInTheDocument();
  fireEvent.click(item);
  expect(within(tiles()[0]).getByText('라이브칠')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '후원하기' })).toBeEnabled();
});

test('투네이션 라이브: 검색어로 다시 불러온다', async () => {
  const { lives } = setup();
  const dlg = openPicker(0);
  fireEvent.click(within(dlg).getByRole('tab', { name: '투네이션 라이브' }));
  await within(dlg).findByRole('button', { name: /라이브칠/ });
  fireEvent.change(within(dlg).getByLabelText('라이브 검색'), { target: { value: '칠' } });
  await act(async () => {
    fireEvent.submit(within(dlg).getByLabelText('라이브 검색').closest('form')!);
  });
  expect(lives).toHaveBeenLastCalledWith(expect.objectContaining({ q: '칠', page: 1 }));
});

test('투네이션 라이브: 불러오지 못하면 알려준다', async () => {
  setup({ lives: vi.fn(async () => Promise.reject(new Error('HTTP 500'))) });
  const dlg = openPicker(0);
  fireEvent.click(within(dlg).getByRole('tab', { name: '투네이션 라이브' }));
  expect(await within(dlg).findByText(/라이브 목록을 불러오지 못했습니다/)).toBeInTheDocument();
});
