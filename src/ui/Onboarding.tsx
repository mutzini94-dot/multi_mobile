import { useLayoutEffect, useState, type CSSProperties } from 'react';

/** v2: 퀵패널·창 추가·크리에이터 리모컨 등 새 기능이 생겨 기존 사용자에게도 한 번 더 보여 준다 */
export const ONBOARDED_KEY = 'mv.onboarded.v2';

/** 둘러보기 단계: target = 비출 메뉴 (화면에 없으면 가운데 카드로만 안내) */
export const TOUR_STEPS: { target: string; title: string; body: string }[] = [
  { target: '.gnb__layouts', title: '화면 모양 고르기', body: '방송을 몇 개, 어떤 모양으로 볼지 고릅니다. 기본은 왼쪽 큰 방송 + 오른쪽 후원 페이지인 "큰 화면+1"입니다.' },
  { target: '.tile', title: '방송 불러오기', body: '빈 칸의 "불러오기"로 투네이션 즐겨찾기·라이브 목록·직접 추가한 방송을 넣습니다. 칸 위쪽 바를 끌면 자리를 바꿀 수 있어요.' },
  { target: '.quick-panel__head', title: '퀵패널 · 추천 라이브', body: 'LIVE를 누르면 추천 라이브를 쇼츠처럼 한 개씩 넘겨 봅니다. ★ 즐겨찾기 · 🕘 최근 본 크리에이터를 누르면 넣을 칸을 고를 수 있어요.' },
  { target: '.quick-panel__add', title: '창 추가 · 삭제', body: '+ 로 원하는 자리에 창을 하나 더 만듭니다. 빈 칸 오른쪽 위 ✕ 로 빈 창을 지울 수 있어요.' },
  { target: '.gnb__donate', title: '선택하고 후원하기', body: '칸을 누르면(또는 숫자 키 1~9) 그 방송 소리만 나오고 후원 대상이 됩니다. "후원하기"로 투네이션 후원창을 엽니다.' },
  { target: '.gnb__tools', title: '도구 · 도움말', body: '전체 새로고침·음소거·미니 모드·화면 구성 저장·설정이 모여 있습니다. ? 도움말에서 자주 묻는 질문과 단축키를 볼 수 있어요.' },
];

/** 휴대폰 둘러보기: 휴대폰 상단 바·칸·하단 바 기준 */
export const PHONE_TOUR_STEPS: { target: string; title: string; body: string }[] = [
  { target: '.tile', title: '칸 길게 누르기', body: '칸을 짧게 누르면 그 방송 소리로, 길게 누르면 칸 메뉴(소리·전체 화면·채팅·후원·세로로 보기·즐겨찾기)가 열립니다. 길게 누른 채 끌면 자리를 바꿉니다.' },
  { target: '.gnb__overview', title: '전체보기', body: '띄워 둔 모든 창을 한 화면에 작게 모아 봅니다. 방송을 누르면 그 방송과 채팅이 함께 나옵니다.' },
  { target: '.gnb__chat', title: '채팅 · 후원하기', body: '채팅은 방송을 맨 위로 올리고 그 아래에 채팅을 붙입니다. 후원하기는 지금 고른 방송에 후원합니다.' },
  { target: '.quick-panel', title: '하단 바', body: 'LIVE로 추천 라이브를 넘겨 보고, ★ 즐겨찾기 · 🕘 최근 본 크리에이터를 눌러 바로 넣습니다. + 로 창을 더합니다(최대 6개).' },
  { target: '.gnb__more', title: '메뉴', body: '화면 공유(링크·QR), 취침 타이머, 설정·도움말이 여기에 있습니다.' },
  { target: '.tile', title: '전체 화면에서', body: '좌우로 밀면 다음 방송, 오른쪽을 위아래로 밀면 볼륨입니다. 🔒 화면 잠금으로 터치를 막을 수 있어요.' },
];

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const CARD_W = 340;
const PAD = 6;

function rectOf(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // 숨겨졌거나 화면 밖(휴대폰에서 '메뉴' 시트로 옮긴 메뉴)이면 강조 없이 카드만
  if (!r.width || !r.height || r.right <= 0 || r.bottom <= 0 || r.left >= (window.innerWidth || Infinity) || r.top >= (window.innerHeight || Infinity) || getComputedStyle(el).display === 'none') return { left: 0, top: 0, width: 0, height: 0 };
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** 처음 사용 둘러보기: 실제 메뉴를 차례로 비추고 옆에 설명 카드를 띄운다 (화면은 막지 않는다) */
export function Onboarding({ onDone, steps = TOUR_STEPS }: { onDone(): void; steps?: { target: string; title: string; body: string }[] }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  useLayoutEffect(() => {
    const update = () => setRect(rectOf(step.target));
    update();
    window.addEventListener('resize', update);
    const t = setInterval(update, 500); // 퀵패널·레이아웃이 바뀌어도 따라간다
    return () => {
      window.removeEventListener('resize', update);
      clearInterval(t);
    };
  }, [step.target]);

  // 카드 자리: 비추는 메뉴 아래(공간이 없으면 위·옆), 화면 밖으로 나가지 않게
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  let cardStyle: CSSProperties = {};
  if (rect && rect.width > 0) {
    const below = rect.top + rect.height + PAD + 12;
    const tall = rect.height > vh * 0.6;
    if (tall) {
      // 세로로 긴 메뉴(퀵패널·칸)는 옆에
      const right = rect.left + rect.width + PAD + 12;
      const left = right + CARD_W <= vw - 12 ? right : Math.max(12, rect.left - PAD - 12 - CARD_W);
      cardStyle = { left, top: Math.min(Math.max(12, rect.top + 40), vh - 220) };
    } else {
      const left = Math.min(Math.max(12, rect.left + rect.width / 2 - CARD_W / 2), vw - CARD_W - 12);
      cardStyle = below + 200 < vh ? { left, top: below } : { left, top: Math.max(12, rect.top - PAD - 12 - 200) };
    }
  }

  return (
    <>
      {rect && rect.width > 0 && (
        <div
          className="tour__spot"
          aria-hidden="true"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      )}
      {rect && rect.width === 0 && <div className="tour__spot tour__spot--none" aria-hidden="true" />} {/* 크기가 없는 메뉴(숨김): 강조 없이 카드만 */}
      <section className={`onboarding tour__card${rect && rect.width > 0 ? ' tour__card--anchored' : ''}`} role="region" aria-label="처음 사용 안내" style={cardStyle}>
        <div className="onboarding__head">
          <strong>{step.title}</strong>
          <span className="muted">
            {i + 1} / {steps.length}
          </span>
          <button type="button" className="btn btn--icon" aria-label="안내 닫기" onClick={onDone}>
            ✕
          </button>
        </div>
        <p>{step.body}</p>
        <div className="tour__dots" aria-hidden="true">
          {steps.map((_, k) => (
            <i key={k} className={k === i ? 'on' : undefined} />
          ))}
        </div>
        <div className="onboarding__actions">
          {i > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setI(i - 1)}>
              이전
            </button>
          )}
          <button type="button" className="btn btn--donate btn--sm" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </section>
    </>
  );
}
