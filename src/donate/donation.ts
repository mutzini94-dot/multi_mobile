import type { Creator } from '../domain/types';

export const POPUP_NAME = 'mv-donate';
export const POPUP_WIDTH = 480;

export function donateUrl(donateId: string): string {
  return `https://toon.at/donate/${encodeURIComponent(donateId)}`;
}

/** 같은 방송이라도 후원 아이디가 다르면 다른 후원 대상으로 본다. */
export function sameDonationTarget(a: Creator, b: Creator): boolean {
  return a.key === b.key && a.donateId === b.donateId;
}

/** 투네이션은 다른 사이트 iframe 임베드를 막으므로 화면 오른쪽에 붙는 팝업으로 연다. */
export function openDonationPopup(creator: Creator, win: Pick<Window, 'open' | 'screen'>): Window | null {
  const { availWidth, availHeight } = win.screen;
  const features = `popup=yes,width=${POPUP_WIDTH},height=${availHeight},left=${Math.max(0, availWidth - POPUP_WIDTH)},top=0`;
  return win.open(donateUrl(creator.donateId), POPUP_NAME, features) ?? null;
}

export function donationWarning(popupCreator: Creator | null, popupClosed: boolean, selected: Creator | null): string | null {
  if (!popupCreator || popupClosed || !selected || sameDonationTarget(popupCreator, selected)) return null;
  return `후원 창은 ${popupCreator.name}, 선택된 방송은 ${selected.name}입니다. 후원하기를 다시 누르면 ${selected.name}로 바뀝니다.`;
}
