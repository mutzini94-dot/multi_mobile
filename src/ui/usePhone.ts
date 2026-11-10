import { useEffect, useState } from 'react';

/** 휴대폰 폭: 이 아래에서는 창을 세로로 쌓고, 상단 메뉴를 '메뉴' 시트로, 퀵패널을 하단 바로 바꾼다 (app.css의 같은 값) */
export const PHONE_QUERY = '(max-width: 640px), (orientation: landscape) and (max-height: 500px) and (pointer: coarse)';
/** 휴대폰을 가로로 돌린 상태 (높이가 낮고 손가락으로 쓰는 화면): 휴대폰 배치 그대로 2열로 */
export const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 500px) and (pointer: coarse)';

const query = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : null);

/** 지금 휴대폰 폭인지 (창 크기가 바뀌면 따라간다) */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => !!query()?.matches);
  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return phone;
}
