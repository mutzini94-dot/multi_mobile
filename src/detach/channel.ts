import type { Creator } from '../domain/types';
import type { DesktopApi } from '../desktop/desktopApi';
import { soloUrl, type SoloPayload } from './soloLink';

/** 메인 화면 → 분리 창 */
export type HostToSolo = { type: 'donateFor'; creator: Creator | null; videoId?: string | null }; // 후원 페이지·채팅 창이 따라갈 방송
/** 분리 창 → 메인 화면 */
export type SoloToHost = { type: 'return' } | { type: 'donate' }; // 되돌리기 · 후원하기(방송)

/** 메인 화면이 분리 창을 여닫고 주고받는 통로 (웹: 팝업 창, 설치형: 앱 창) */
export interface DetachHost {
  open(p: SoloPayload, title: string, at?: { x: number; y: number }): boolean; // false: 팝업 차단 등으로 열지 못함. at: 메인 창 밖 놓은 자리 (메인 창 안 좌표)
  close(id: string): void;
  post(id: string, msg: HostToSolo): void;
  onMessage(cb: (id: string, msg: SoloToHost) => void): () => void;
  onClosed(cb: (id: string) => void): () => void; // 사용자가 분리 창을 닫음
  onDropped?(cb: (id: string, x: number, y: number) => void): () => void; // 분리 창을 메인 창 (x, y)에 끌어 놓음 (설치형)
  onDragHover?(cb: (p: { x: number; y: number } | null) => void): () => void; // 분리 창을 끄는 동안 메인 창 안 커서 자리
}

/** 분리 창 쪽 통로 */
export interface SoloLink {
  post(msg: SoloToHost): void;
  onMessage(cb: (msg: HostToSolo) => void): () => void;
}

const SOLO = 'mv-solo';
const HOST = 'mv-host';
const isSoloMsg = (m: unknown): m is SoloToHost => !!m && typeof m === 'object' && ((m as SoloToHost).type === 'return' || (m as SoloToHost).type === 'donate');
const isHostMsg = (m: unknown): m is HostToSolo => !!m && typeof m === 'object' && (m as HostToSolo).type === 'donateFor';

type Win = Pick<Window, 'open' | 'location' | 'addEventListener' | 'removeEventListener'>;

/** 웹: 같은 앱을 팝업 창으로 열고 postMessage로 주고받는다. 닫힘은 주기적으로 확인한다. */
export function webDetachHost(win: Win, pollMs = 1000): DetachHost {
  const wins = new Map<string, Window>();
  const closedCbs = new Set<(id: string) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  const poll = () => {
    for (const [id, w] of wins) {
      if (!w.closed) continue;
      wins.delete(id);
      closedCbs.forEach((cb) => cb(id));
    }
    if (!wins.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  return {
    open(p, title) {
      const w = win.open(soloUrl(win.location.href, p), `mv-solo-${p.id}`, 'popup,width=720,height=440');
      if (!w) return false;
      try {
        w.document.title = title;
      } catch {
        // 아직 읽는 중
      }
      wins.set(p.id, w);
      if (!timer) timer = setInterval(poll, pollMs);
      return true;
    },
    close(id) {
      wins.get(id)?.close();
      wins.delete(id);
    },
    post(id, msg) {
      wins.get(id)?.postMessage({ source: HOST, msg }, win.location.origin);
    },
    onMessage(cb) {
      const fn = (e: MessageEvent) => {
        if (e.origin !== win.location.origin || e.data?.source !== SOLO || !isSoloMsg(e.data.msg)) return;
        const id = [...wins].find(([, w]) => w === e.source)?.[0];
        if (id) cb(id, e.data.msg);
      };
      win.addEventListener('message', fn as EventListener);
      return () => win.removeEventListener('message', fn as EventListener);
    },
    onClosed(cb) {
      closedCbs.add(cb);
      return () => closedCbs.delete(cb);
    },
  };
}

/** 웹 분리 창: 연 창(opener)과 주고받는다 */
export function webSoloLink(win: Window): SoloLink {
  return {
    post(msg) {
      win.opener?.postMessage({ source: SOLO, msg }, win.location.origin);
    },
    onMessage(cb) {
      const fn = (e: MessageEvent) => {
        if (e.origin === win.location.origin && e.source === win.opener && e.data?.source === HOST && isHostMsg(e.data.msg)) cb(e.data.msg);
      };
      win.addEventListener('message', fn);
      return () => win.removeEventListener('message', fn);
    },
  };
}

/** 설치형: 앱이 따로 창을 만들고 메시지를 이어 준다 (desktop/main.js) */
export function desktopDetachHost(api: DesktopApi, currentUrl: () => string): DetachHost {
  return {
    open(p, title, at) {
      api.detachOpen?.({ id: p.id, url: soloUrl(currentUrl(), p), title, at: at ?? null });
      return !!api.detachOpen;
    },
    close: (id) => api.detachClose?.(id),
    post: (id, msg) => api.detachPost?.(id, msg),
    onMessage: (cb) => api.onDetachMessage?.((id, msg) => isSoloMsg(msg) && cb(id, msg)) ?? (() => {}),
    onClosed: (cb) => api.onDetachClosed?.(cb) ?? (() => {}),
    onDropped: (cb) => api.onDetachDropped?.(cb) ?? (() => {}),
    onDragHover: (cb) => api.onDragHover?.(cb) ?? (() => {}),
  };
}

export function desktopSoloLink(api: DesktopApi): SoloLink {
  return {
    post: (msg) => api.soloPost?.(msg),
    onMessage: (cb) => api.onSoloMessage?.((msg) => isHostMsg(msg) && cb(msg)) ?? (() => {}),
  };
}
