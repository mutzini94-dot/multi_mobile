export type Platform = 'youtube' | 'twitch';

export interface Creator {
  key: string; // creatorKey(platform, channel)
  name: string;
  donateId: string;
  platform: Platform;
  channel: string; // 유튜브: UC... 채널 ID, 트위치: 소문자 로그인명
  source: 'manual' | 'link' | 'toonation'; // toonation: 투네이션 계정 즐겨찾기(검증됨)
  profile?: string; // 프로필 이미지 URL (투네이션 즐겨찾기만)
}

export type LayoutKind = 'single' | 'split2' | 'oneTwo' | 'quad';

export interface ViewState {
  layout: LayoutKind;
  slots: (Creator | null)[];
  sizes: Record<string, number[]>; // 패널 그룹 id → 퍼센트 배열
  selected: number | null;
  soundOn: boolean;
}

export function creatorKey(platform: Platform, channel: string): string {
  return `${platform}:${channel}`;
}
