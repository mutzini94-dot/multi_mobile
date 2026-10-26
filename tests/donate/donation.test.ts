import { donateUrl, donationWarning, openDonationPopup } from '../../src/donate/donation';
import { mkCreator } from '../helpers/fixtures';

const fakeWin = (ret: unknown) => ({
  open: vi.fn().mockReturnValue(ret),
  screen: { availWidth: 1920, availHeight: 1040 } as Screen,
});

test('donateUrl', () => {
  expect(donateUrl('abc')).toBe('https://toon.at/donate/abc');
});

test("openDonationPopup은 'mv-donate' 이름으로 화면 오른쪽에 연다", () => {
  const popup = {};
  const win = fakeWin(popup);
  expect(openDonationPopup(mkCreator(1, { donateId: 'abc' }), win)).toBe(popup);
  expect(win.open).toHaveBeenCalledWith(
    'https://toon.at/donate/abc',
    'mv-donate',
    'popup=yes,width=480,height=1040,left=1440,top=0',
  );
});

test('팝업이 차단되면 null', () => {
  expect(openDonationPopup(mkCreator(1), fakeWin(null))).toBeNull();
});

describe('donationWarning', () => {
  const a = mkCreator(1, { name: 'A' });
  const b = mkCreator(2, { name: 'B' });
  test('팝업 A 열림, 선택 B → 경고', () => {
    expect(donationWarning(a, false, b)).toBe('후원 창은 A, 선택된 방송은 B입니다. 후원하기를 다시 누르면 B로 바뀝니다.');
  });
  test('팝업이 닫혔으면 null', () => expect(donationWarning(a, true, b)).toBeNull());
  test('같은 크리에이터면 null', () => expect(donationWarning(a, false, { ...a })).toBeNull());
  test('선택이 없으면 null', () => expect(donationWarning(a, false, null)).toBeNull());
  test('팝업 대상이 없으면 null', () => expect(donationWarning(null, false, b)).toBeNull());
  test('같은 채널이라도 후원 아이디가 다르면 경고', () =>
    expect(donationWarning(a, false, { ...a, donateId: 'other' })).not.toBeNull());
});
