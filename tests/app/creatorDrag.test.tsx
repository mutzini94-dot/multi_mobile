import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import { CREATOR_MIME, readCreatorDrag } from '../../src/app/creatorDrag';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { LivePage, LiveQuery, PopularLive } from '../../src/toonation/liveList';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const live7 = { ...mkCreator(7, { name: '라이브칠', donateId: 'live7', source: 'toonation' as const }), live: { title: '저녁 방송', viewers: 1234 } };
const livePage: LivePage = { items: [{ creator: live7, thumbnail: '', category: '' }], page: 1, totalPages: 1, total: 1 };
const popular: PopularLive = { groups: [], top: livePage.items };

/** jsdom에는 DataTransfer가 없어 흉내 낸다 */
function dataTransfer() {
  const data: Record<string, string> = {};
  return {
    data,
    get types() {
      return Object.keys(data);
    },
    setData: (t: string, v: string) => {
      data[t] = v;
    },
    getData: (t: string) => data[t] ?? '',
    effectAllowed: 'all',
    dropEffect: 'none',
  };
}

function setup() {
  const kv = safeStorage(undefined);
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A', donateId: 'tagA' }));
  const request = vi.fn(async (type: string) => {
    if (type === 'signatures') return [];
    throw new Error('NOT_LOGGED_IN');
  });
  const win = { open: vi.fn(() => ({ closed: false }) as Window), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(
    <App favorites={favorites} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} lives={vi.fn(async (_q: LiveQuery) => livePage)} popular={vi.fn(async () => popular)} quickPollMs={600000} />,
  );
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];

test('readCreatorDrag: 끌어 온 방송 정보를 확인한다 (잘못된 값은 버린다)', () => {
  const dt = dataTransfer();
  dt.setData(CREATOR_MIME, JSON.stringify(live7));
  expect(readCreatorDrag(dt as unknown as DataTransfer)).toMatchObject({ key: live7.key, name: '라이브칠', donateId: 'live7' });
  dt.setData(CREATOR_MIME, '{"platform":"x"}');
  expect(readCreatorDrag(dt as unknown as DataTransfer)).toBeNull();
});

test('추천 라이브 카드를 끌어 칸에 놓으면 그 칸에 들어가고 창은 닫힌다 (끄는 동안 창은 비켜 준다)', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '추천 라이브' }));
  const card = await within(screen.getByRole('dialog', { name: '추천 라이브' })).findByRole('button', { name: /라이브칠/ });
  const dt = dataTransfer();
  fireEvent.dragStart(card, { dataTransfer: dt });
  expect(await screen.findByRole('dialog', { name: '추천 라이브' })).toBeInTheDocument();
  expect(document.querySelector('.modal-backdrop--dragging')).not.toBeNull();
  expect(document.querySelector('.player-layer--dragging')).not.toBeNull();
  fireEvent.dragOver(tiles()[2], { dataTransfer: dt });
  expect(tiles()[2].className).toMatch(/tile--drop/);
  fireEvent.drop(tiles()[2], { dataTransfer: dt });
  fireEvent.dragEnd(card, { dataTransfer: dt });
  expect(within(tiles()[2]).getByText('라이브칠')).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: '추천 라이브' })).toBeNull();
  expect(document.querySelector('.player-layer--dragging')).toBeNull();
});

test('퀵패널 프로필을 끌어 시그니처 칸에 놓으면 그 방송에 고정', async () => {
  setup();
  const dlg = (fireEvent.click(within(tiles()[3]).getByRole('button', { name: '불러오기' })), screen.getByRole('dialog', { name: '불러오기' }));
  fireEvent.click(within(dlg).getByRole('tab', { name: '시그니처' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '시그니처 칸 넣기' }));
  const avatar = within(screen.getByRole('complementary', { name: '퀵패널' })).getByRole('button', { name: 'A' });
  const dt = dataTransfer();
  fireEvent.dragStart(avatar, { dataTransfer: dt });
  fireEvent.drop(tiles()[3], { dataTransfer: dt });
  expect(within(tiles()[3]).getByText('A 시그니처')).toBeInTheDocument();
});
