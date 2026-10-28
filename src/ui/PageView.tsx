import { useEffect, useRef } from 'react';
import type { PageSlot } from '../domain/types';

/** 페이지 칸 조작 (칸 위쪽 바의 뒤로·새로고침) */
export interface PageHandle {
  back(): void;
  reload(): void;
}

/** 설치형 webview 세션: 후원 페이지는 앱의 투네이션 로그인 세션, 웹페이지는 따로 */
export const DONATE_PARTITION = 'persist:toonation';
export const WEB_PARTITION = 'persist:mvweb';

interface Props {
  page: PageSlot;
  url: string | null; // 띄울 주소 (후원 페이지 칸에 따라갈 방송이 없으면 null)
  embed: 'webview' | 'iframe'; // 설치형은 webview(어떤 사이트든 표시), 웹은 iframe(사이트가 막으면 안 보임)
  onHandle?(h: PageHandle | null): void;
  onOpenWindow?(): void; // 웹의 후원 페이지 칸: 새 창(팝업)으로 열기
}

type WebviewEl = HTMLElement & { goBack?(): void; canGoBack?(): boolean; reload?(): void };

export function PageView({ page, url, embed, onHandle, onOpenWindow }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const onHandleRef = useRef(onHandle);
  onHandleRef.current = onHandle;

  useEffect(() => {
    onHandleRef.current?.({
      back: () => {
        const el = ref.current as WebviewEl | null;
        try {
          if (el?.canGoBack?.()) el.goBack?.();
        } catch {
          // 아직 페이지를 읽기 전
        }
      },
      reload: () => {
        const el = ref.current;
        try {
          if (el instanceof HTMLIFrameElement) el.src = el.src;
          else (el as WebviewEl | null)?.reload?.();
        } catch {
          // 아직 페이지를 읽기 전
        }
      },
    });
    return () => onHandleRef.current?.(null);
  }, []);

  if (!url) return <div className="page-view page-view--empty">후원할 방송 칸을 선택하세요</div>;
  if (embed === 'webview') {
    // allowpopups: 새 창 요청은 설치형(main.js)이 같은 칸에서 열도록 처리한다. React는 boolean 값을 속성으로 쓰지 않아 문자열로 넘긴다
    const popups = { allowpopups: 'true' } as object;
    return <webview ref={ref} className="page-view" src={url} partition={page.kind === 'donate' ? DONATE_PARTITION : WEB_PARTITION} {...popups} />;
  }
  if (page.kind === 'donate') {
    // 투네이션 후원 페이지는 다른 페이지 안에 띄우는 것을 막아 두었다 (설치형은 칸 안에 표시)
    return (
      <div className="page-view page-view--empty">
        <p>웹에서는 후원 페이지를 칸 안에 띄울 수 없습니다.</p>
        <button type="button" className="btn btn--donate" onClick={onOpenWindow}>
          새 창으로 후원 페이지 열기
        </button>
      </div>
    );
  }
  return <iframe ref={ref as React.Ref<HTMLIFrameElement>} className="page-view" title={page.name} src={url} referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; fullscreen; clipboard-write" />;
}
