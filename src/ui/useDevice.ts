import { useEffect, useState } from 'react';

type WakeSentinel = { release(): Promise<void>; addEventListener?(t: 'release', f: () => void): void };
type WakeNavigator = Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeSentinel> } };

/**
 * 화면 꺼짐 방지 (Screen Wake Lock): active인 동안 휴대폰 화면이 저절로 꺼지지 않게 한다.
 * 다른 앱으로 갔다 오면 브라우저가 풀어 버리므로 다시 보일 때 다시 잡는다. 지원하지 않으면 아무것도 하지 않는다.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as WakeNavigator | undefined;
    if (!active || !nav?.wakeLock) return;
    let sentinel: WakeSentinel | null = null;
    let alive = true;
    const acquire = () => {
      if (document.visibilityState !== 'visible' || sentinel) return;
      nav
        .wakeLock!.request('screen')
        .then((s) => {
          if (!alive) {
            void s.release().catch(() => {});
            return;
          }
          sentinel = s;
          s.addEventListener?.('release', () => {
            if (sentinel === s) sentinel = null;
          });
        })
        .catch(() => {});
    };
    const onVisible = () => acquire();
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}

type Connection = EventTarget & { saveData?: boolean; type?: string; effectiveType?: string };

const connection = (): Connection | undefined =>
  typeof navigator !== 'undefined' ? (navigator as Navigator & { connection?: Connection }).connection : undefined;

/** 지금 데이터를 아껴야 하는 연결인지: 데이터 절약 모드, 모바일 데이터(셀룰러), 느린 연결 */
export function isMeteredConnection(c: Connection | undefined = connection()): boolean {
  if (!c) return false;
  return !!c.saveData || c.type === 'cellular' || ['slow-2g', '2g', '3g'].includes(c.effectiveType ?? '');
}

/** 데이터 절약: 'on'은 늘, 'auto'는 모바일 데이터일 때만 (연결이 바뀌면 따라간다) */
export function useDataSaver(mode: 'off' | 'auto' | 'on'): boolean {
  const [metered, setMetered] = useState(() => isMeteredConnection());
  useEffect(() => {
    const c = connection();
    if (mode !== 'auto' || !c?.addEventListener) return;
    const on = () => setMetered(isMeteredConnection(c));
    on();
    c.addEventListener('change', on);
    return () => c.removeEventListener('change', on);
  }, [mode]);
  return mode === 'on' || (mode === 'auto' && metered);
}
