import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/app/App';
import { localFavorites } from '../../src/favorites/favorites';
import { HOST_KEY } from '../../src/host/hostProfile';
import { decodeJoint, encodeJoint } from '../../src/share/jointLink';
import { safeStorage } from '../../src/storage/safeStorage';
import type { ToonationBridge } from '../../src/toonation/bridge';
import type { ViewState } from '../../src/domain/types';
import { mkCreator } from '../helpers/fixtures';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

const noBridge: ToonationBridge = { request: () => Promise.reject(new Error('NO_EXTENSION')) };

function setup({ hash = '', href = 'https://mv.example.com/', savedHost = false } = {}) {
  const kv = safeStorage(undefined);
  if (savedHost) kv.set(HOST_KEY, JSON.stringify({ name: '나', donateId: 'myTag', platform: 'twitch', channel: 'my_ch' }));
  const favorites = localFavorites(kv);
  favorites.add(mkCreator(2, { name: '게스트B', donateId: 'guestTag' }));
  favorites.add(mkCreator(3, { name: '게스트C', donateId: 'guestTag3' }));
  const writeText = vi.fn(() => Promise.resolve());
  const win = {
    open: vi.fn(() => ({ closed: false }) as unknown as Window),
    screen: { availWidth: 1920, availHeight: 1040 } as Screen,
    location: { hash, href: href + hash } as Location,
    navigator: { clipboard: { writeText } } as unknown as Navigator,
  };
  render(<App favorites={favorites} kv={kv} win={win} bridge={noBridge} desktop={null} />);
  return { kv, win, writeText };
}

const tiles = () => document.querySelectorAll('.tile');
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const pickGuest = (slot: number, name: string) => {
  fireEvent.click(within(tiles()[slot] as HTMLElement).getByRole('button', { name: '불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name} ·`) }));
};
const shareDialog = () => screen.getByRole('dialog', { name: '합방 방송 URL' });
const shareUrl = () => (within(shareDialog()).getByLabelText('방송 URL') as HTMLInputElement).value;

describe('호스트: 합방 방송 개설', () => {
  test('처음이면 내 방송 정보를 입력·저장하고, 호스트 방송이 1번 칸에 고정된다', () => {
    const { kv } = setup();
    fireEvent.click(btn('합방 방송 개설'));
    const dialog = screen.getByRole('dialog', { name: '내 방송 정보' });
    fireEvent.change(within(dialog).getByLabelText('이름'), { target: { value: '나' } });
    fireEvent.change(within(dialog).getByLabelText('채널'), { target: { value: 'twitch.tv/My_Ch' } });
    fireEvent.change(within(dialog).getByLabelText('투네이션 후원 아이디'), { target: { value: 'myTag' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장하고 개설' }));
    expect(screen.queryByRole('dialog', { name: '내 방송 정보' })).toBeNull();
    expect(JSON.parse(kv.get(HOST_KEY)!)).toMatchObject({ name: '나', donateId: 'myTag', channel: 'my_ch' });
    const hostTile = tiles()[0] as HTMLElement;
    expect(within(hostTile).getByText('나')).toBeInTheDocument();
    expect(within(hostTile).getByText('호스트')).toBeInTheDocument();
    expect(within(hostTile).queryByRole('button', { name: '불러오기' })).toBeNull();
    expect(within(hostTile).queryByRole('button', { name: '방송 삭제' })).toBeNull();
    expect(btn('방송 시작하기')).toBeInTheDocument();
    expect(btn('합방 종료')).toBeInTheDocument();
  });

  test('입력이 잘못되면 오류를 보여주고 개설하지 않는다', () => {
    setup();
    fireEvent.click(btn('합방 방송 개설'));
    const dialog = screen.getByRole('dialog', { name: '내 방송 정보' });
    fireEvent.change(within(dialog).getByLabelText('이름'), { target: { value: '나' } });
    fireEvent.change(within(dialog).getByLabelText('채널'), { target: { value: 'my_ch' } });
    fireEvent.change(within(dialog).getByLabelText('투네이션 후원 아이디'), { target: { value: '../x' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장하고 개설' }));
    expect(within(dialog).getByText('투네이션 후원 아이디를 확인해 주세요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '방송 시작하기' })).toBeNull();
  });

  test('저장된 정보가 있으면 바로 개설, 내 방송 정보로 수정하면 1번 칸도 바뀐다', () => {
    setup({ savedHost: true });
    fireEvent.click(btn('합방 방송 개설'));
    expect(screen.queryByRole('dialog', { name: '내 방송 정보' })).toBeNull();
    expect(within(tiles()[0] as HTMLElement).getByText('나')).toBeInTheDocument();
    fireEvent.click(btn('내 방송 정보'));
    const dialog = screen.getByRole('dialog', { name: '내 방송 정보' });
    expect((within(dialog).getByLabelText('이름') as HTMLInputElement).value).toBe('나');
    fireEvent.change(within(dialog).getByLabelText('이름'), { target: { value: '새이름' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(within(tiles()[0] as HTMLElement).getByText('새이름')).toBeInTheDocument();
  });

  test('게스트를 넣고 방송 시작하기 → 지금 구성의 고정 URL, 복사', async () => {
    const { writeText } = setup({ savedHost: true });
    fireEvent.click(btn('합방 방송 개설'));
    pickGuest(1, '게스트B');
    fireEvent.click(btn('방송 시작하기'));
    const url = shareUrl();
    expect(url.startsWith('https://mv.example.com/#j=')).toBe(true);
    const joint = decodeJoint(new URL(url).hash)!;
    expect(joint.host).toMatchObject({ name: '나', donateId: 'myTag' });
    expect(joint.state.slots.map((c) => c?.name ?? null)).toEqual(['나', '게스트B', null, null, null, null, null, null, null]);
    await act(async () => {
      fireEvent.click(within(shareDialog()).getByRole('button', { name: 'URL 복사' }));
    });
    expect(writeText).toHaveBeenCalledWith(url);
    expect(within(shareDialog()).getByText('복사했습니다')).toBeInTheDocument();
  });

  test('시작한 뒤 게스트를 바꾸면 URL은 그대로(고정), 새 URL 만들기로 반영', () => {
    setup({ savedHost: true });
    fireEvent.click(btn('합방 방송 개설'));
    pickGuest(1, '게스트B');
    fireEvent.click(btn('방송 시작하기'));
    const first = shareUrl();
    fireEvent.click(within(shareDialog()).getByRole('button', { name: '닫기' }));
    pickGuest(2, '게스트C');
    fireEvent.click(btn('방송 URL'));
    expect(shareUrl()).toBe(first);
    fireEvent.click(within(shareDialog()).getByRole('button', { name: '새 URL 만들기' }));
    expect(shareUrl()).not.toBe(first);
    expect(decodeJoint(new URL(shareUrl()).hash)!.state.slots.map((c) => c?.name ?? null)).toEqual(['나', '게스트B', '게스트C', null, null, null, null, null, null]);
  });

  test('설치형·로컬(localhost)에서는 시청 페이지 주소를 입력받아 저장한다', () => {
    const { kv } = setup({ savedHost: true, href: 'http://localhost:1363/' });
    fireEvent.click(btn('합방 방송 개설'));
    fireEvent.click(btn('방송 시작하기'));
    const dialog = shareDialog();
    expect(within(dialog).getByText(/배포한 멀티뷰 웹 주소를 입력/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('방송 URL')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('시청 페이지 주소'), { target: { value: 'https://mv.example.com/' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '적용' }));
    expect(shareUrl().startsWith('https://mv.example.com/#j=')).toBe(true);
    expect(kv.get('mv.publicBase.v1')).toBe('https://mv.example.com/');
  });

  test('합방 종료하면 일반 화면으로 (1번 칸도 다시 바꿀 수 있음)', () => {
    setup({ savedHost: true });
    fireEvent.click(btn('합방 방송 개설'));
    fireEvent.click(btn('합방 종료'));
    expect(btn('합방 방송 개설')).toBeInTheDocument();
    expect(within(tiles()[0] as HTMLElement).getByRole('button', { name: '불러오기' })).toBeInTheDocument();
    expect(within(tiles()[0] as HTMLElement).queryByText('호스트')).toBeNull();
  });
});

describe('시청자: 합방 URL로 열기', () => {
  const host = mkCreator(9, { name: '호스트님', donateId: 'hostTag' });
  const viewState: ViewState = { layout: 'split2', slots: [host, mkCreator(2, { name: '게스트B' }), null, null], sizes: {}, selected: null, soundOn: true };
  const hash = encodeJoint(host, viewState);

  test('상단에 합방 제목과 후원 대상(호스트)을 보여주고, 칸은 바꿀 수 없다', () => {
    setup({ hash });
    expect(screen.getByText('호스트님의 합방')).toBeInTheDocument();
    const target = screen.getByLabelText('후원 대상');
    expect(target).toHaveTextContent('호스트님');
    expect(target).toHaveTextContent('toon.at/donate/hostTag');
    expect(screen.queryByRole('button', { name: '불러오기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '방송 삭제' })).toBeNull();
    expect(screen.queryByRole('button', { name: '합방 방송 개설' })).toBeNull();
    expect(within(tiles()[0] as HTMLElement).getByText('호스트')).toBeInTheDocument();
    expect(screen.queryByText('검증되지 않음')).toBeNull();
  });

  test('게스트 칸을 선택해도 후원은 호스트에게 (첫 후원은 확인)', () => {
    const { win } = setup({ hash });
    expect(btn('후원하기')).toBeEnabled();
    fireEvent.click(within(tiles()[1] as HTMLElement).getByText('게스트B'));
    fireEvent.click(btn('후원하기'));
    const confirm = screen.getByRole('dialog', { name: '후원 대상 확인' });
    expect(confirm).toHaveTextContent('hostTag');
    fireEvent.click(within(confirm).getByRole('button', { name: '확인하고 후원' }));
    expect(win.open).toHaveBeenCalledWith('https://toon.at/donate/hostTag', 'mv-donate', expect.any(String));
    expect(screen.queryByRole('alert')).toBeNull(); // 선택 칸과 달라도 경고 없음 (합방 후원은 항상 호스트)
  });

  test('원래 구성으로: 레이아웃을 바꿔도 되돌릴 수 있다', () => {
    setup({ hash });
    fireEvent.click(btn('4분할'));
    expect(tiles()).toHaveLength(4);
    fireEvent.click(btn('원래 구성으로'));
    expect(tiles()).toHaveLength(2);
  });

  test('예전 #s= 링크와 깨진 URL은 안내만 하고 일반 화면', () => {
    setup({ hash: '#s=abc' });
    expect(screen.getByText('예전 형식의 합방 링크입니다. 호스트에게 새 URL을 받아 주세요')).toBeInTheDocument();
    expect(btn('합방 방송 개설')).toBeInTheDocument();
  });

  test('잘못된 합방 URL', () => {
    setup({ hash: '#j=@@@' });
    expect(screen.getByText('합방 URL이 올바르지 않습니다')).toBeInTheDocument();
  });
});
