import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { LAST_VIEW_KEY } from '../../src/app/lastView';
import type { DetachHost, HostToSolo, SoloToHost } from '../../src/detach/channel';
import type { SoloPayload } from '../../src/detach/soloLink';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

function fakeHost(openOk = true) {
  let onMsg: ((id: string, m: SoloToHost) => void) | null = null;
  let onClosed: ((id: string) => void) | null = null;
  const opened: { p: SoloPayload; title: string }[] = [];
  const posted: [string, HostToSolo][] = [];
  const host: DetachHost = {
    open: vi.fn((p, title) => {
      opened.push({ p, title });
      return openOk;
    }),
    close: vi.fn(),
    post: vi.fn((id, m) => posted.push([id, m])),
    onMessage: (cb) => ((onMsg = cb), () => (onMsg = null)),
    onClosed: (cb) => ((onClosed = cb), () => (onClosed = null)),
  };
  return {
    host,
    opened,
    posted,
    fromSolo: (id: string, m: SoloToHost) => act(() => onMsg?.(id, m)),
    closeSolo: (id: string) => act(() => onClosed?.(id)),
  };
}

function setup(openOk = true) {
  const kv = quadKv();
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  favorites.add(mkCreator(3, { name: 'C' }));
  const f = fakeHost(openOk);
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} detachHost={f.host} />);
  return { ...f, kv };
}

const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const detach = (slot: number) => fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '새 창으로 분리' }));

test('분리: 칸 내용을 새 창으로 열고, 원래 칸은 "분리됨"과 되돌리기·불러오기를 보여준다', () => {
  const { opened } = setup();
  pick(0, 'A'); // 넣은 칸이 선택(소리)된다
  detach(0);
  expect(opened).toHaveLength(1);
  expect(opened[0].p.item).toMatchObject({ name: 'A' });
  expect(opened[0].p.sound).toBe(true); // 소리 나던 칸은 분리 창에서도 소리
  expect(opened[0].title).toBe('A');
  const t = tiles()[0];
  expect(within(t).getByText('A · 새 창으로 분리됨')).toBeInTheDocument();
  expect(within(t).getByRole('button', { name: '되돌리기' })).toBeInTheDocument();
  expect(within(t).getByRole('button', { name: '불러오기' })).toBeInTheDocument();
  expect(screen.queryAllByTestId('player')).toHaveLength(0); // 메인 화면에서는 재생하지 않는다
  expect(t).not.toHaveClass('tile--selected');
});

test('되돌리기(칸 버튼): 분리 창을 닫고 원래 칸으로', () => {
  const { opened, host } = setup();
  pick(1, 'B');
  detach(1);
  fireEvent.click(within(tiles()[1]).getByRole('button', { name: '되돌리기' }));
  expect(host.close).toHaveBeenCalledWith(opened[0].p.id);
  expect(within(tiles()[1]).getByText('B')).toBeInTheDocument();
  expect(screen.getAllByTestId('player')).toHaveLength(1);
});

test('분리 창에서 되돌리기를 누르거나 창을 닫으면 원래 칸으로', () => {
  const { opened, fromSolo, closeSolo } = setup();
  pick(0, 'A');
  pick(1, 'B');
  detach(0);
  detach(1);
  fromSolo(opened[0].p.id, { type: 'return' });
  expect(within(tiles()[0]).getByText('A')).toBeInTheDocument();
  closeSolo(opened[1].p.id);
  expect(within(tiles()[1]).getByText('B')).toBeInTheDocument();
});

test('분리한 칸에 다른 방송을 넣으면 분리 창은 따로 남고, 닫으면 사라진다', () => {
  const { opened, closeSolo } = setup();
  pick(0, 'A');
  detach(0);
  pick(0, 'C');
  expect(within(tiles()[0]).getByText('C')).toBeInTheDocument();
  closeSolo(opened[0].p.id);
  expect(within(tiles()[0]).getByText('C')).toBeInTheDocument();
  expect(within(document.querySelector<HTMLElement>('.stage')!).queryByText('A')).toBeNull(); // 칸에서 (퀵패널의 프로필 글자는 빼고)
});

test('원래 칸이 다른 방송으로 바뀐 뒤 분리 창에서 되돌리기: 빈 칸으로, 빈 칸이 없으면 알려준다', () => {
  const { opened, fromSolo } = setup();
  pick(0, 'A');
  detach(0);
  pick(0, 'C');
  fromSolo(opened[0].p.id, { type: 'return' });
  expect(within(tiles()[1]).getByText('A')).toBeInTheDocument(); // 첫 빈 칸
  // 꽉 찬 상태
  pick(2, 'B');
  pick(3, 'C');
  detach(1); // A 다시 분리
  pick(1, 'B');
  fromSolo(opened[1].p.id, { type: 'return' });
  expect(screen.getByText('빈 칸이 없어 되돌릴 수 없습니다. 칸을 비운 뒤 다시 눌러 주세요')).toBeInTheDocument();
});

test('분리 창의 후원하기: 그 방송 크리에이터에게 후원', () => {
  const { opened, fromSolo } = setup();
  pick(0, 'A');
  detach(0);
  fromSolo(opened[0].p.id, { type: 'donate' });
  // 웹: 첫 후원 확인 없이(직접 추가) 후원 팝업
  expect(screen.queryByText(/팝업이 차단/)).toBeInTheDocument(); // 테스트 win.open은 null을 돌려준다 → 차단 안내
});

test('분리한 후원 페이지 창에는 따라갈 크리에이터를 계속 알려준다', () => {
  const { opened, posted } = setup();
  pick(0, 'A');
  pick(1, 'B');
  fireEvent.click(within(tiles()[2]).getByRole('button', { name: '불러오기' }));
  const dlg = screen.getByRole('dialog', { name: '불러오기' });
  fireEvent.click(within(dlg).getByRole('tab', { name: '후원 페이지' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '후원 페이지 칸 넣기' }));
  detach(2);
  expect(opened[0].p.donateFor).toMatchObject({ name: 'B' });
  fireEvent.click(tiles()[0].querySelector('.tile__bar')!); // A 선택
  expect(posted.at(-1)).toEqual([opened[0].p.id, { type: 'donateFor', creator: expect.objectContaining({ name: 'A' }), videoId: null }]);
});

test('팝업이 막히면 분리하지 않고 알려준다', () => {
  const { opened } = setup(false);
  pick(0, 'A');
  detach(0);
  expect(opened).toHaveLength(1);
  expect(within(tiles()[0]).getByText('A')).toBeInTheDocument();
  expect(screen.getByText('새 창을 열지 못했습니다. 팝업을 허용해 주세요')).toBeInTheDocument();
});

test('마지막 화면 저장: 분리한 칸은 원래 내용으로 저장 (다음 실행에서는 칸 안에)', () => {
  const { kv } = setup();
  pick(0, 'A');
  detach(0);
  expect(JSON.parse(kv.get(LAST_VIEW_KEY)!).slots[0]).toMatchObject({ name: 'A' });
});
