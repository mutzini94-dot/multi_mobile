import { useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * 안드로이드 앱: 후원 페이지를 웹 화면 속(iframe)이 아니라 앱 화면 위 별도 웹뷰로 띄운다 (ToonationPlugin.showDonate).
 * 맨 위 페이지라 투네이션 로그인 쿠키가 그대로 쓰여 로그인한 상태로 후원한다.
 * 웹 쪽은 자리만 잡아 두고(이 div), 그 자리의 좌표를 앱에 계속 알려 준다.
 */
interface DonatePlugin {
  showDonate(o: { url: string; x: number; y: number; width: number; height: number }): Promise<void>;
  hideDonate(): Promise<void>;
}
const Native = registerPlugin<DonatePlugin>('Toonation');

export const canNativeDonate = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export function NativeDonateFrame({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let last = '';
    let raf = 0;
    const tick = () => {
      const el = box.current;
      if (el) {
        const r = el.getBoundingClientRect();
        // 다른 시트·메뉴가 위를 덮으면 그동안 숨긴다 (앱 웹뷰는 웹 화면보다 위에 그려진다)
        const covered = !!document.querySelector('.phone-sheet__backdrop, .context-sheet__backdrop, .modal-backdrop:not(.page-sheet__backdrop)');
        const rect = covered ? { x: 0, y: 0, width: 0, height: 0 } : { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
        const key = `${url}|${rect.x},${rect.y},${rect.width},${rect.height}`;
        if (key !== last) {
          last = key;
          void Native.showDonate({ url, ...rect }).catch(() => {});
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      void Native.hideDonate().catch(() => {});
    };
  }, [url]);
  return (
    <div ref={box} className="page-view page-view--native" aria-label="투네이션 후원 페이지">
      <p className="muted">후원 페이지를 여는 중…</p>
    </div>
  );
}
