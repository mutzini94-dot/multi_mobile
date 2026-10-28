import type { BridgeRequest, ToonationBridge, ToonationFavorite, ToonationAccount } from '../toonation/bridge';

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
  /** mode가 없으면 앱이 마지막으로 쓴 모드, amounts는 PIP 머리줄의 빠른 후원 금액 */
  openDonate(target: { tag: string; name: string; mode?: DonateMode; amounts?: number[] }): void;
  closeDonate(): void;
  setDonateBounds(rect: DonateBounds): void;
  setDonateMode(mode: DonateMode): void;
  fillDonate(amount: number): void; // 빠른 후원: 후원창의 금액만 채운다
  setAlwaysOnTop(on: boolean): void;
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
}

/** 후원창 자리: 앱 가운데 모달 또는 항상 위 PIP 창 */
export type DonateMode = 'modal' | 'pip';

export function getDesktopApi(win: Window): DesktopApi | null {
  const api = (win as Window & { multiviewDesktop?: DesktopApi }).multiviewDesktop;
  return api && typeof api.status === 'function' && typeof api.openDonate === 'function' ? api : null;
}

/** 설치형 앱의 투네이션 기능을 웹의 ToonationBridge 형태로 감싼다. */
export function desktopBridge(api: DesktopApi): ToonationBridge {
  return {
    async request<T>(type: BridgeRequest): Promise<T> {
      const res = await (type === 'status' ? api.status() : type === 'login' ? api.login() : type === 'logout' ? api.logout() : api.favorites());
      if (!res || !res.ok) throw new Error(res && !res.ok ? res.error : 'NO_RESPONSE');
      return res.data as T;
    },
  };
}
