import { useState } from 'react';

export const ONBOARDED_KEY = 'mv.onboarded.v1';

const STEPS: { title: string; body: string }[] = [
  { title: '방송 불러오기', body: '빈 칸의 "불러오기"를 누르면 투네이션 즐겨찾기·라이브 목록·직접 추가한 방송을 고를 수 있습니다. 후원 페이지·채팅·웹페이지도 칸에 넣을 수 있어요.' },
  { title: '선택하고 후원하기', body: '칸을 누르면 그 방송 소리만 나오고 후원 대상이 됩니다. 오른쪽 위 "후원하기"로 투네이션 후원창을 엽니다 (설치형은 모달·PIP).' },
  { title: '자리 옮기기·분리', body: '칸의 위쪽 바나 영상을 잡고 끌면 자리를 바꿉니다. ⧉ 버튼은 그 칸을 새 창으로 분리하고, ⛶는 전체 화면입니다.' },
  { title: '구성 저장·설정', body: '"구성"에서 지금 화면을 이름 붙여 저장해 두고 한 번에 불러옵니다. ⚙ 설정에서 테마·소리·후원 한도·백업을 바꿀 수 있습니다.' },
];

/** 처음 사용 안내: 화면을 막지 않는 작은 카드로 네 장을 넘겨 본다 */
export function Onboarding({ onDone }: { onDone(): void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <section className="onboarding" role="region" aria-label="처음 사용 안내">
      <div className="onboarding__head">
        <strong>{step.title}</strong>
        <span className="muted">
          {i + 1} / {STEPS.length}
        </span>
        <button type="button" className="btn btn--icon" aria-label="안내 닫기" onClick={onDone}>
          ✕
        </button>
      </div>
      <p>{step.body}</p>
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
  );
}
