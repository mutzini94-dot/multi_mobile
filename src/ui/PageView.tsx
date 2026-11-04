import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { mobileFit } from './mobileFit';
import type { PageSlot } from '../domain/types';

/** 페이지 칸 조작 (칸 위쪽 바의 뒤로·새로고침) */
export interface PageHandle {
  back(): void;
  reload(): void;
  webContentsId?(): number | null; // 설치형 webview의 페이지 id (후원 페이지 칸에서 시그니처 고르기)
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
  emptyText?: string; // 주소가 없을 때 안내
}

type WebviewEl = HTMLElement & { goBack?(): void; canGoBack?(): boolean; reload?(): void };

export function PageView({ page, url, embed, onHandle, onOpenWindow, emptyText = '후원할 방송 칸을 선택하세요' }: Props) {
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
      webContentsId: () => {
        try {
          const id = (ref.current as (HTMLElement & { getWebContentsId?(): number }) | null)?.getWebContentsId?.();
          return Number.isInteger(id) ? (id as number) : null;
        } catch {
          return null; // 아직 붙기 전
        }
      },
    });
    return () => onHandleRef.current?.(null);
  }, []);

  if (!url) return <div className="page-view page-view--empty">{emptyText}</div>;
  if (embed === 'webview') {
    // allowpopups: 새 창 요청은 설치형(main.js)이 같은 칸에서 열도록 처리한다. React는 boolean 값을 속성으로 쓰지 않아 문자열로 넘긴다
    const popups = { allowpopups: 'true' } as object;
    if (page.kind === 'donate') return <MobileFitWebview url={url} popups={popups} webviewRef={ref} />;
    return <webview ref={ref} className="page-view" src={url} partition={WEB_PARTITION} {...popups} />;
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

/**
 * 후원 페이지 webview: 투네이션은 화면 폭으로 PC판·모바일판을 고르므로(768px부터 PC판),
 * 칸이 넓으면 모바일 폭으로 그린 뒤 칸 크기만큼 키워 좌우 여백 없이 모바일판으로 채운다 (설치형은 페이지가 보는 UA도 모바일).
 */
function MobileFitWebview({ url, popups, webviewRef }: { url: string; popups: object; webviewRef: React.MutableRefObject<HTMLElement | null> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const last = useRef(box);
  const measure = () => {
    const el = boxRef.current;
    if (!el) return;
    const next = { width: el.clientWidth, height: el.clientHeight };
    // 크기가 바뀔 때만 갱신한다. 같은 값이라도 그릴 때마다 setState를 부르면 업데이트가 이어져
    // (전체 화면 나가기 등) React가 무한 갱신으로 보고 화면 전체를 지운다 (React error #185)
    if (next.width === last.current.width && next.height === last.current.height) return;
    last.current = next;
    setBox(next);
  };
  // 칸 자리가 정해질 때마다(PlayerLayer가 다시 그린다) 잰다. webview가 든 틀에서는 ResizeObserver가 알리지 않을 때가 있다
  useLayoutEffect(measure);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = mobileFit(box.width, box.height);
  const style = fit.scale === 1 ? undefined : { width: fit.width, height: fit.height, transform: `scale(${fit.scale})` };
  return (
    <div ref={boxRef} className="page-view-fit">
      <webview ref={webviewRef} className="page-view page-view--mobile" style={style} src={url} partition={DONATE_PARTITION} {...popups} />
    </div>
  );
}
