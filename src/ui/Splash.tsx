import { useEffect, useState } from 'react';
import logoUrl from '../assets/logo.png';

/** 로고를 최소 이만큼은 보여 준다 (덮개가 걷히는 모습이 끝날 만큼) */
export const SPLASH_MIN_MS = 800;
/** 준비가 늦어도 이 시간 뒤에는 닫는다 */
export const SPLASH_MAX_MS = 2500;
/** 닫을 때 흐려지는 시간 */
const FADE_MS = 250;

/**
 * 시작 로딩 화면: 앱이 뒤에서 불러오는 동안 투네이션 로고를 덮개가 걷히듯 보여 준다.
 * 화면 글꼴이 준비되면(최소 SPLASH_MIN_MS) 바로 흐려지며 닫히고, 늦어도 SPLASH_MAX_MS에는 닫힌다.
 */
export function Splash() {
  const [phase, setPhase] = useState<'shown' | 'fading' | 'gone'>('shown');
  useEffect(() => {
    let done = false;
    let ready = false;
    let minPassed = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const close = () => {
      if (done) return;
      done = true;
      setPhase('fading');
      timers.push(setTimeout(() => setPhase('gone'), FADE_MS));
    };
    const tryClose = () => ready && minPassed && close();
    timers.push(
      setTimeout(() => {
        minPassed = true;
        tryClose();
      }, SPLASH_MIN_MS),
    );
    timers.push(setTimeout(close, SPLASH_MAX_MS));
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    (fonts ? fonts.ready : Promise.resolve()).then(() => {
      ready = true;
      tryClose();
    });
    return () => {
      done = true;
      timers.forEach(clearTimeout);
    };
  }, []);
  if (phase === 'gone') return null;
  return (
    <div className={`splash${phase === 'fading' ? ' splash--out' : ''}`} role="status" aria-label="불러오는 중">
      <div className="splash__box">
        <img className="splash__logo" src={logoUrl} alt="" />
        <span className="splash__cover" aria-hidden="true" />
      </div>
    </div>
  );
}
