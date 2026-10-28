import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { deletePreset, listPresets, MAX_PRESETS, PRESETS_KEY, savePreset } from '../../src/app/presets';
import { initialViewState } from '../../src/app/viewState';
import { applyLayout } from '../../src/layout/layouts';
import { localFavorites } from '../../src/favorites/favorites';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const view = (names: string[], layout: 'quad' | 'six' = 'quad') => {
  const s = applyLayout(initialViewState, layout);
  return { ...s, slots: s.slots.map((_, i) => (names[i] ? mkCreator(i + 1, { name: names[i] }) : null)) };
};

describe('presets 저장소', () => {
  test('이름 붙여 저장·불러오기, 같은 이름은 덮어쓴다', () => {
    const kv = safeStorage(undefined);
    expect(savePreset(kv, '  저녁 합방 세트 ', view(['A', 'B'])).ok).toBe(true);
    savePreset(kv, '아침', view(['C'], 'six'));
    savePreset(kv, '저녁 합방 세트', view(['D']));
    const list = listPresets(kv);
    expect(list.map((p) => p.name)).toEqual(['저녁 합방 세트', '아침']); // 최근 저장한 것 먼저
    expect(list[0].view.slots[0]).toMatchObject({ name: 'D' });
    expect(list[1].view.layout).toBe('six');
  });

  test('이름은 1~30자, 최대 개수', () => {
    const kv = safeStorage(undefined);
    expect(savePreset(kv, '   ', view(['A'])).ok).toBe(false);
    expect(savePreset(kv, 'x'.repeat(31), view(['A'])).ok).toBe(false);
    for (let i = 0; i < MAX_PRESETS; i++) savePreset(kv, `구성${i}`, view(['A']));
    const r = savePreset(kv, '하나 더', view(['A']));
    expect(r.ok).toBe(false);
  });

  test('삭제, 깨진 저장값은 건너뛴다', () => {
    const kv = safeStorage(undefined);
    savePreset(kv, 'A', view(['A']));
    const id = listPresets(kv)[0].id;
    deletePreset(kv, id);
    expect(listPresets(kv)).toEqual([]);
    kv.set(PRESETS_KEY, JSON.stringify([{ id: 'x', name: '깨짐', view: { v: 9 } }, 'nope']));
    expect(listPresets(kv)).toEqual([]);
  });
});

function setup() {
  const kv = safeStorage(undefined);
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(1, { name: 'A' }));
  favorites.add(mkCreator(2, { name: 'B' }));
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  const noBridge: ToonationBridge = { request: vi.fn(() => Promise.reject(new Error('NO_EXTENSION'))) as ToonationBridge['request'] };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { kv };
}
const tiles = () => [...document.querySelectorAll<HTMLElement>('.tile')];
const pick = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot]).getByRole('button', { name: '불러오기' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '불러오기' })).getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const openPresets = () => {
  fireEvent.click(screen.getByRole('button', { name: '화면 구성' }));
  return screen.getByRole('dialog', { name: '화면 구성' });
};

test('화면 구성: 지금 구성을 저장하고, 바꾼 뒤 다시 불러온다', () => {
  setup();
  pick(0, 'A');
  pick(1, 'B');
  let dlg = openPresets();
  fireEvent.change(within(dlg).getByLabelText('구성 이름'), { target: { value: '저녁 합방 세트' } });
  fireEvent.click(within(dlg).getByRole('button', { name: '지금 구성 저장' }));
  const item = within(dlg).getByRole('listitem');
  expect(within(item).getByText('저녁 합방 세트')).toBeInTheDocument();
  expect(within(item).getByText('4분할 · A, B')).toBeInTheDocument();
  fireEvent.click(within(dlg).getByRole('button', { name: '닫기' }));

  fireEvent.click(screen.getByRole('button', { name: '9분할' }));
  fireEvent.click(within(tiles()[0]).getByRole('button', { name: '방송 삭제' }));
  expect(tiles()).toHaveLength(9);

  dlg = openPresets();
  fireEvent.click(within(dlg).getByRole('button', { name: '저녁 합방 세트 불러오기' }));
  expect(screen.queryByRole('dialog', { name: '화면 구성' })).toBeNull();
  expect(tiles()).toHaveLength(4);
  expect(within(tiles()[0]).getByText('A')).toBeInTheDocument();
  expect(within(tiles()[1]).getByText('B')).toBeInTheDocument();
});

test('화면 구성: 삭제', () => {
  setup();
  pick(0, 'A');
  const dlg = openPresets();
  fireEvent.change(within(dlg).getByLabelText('구성 이름'), { target: { value: '하나' } });
  fireEvent.click(within(dlg).getByRole('button', { name: '지금 구성 저장' }));
  fireEvent.click(within(dlg).getByRole('button', { name: '하나 삭제' }));
  expect(within(dlg).queryByRole('listitem')).toBeNull();
  expect(within(dlg).getByText('저장한 구성이 없습니다.')).toBeInTheDocument();
});

test('화면 구성: 이름이 없으면 저장하지 않고 알려준다', () => {
  setup();
  const dlg = openPresets();
  fireEvent.click(within(dlg).getByRole('button', { name: '지금 구성 저장' }));
  expect(within(dlg).getByText('구성 이름을 1~30자로 입력해 주세요')).toBeInTheDocument();
});
