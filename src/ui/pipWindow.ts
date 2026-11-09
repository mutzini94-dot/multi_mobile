import type { Creator } from '../domain/types';

/**
 * 웹 미니 모드: PC 크롬·엣지의 '문서 PIP'(Document Picture-in-Picture)로 다른 창 위에 늘 떠 있는 작은 창을 연다.
 * 다른 문서로 iframe을 옮기면 다시 불러오므로, 작은 창에는 그 방송의 임베드를 새로 띄운다.
 * 지원하지 않는 브라우저(휴대폰·사파리·파이어폭스)는 앱 안 미니 모드를 쓴다.
 */
type DocPip = { requestWindow(o?: { width?: number; height?: number }): Promise<Window> };

export function canDocumentPip(win: Window = window): boolean {
  return !!(win as Window & { documentPictureInPicture?: DocPip }).documentPictureInPicture;
}

/** 작은 창에 띄울 방송 임베드 주소 (트위치는 부모 도메인을 알려야 한다) */
export function embedUrl(c: Creator, host: string): string {
  if (c.platform === 'twitch') return `https://player.twitch.tv/?channel=${encodeURIComponent(c.channel)}&parent=${encodeURIComponent(host)}&autoplay=true`;
  return c.videoId
    ? `https://www.youtube.com/embed/${encodeURIComponent(c.videoId)}?autoplay=1&playsinline=1`
    : `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(c.channel)}&autoplay=1&playsinline=1`;
}

/** 작은 창을 열고 방송을 띄운다. 닫히면 onClose. 열지 못하면 null */
export async function openPipWindow(c: Creator, host: string, onClose: () => void, win: Window = window): Promise<Window | null> {
  const dpip = (win as Window & { documentPictureInPicture?: DocPip }).documentPictureInPicture;
  if (!dpip) return null;
  try {
    const pw = await dpip.requestWindow({ width: 480, height: 270 });
    const d = pw.document;
    d.title = `${c.name} · 투네이션 멀티뷰`;
    const style = d.createElement('style');
    style.textContent = 'html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{display:block;width:100vw;height:100vh;border:0}';
    d.head.appendChild(style);
    const frame = d.createElement('iframe');
    frame.title = `${c.name} 방송`;
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = embedUrl(c, host);
    d.body.appendChild(frame);
    pw.addEventListener('pagehide', onClose, { once: true });
    return pw;
  } catch {
    return null;
  }
}
