import { useEffect } from 'react';

/** 투네이션 홈 (문의·공지는 투네이션 사이트에서) */
export const SUPPORT_URL = 'https://toonation.co.kr';

/** 단축키 목록: App의 단축키 처리와 같아야 한다 */
export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '1 ~ 9', label: '칸 선택 (그 칸 소리만 나오고 후원 대상이 됩니다)' },
  { keys: 'M', label: '전체 음소거 · 해제' },
  { keys: 'F', label: '선택한 칸 전체 화면' },
  { keys: 'D', label: '후원하기 (선택한 칸의 크리에이터)' },
  { keys: 'Esc', label: '전체 화면 · 창 닫기' },
  { keys: '?', label: '단축키 안내' },
];

const FAQ: { q: string; a: string }[] = [
  { q: '방송은 어떻게 띄우나요?', a: '빈 칸의 "불러오기", 왼쪽 퀵패널의 즐겨찾기·최근 본 크리에이터, 상단 추천 라이브에서 고르면 넣을 칸을 묻습니다. 카드나 프로필을 칸으로 끌어 놓아도 됩니다.' },
  { q: '후원하기 버튼이 눌리지 않아요', a: '후원할 방송 칸을 먼저 선택하세요. 칸을 누르거나 숫자 키 1~9로 선택하면 그 크리에이터에게 후원할 수 있습니다.' },
  { q: '투네이션 즐겨찾기가 보이지 않아요', a: '"불러오기" 창에서 투네이션에 로그인하면 즐겨찾기한 크리에이터를 불러옵니다. 웹 버전은 연동 확장 프로그램이 필요합니다.' },
  { q: '트위치 방송이 자동으로 재생되지 않아요', a: '트위치는 영상이 다른 창에 가려진 채 시작하면 자동 재생을 막습니다. 방송을 넣은 직후 다른 창을 열었다면 영상의 재생 버튼을 한 번 눌러 주세요.' },
  { q: '창(칸)을 늘리거나 줄이고 싶어요', a: '상단 레이아웃 버튼으로 모양을 바꾸거나, 퀵패널 맨 아래 + 로 원하는 자리에 창을 추가합니다. 빈 칸 오른쪽 위 ✕ 로 빈 창을 지울 수 있습니다.' },
  { q: '칸을 따로 창으로 띄우고 싶어요', a: '칸 위쪽 바의 ⧉(새 창으로 분리)를 누르거나, 칸을 끌어 앱 창 밖에 놓으면 그 자리에 분리 창이 뜹니다. 분리 창의 위쪽 바를 끌어 메인 창의 칸에 놓으면 그 칸으로 돌아옵니다(내용이 있으면 자리 바꾸기).' },
  { q: '화면 구성을 저장해 두고 싶어요', a: '상단 "화면 구성"에서 지금 화면에 이름을 붙여 저장하고 한 번에 불러옵니다.' },
  { q: '다른 PC로 설정을 옮기고 싶어요', a: '설정 > 백업·안내에서 "백업 파일 저장"으로 파일을 만들고, 다른 PC에서 "백업 불러오기"로 되살립니다. 즐겨찾기·화면 구성·창 크기까지 함께 옮겨집니다.' },
  { q: '크리에이터 리모컨은 무엇인가요?', a: '상단 스위치로 바꾸는 크리에이터용 리모컨입니다. 설치형에서는 실시간 후원 수신·위젯 분리 창·전역 단축키를 쓸 수 있습니다.' },
];

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** 단축키 안내 (? 키) */
export function ShortcutsDialog({ enabled, onClose }: { enabled: boolean; onClose(): void }) {
  useEscape(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-dialog" role="dialog" aria-label="단축키" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>단축키</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        {!enabled && <p className="help-dialog__note">단축키가 꺼져 있습니다. 설정 &gt; 화면에서 켤 수 있어요 (? 안내는 언제나 열립니다).</p>}
        <dl className="shortcut-list">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="shortcut-list__row">
              <dt>
                <kbd>{s.keys}</kbd>
              </dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
        <p className="muted help-dialog__foot">글자를 입력하는 중이거나 다른 창이 열려 있으면 단축키는 동작하지 않습니다.</p>
      </div>
    </div>
  );
}

/** 도움말: 자주 묻는 질문 · 단축키 · 둘러보기 · 투네이션 홈 */
export function HelpDialog({ onShortcuts, onTour, onOpenSite, onClose }: { onShortcuts(): void; onTour(): void; onOpenSite(): void; onClose(): void }) {
  useEscape(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-dialog" role="dialog" aria-label="도움말" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>도움말</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="help-dialog__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onShortcuts}>
            단축키 보기
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onTour}>
            둘러보기 다시 보기
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenSite}>
            투네이션 홈
          </button>
        </div>
        <h3 className="help-dialog__title">자주 묻는 질문</h3>
        <ul className="faq" aria-label="자주 묻는 질문">
          {FAQ.map((f) => (
            <li key={f.q}>
              <details>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
