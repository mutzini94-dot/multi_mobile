import { useEffect, useState } from 'react';
import logoUrl from '../assets/logo.png';

/** 보이는 시간: toonation.co.kr/main 첫 화면과 같이 2초 뒤 0.5초 동안 흐려진다 */
export const SPLASH_MS = 2500;

/** 시작 로딩 화면: 앱이 뒤에서 불러오는 동안 투네이션 로고를 덮개가 걷히듯 보여 준다 */
export function Splash() {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShown(false), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);
  if (!shown) return null;
  return (
    <div className="splash" role="status" aria-label="불러오는 중">
      <div className="splash__box">
        <img className="splash__logo" src={logoUrl} alt="" />
        <span className="splash__cover" aria-hidden="true" />
      </div>
    </div>
  );
}
