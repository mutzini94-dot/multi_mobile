import type { Result } from './creatorInput';
import type { ActivityPage, SignaturePage, ChatPage, Creator, DonatePage, PageSlot, SlotItem, ViewState, WebPage } from './types';
import { visibleSlots } from '../layout/layouts';

/** 칸 내용이 방송인지 (후원 페이지·웹페이지 칸이 아닌지) */
export function isStream(item: SlotItem | null | undefined): item is Creator {
  return !!item && !('kind' in item);
}

/** 후원 페이지·웹페이지 칸 (분리 표시는 아님) */
export function isPage(item: SlotItem | null | undefined): item is PageSlot {
  return !!item && 'kind' in item && (item.kind === 'web' || item.kind === 'donate' || item.kind === 'chat' || item.kind === 'activity' || item.kind === 'signature');
}

/** 웹페이지 칸 주소: 주소만 넣으면 https://, http·https만 허용 */
export function normalizePageUrl(input: string): Result<string> {
  const raw = String(input ?? '').trim();
  if (!raw || /\s/.test(raw)) return { ok: false, error: '열 주소를 입력해 주세요 (예: naver.com)' };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname.includes('.')) throw new Error();
    return { ok: true, value: u.href };
  } catch {
    return { ok: false, error: 'http:// 또는 https:// 웹 주소만 열 수 있습니다' };
  }
}

let seq = 0;
const newKey = (kind: string) => `${kind}:${Date.now().toString(36)}${(++seq).toString(36)}`;

export function makeWebPage(input: string): Result<WebPage> {
  const r = normalizePageUrl(input);
  if (!r.ok) return r;
  const name = new URL(r.value).hostname.replace(/^www\./, '');
  return { ok: true, value: { kind: 'web', key: newKey('web'), name, url: r.value } };
}

/** 후원 페이지 칸: 선택한 방송 크리에이터의 투네이션 후원 페이지를 따라 보여준다 */
export function makeDonatePage(): DonatePage {
  return { kind: 'donate', key: newKey('donate'), name: '후원 페이지' };
}

/** 채팅 칸: 선택한 방송의 라이브 채팅을 따라 보여준다 */
export function makeChatPage(): ChatPage {
  return { kind: 'chat', key: newKey('chat'), name: '채팅' };
}

/** 활동 위젯 칸: 즐겨찾기·후원 크리에이터의 라이브와 최근 활동 */
export function makeActivityPage(): ActivityPage {
  return { kind: 'activity', key: newKey('activity'), name: '활동 위젯' };
}

/** 시그니처 칸: 선택한 방송 크리에이터의 시그니처 목록을 따라 보여준다 */
export function makeSignaturePage(): SignaturePage {
  return { kind: 'signature', key: newKey('signature'), name: '시그니처' };
}

/** 큰 화면+1: 오른쪽 좁은 칸이 비어 있으면 후원 페이지(왼쪽 방송을 따라감)를 넣는다 */
export function withSidePage(state: ViewState): ViewState {
  if (state.layout !== 'wideSide' || state.slots[1]) return state;
  const slots = state.slots.slice();
  slots[1] = makeDonatePage();
  return { ...state, slots };
}

/** 방송에 고정할 수 있는 칸 (선택한 방송을 따라가는 칸) */
export function isPinnable(item: SlotItem | null | undefined): item is DonatePage | ChatPage | SignaturePage {
  return isPage(item) && (item.kind === 'donate' || item.kind === 'chat' || item.kind === 'signature');
}

/** 페이지 칸이 보여 줄 방송: 고정한 방송 > 따라가는 방송(선택한 방송) */
export function pageTarget(page: PageSlot, follow: Creator | null): Creator | null {
  if (!isPinnable(page)) return null;
  return page.pin ?? follow;
}

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * 라이브 채팅 주소. 설치형(webview)은 팝아웃 채팅(그 사이트에 로그인하면 채팅 입력 가능),
 * 웹(iframe)은 공식 임베드 (트위치는 parent, 유튜브는 embed_domain에 이 페이지 주소가 있어야 한다).
 * 유튜브는 채널이 아니라 라이브 영상 ID로만 채팅을 열 수 있어, 모르면 null.
 */
export function chatUrl(c: Creator, videoId: string | null | undefined, embed: 'webview' | 'iframe', host: string): string | null {
  if (c.platform === 'twitch') {
    const ch = encodeURIComponent(c.channel);
    return embed === 'webview' ? `https://www.twitch.tv/popout/${ch}/chat` : `https://www.twitch.tv/embed/${ch}/chat?parent=${encodeURIComponent(host)}`;
  }
  if (!videoId || !VIDEO_ID_RE.test(videoId)) return null;
  return embed === 'webview'
    ? `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`
    : `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${encodeURIComponent(host)}`;
}

/**
 * 투네이션 후원 페이지는 frame-ancestors로 허용한 곳(투네이션·localhost 등)에서만 iframe 안에 뜬다.
 * 투네이션이 이 앱 주소를 허용하면 VITE_DONATE_FRAME_HOSTS(쉼표로 구분)에 넣어 창 안에 띄운다.
 */
export function canFrameDonate(host: string, extra = ''): boolean {
  const allowed = ['localhost', '127.0.0.1', ...extra.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)];
  return allowed.includes(host.toLowerCase());
}

export function donatePageUrl(c: Creator): string {
  return `https://toon.at/donate/${encodeURIComponent(c.donateId)}`;
}

/** 후원 페이지 칸의 크리에이터: 선택한 방송 > 마지막으로 따라간 방송(아직 칸에 있으면) > 보이는 첫 방송 */
export function followDonateCreator(state: ViewState, last: Creator | null): Creator | null {
  const selected = state.selected !== null ? state.slots[state.selected] : null;
  if (isStream(selected)) return selected;
  if (last && state.slots.some((s) => isStream(s) && s.key === last.key && s.donateId === last.donateId)) return last;
  return visibleSlots(state).find(isStream) ?? null;
}
