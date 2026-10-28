export type Platform = 'youtube' | 'twitch';

export interface Creator {
  key: string; // creatorKey(platform, channel)
  name: string;
  donateId: string;
  platform: Platform;
  channel: string; // 유튜브: UC... 채널 ID, 트위치: 소문자 로그인명
  source: 'manual' | 'toonation'; // toonation: 투네이션 계정 즐겨찾기·라이브 목록(검증됨)
  profile?: string; // 프로필 이미지 URL (투네이션 즐겨찾기만)
  live?: { title: string; viewers: number }; // 라이브 중일 때만 (투네이션 즐겨찾기를 불러온 시점 기준)
  videoId?: string; // 유튜브 라이브 영상 ID (투네이션 라이브 목록): 채널 임베드가 안 되는 채널도 재생. 저장하지 않는다
}

/** 웹페이지 칸: 주소를 직접 넣어 연 사이트 (key는 칸마다 고유) */
export interface WebPage {
  kind: 'web';
  key: string;
  name: string; // 사이트 주소 (www 제외)
  url: string;
}

/** 후원 페이지 칸: 선택한 방송 크리에이터의 투네이션 후원 페이지 */
export interface DonatePage {
  kind: 'donate';
  key: string;
  name: string;
}

/** 채팅 칸: 선택한 방송의 트위치·유튜브 라이브 채팅 */
export interface ChatPage {
  kind: 'chat';
  key: string;
  name: string;
}

export type PageSlot = WebPage | DonatePage | ChatPage;

/** 새 창으로 분리한 칸의 자리 표시: 내용은 분리 창에 있고 칸에는 되돌리기·불러오기만 */
export interface DetachedMark {
  kind: 'detached';
  key: string;
  name: string; // 분리한 내용의 이름
  id: string; // 분리 창 id
}

/** 칸 하나의 내용: 방송 · 페이지 · 분리 표시 */
export type SlotItem = Creator | PageSlot | DetachedMark;

export type LayoutKind = 'single' | 'split2' | 'oneTwo' | 'quad' | 'oneThree' | 'oneFive' | 'six' | 'nine';

export interface ViewState {
  layout: LayoutKind;
  slots: (SlotItem | null)[];
  sizes: Record<string, number[]>; // 패널 그룹 id → 퍼센트 배열
  selected: number | null;
  soundOn: boolean;
}

export function creatorKey(platform: Platform, channel: string): string {
  return `${platform}:${channel}`;
}
