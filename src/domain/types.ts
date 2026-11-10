export type Platform = 'youtube' | 'twitch';

export interface Creator {
  key: string; // creatorKey(platform, channel)
  name: string;
  donateId: string;
  platform: Platform;
  channel: string; // 유튜브: UC... 채널 ID, 트위치: 소문자 로그인명
  source: 'manual' | 'toonation'; // toonation: 투네이션 계정 즐겨찾기·라이브 목록(검증됨)
  profile?: string; // 프로필 이미지 URL (투네이션 즐겨찾기만)
  live?: { title: string; viewers: number; startedAt?: number }; // 라이브 중일 때만 (불러온 시점 기준, startedAt: 방송 시작 ms)
  videoId?: string; // 유튜브 라이브 영상 ID (투네이션 라이브 목록): 채널 임베드가 안 되는 채널도 재생. 저장하지 않는다
}

/** 웹페이지 창: 주소를 직접 넣어 연 사이트 (key는 창마다 고유) */
export interface WebPage {
  kind: 'web';
  key: string;
  name: string; // 사이트 주소 (www 제외)
  url: string;
}

/** 후원 페이지 창: 선택한 방송 크리에이터의 투네이션 후원 페이지 */
export interface DonatePage {
  kind: 'donate';
  key: string;
  name: string;
  pin?: Creator; // 이 방송에 고정 (없으면 선택한 방송을 따라간다)
}

/** 채팅 창: 선택한 방송의 트위치·유튜브 라이브 채팅 */
export interface ChatPage {
  kind: 'chat';
  key: string;
  name: string;
  pin?: Creator;
}

/** 활동 위젯 창: 즐겨찾기·후원 크리에이터의 라이브와 시청·후원·설정 변경 기록 */
export interface ActivityPage {
  kind: 'activity';
  key: string;
  name: string;
}

/** 시그니처 창: 선택한 방송 크리에이터의 투네이션 시그니처 목록 */
export interface SignaturePage {
  kind: 'signature';
  key: string;
  name: string;
  pin?: Creator;
}

export type PageSlot = WebPage | DonatePage | ChatPage | ActivityPage | SignaturePage;

/** 새 창으로 분리한 창의 자리 표시: 내용은 분리 창에 있고 창에는 되돌리기·불러오기만 */
export interface DetachedMark {
  kind: 'detached';
  key: string;
  name: string; // 분리한 내용의 이름
  id: string; // 분리 창 id
}

/** 창 하나의 내용: 방송 · 페이지 · 분리 표시 */
export type SlotItem = Creator | PageSlot | DetachedMark;

export type LayoutKind = 'wideSide' | 'single' | 'split2' | 'oneTwo' | 'quad' | 'oneThree' | 'oneFive' | 'six' | 'nine';

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
