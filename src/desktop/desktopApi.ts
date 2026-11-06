import type { BridgeRequest, ToonationBridge, ToonationFavorite, ToonationAccount } from '../toonation/bridge';
import type { WebStoreSnapshot } from '../storage/webStoreSync';

/** 설치형 앱 응답: 메인 프로세스는 예외 대신 { ok, data | error }로 돌려준다 (IPC 오류 메시지 접두어를 피하기 위해). */
export type DesktopResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface DonateBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 설치형 앱(multiview/desktop/preload.js)이 window.multiviewDesktop으로 노출하는 기능 */
export interface DesktopApi {
  status(): Promise<DesktopResult<{ account: ToonationAccount | null }>>;
  login(): Promise<DesktopResult<object>>;
  logout(): Promise<DesktopResult<object>>;
  favorites(): Promise<DesktopResult<ToonationFavorite[]>>;
  history?(): Promise<DesktopResult<unknown[]>>; // 내 후원 내역 (src/toonation/history.ts DonationRecord)
  webStoreLoad?(): Promise<WebStoreSnapshot | null>; // 웹 화면 저장값 사본 (src/storage/webStoreSync.ts)
  webStoreSave?(snap: WebStoreSnapshot): void;
  search?(q: string): Promise<DesktopResult<ToonationFavorite[]>>; // 투네이션 크리에이터 검색
  bookmark?(tag: string, on: boolean): Promise<DesktopResult<object>>; // 투네이션 즐겨찾기 추가·해제
  signatures?(tag: string): Promise<DesktopResult<unknown[]>>; // 크리에이터 시그니처 (src/toonation/signatures.ts)
  selectSignature?(name: string, tag: string, cash: number, webContentsId?: number): Promise<string>; // 열린 후원창(또는 webContentsId의 후원 페이지 칸)의 시그니처 탭에서 그 시그니처를 고른다 ('ok' | 실패 사유)
  /** mode가 없으면 앱이 마지막으로 쓴 모드, amounts는 PIP 머리줄의 빠른 후원 금액 */
  openDonate(target: { tag: string; name: string; mode?: DonateMode; amounts?: number[]; messages?: string[] }): void;
  closeDonate(): void;
  setDonateBounds(rect: DonateBounds): void;
  setDonateMode(mode: DonateMode): void;
  fillDonate(amount: number): void; // 빠른 후원: 후원창의 금액만 채운다
  fillDonateMessage?(message: string): void; // 자주 쓰는 메시지: 후원창의 메시지만 채운다
  setAlwaysOnTop(on: boolean): void;
  setMiniMode?(on: boolean): void; // 미니 모드: 앱 창을 작게·항상 위로 (끄면 되돌린다)
  onDonateClosed(cb: () => void): () => void;
  onDonateMode(cb: (mode: DonateMode) => void): () => void;
  // 칸 분리 창 (src/detach/channel.ts). 메인 화면 쪽
  detachOpen?(p: { id: string; url: string; title: string }): void;
  detachClose?(id: string): void;
  detachPost?(id: string, msg: unknown): void;
  onDetachMessage?(cb: (id: string, msg: unknown) => void): () => void;
  onDetachClosed?(cb: (id: string) => void): () => void;
  // 분리 창 쪽
  soloPost?(msg: unknown): void;
  onSoloMessage?(cb: (msg: unknown) => void): () => void;
  soloSetAlwaysOnTop?(on: boolean): void;
  // 앱 옵션 · 업데이트
  // 백업: 창 크기·위치 (desktop/lib/windowLayout.js)
  windowLayout?(): Promise<Record<string, unknown> | null>;
  setWindowLayout?(layout: Record<string, unknown>): Promise<boolean>;
  appInfo?(): Promise<AppInfo | null>;
  setAppOption?(key: AppOption, value: boolean): Promise<boolean>;
  checkUpdate?(): void;
  installUpdate?(): void;
  onAppInfo?(cb: (info: AppInfo) => void): () => void;
  onFrameContextMenu?(cb: (p: { x: number; y: number }) => void): () => void; // 영상(iframe) 안 오른쪽 클릭 자리 (앱 화면 좌표)
}

/** 설치형 앱 정보: 버전 · 앱 옵션 · 업데이트 상태 (desktop/main.js appInfo) */
export interface AppInfo {
  version: string;
  options: { autoLaunch: boolean; closeToTray: boolean; autoUpdate: boolean };
  update: { status: 'idle' | 'disabled' | 'checking' | 'downloading' | 'latest' | 'downloaded' | 'error'; version?: string | null; percent?: number; error?: string | null };
}
export type AppOption = keyof AppInfo['options'];

/** 후원창 자리: 앱 가운데 모달 또는 항상 위 PIP 창 */
export type DonateMode = 'modal' | 'pip';

export function getDesktopApi(win: Window): DesktopApi | null {
  const api = (win as Window & { multiviewDesktop?: DesktopApi }).multiviewDesktop;
  return api && typeof api.status === 'function' && typeof api.openDonate === 'function' ? api : null;
}

/** 설치형 앱의 투네이션 기능을 웹의 ToonationBridge 형태로 감싼다. */
export function desktopBridge(api: DesktopApi): ToonationBridge {
  return {
    async request<T>(type: BridgeRequest, payload?: unknown): Promise<T> {
      const p = payload as { tag?: string; on?: boolean } | string | undefined;
      const calls: Record<BridgeRequest, (() => Promise<DesktopResult<unknown>>) | undefined> = {
        status: () => api.status(),
        login: () => api.login(),
        logout: () => api.logout(),
        favorites: () => api.favorites(),
        history: api.history && (() => api.history!()),
        search: api.search && (() => api.search!(String(p ?? ''))),
        bookmark: api.bookmark && (() => api.bookmark!(String((p as { tag?: string })?.tag ?? ''), !!(p as { on?: boolean })?.on)),
        signatures: api.signatures && (() => api.signatures!(String(p ?? ''))),
      };
      const call = calls[type];
      if (!call) throw new Error('NOT_SUPPORTED');
      const res = await call();
      if (!res || !res.ok) throw new Error(res && !res.ok ? res.error : 'NO_RESPONSE');
      return res.data as T;
    },
  };
}
