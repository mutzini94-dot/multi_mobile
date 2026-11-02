import { useState, type FormEvent } from 'react';
import { makeActivityPage, makeChatPage, makeDonatePage, makeWebPage } from '../domain/pages';
import type { PageSlot } from '../domain/types';

/** 불러오기 창 '활동 위젯' 탭 */
export function ActivityPageTab({ onPick }: { onPick(p: PageSlot): void }) {
  return (
    <div className="page-tab">
      <p>즐겨찾기했거나 후원한 적 있는 크리에이터 중 지금 방송 중인 사람과, 내가 본 방송·후원·설정 변경 기록을 이 칸에 모아 보여 줍니다. 방송을 누르면 첫 번째 칸에 뜹니다.</p>
      <button type="button" className="btn btn--donate" onClick={() => onPick(makeActivityPage())}>
        활동 위젯 칸 넣기
      </button>
    </div>
  );
}

/** 불러오기 창 '후원 페이지' 탭 */
export function DonatePageTab({ onPick, desktop }: { onPick(p: PageSlot): void; desktop: boolean }) {
  return (
    <div className="page-tab">
      <p>선택한 방송 크리에이터의 투네이션 후원 페이지를 이 칸에 띄웁니다. 다른 방송 칸을 선택하면 그 크리에이터의 후원 페이지로 바뀝니다.</p>
      {!desktop && <p className="muted">웹에서는 후원 페이지를 칸 안에 띄울 수 없어 칸에서 새 창으로 엽니다. 설치형은 칸 안에 바로 표시됩니다.</p>}
      <button type="button" className="btn btn--donate" onClick={() => onPick(makeDonatePage())}>
        후원 페이지 칸 넣기
      </button>
    </div>
  );
}

/** 불러오기 창 '채팅' 탭 */
export function ChatPageTab({ onPick, desktop }: { onPick(p: PageSlot): void; desktop: boolean }) {
  return (
    <div className="page-tab">
      <p>선택한 방송의 트위치·유튜브 라이브 채팅을 이 칸에 띄웁니다. 다른 방송 칸을 선택하면 그 방송의 채팅으로 바뀝니다.</p>
      <p className="muted">
        {desktop
          ? '채팅을 쓰려면 채팅 칸에서 트위치·유튜브에 로그인하세요 (한 번 로그인하면 유지됩니다).'
          : '웹에서는 채팅 보기만 됩니다. 채팅 입력은 설치형에서 로그인해 쓸 수 있습니다.'}
      </p>
      <button type="button" className="btn btn--donate" onClick={() => onPick(makeChatPage())}>
        채팅 칸 넣기
      </button>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['네이버', 'https://www.naver.com/'],
  ['유튜브', 'https://www.youtube.com/'],
  ['트위치', 'https://www.twitch.tv/'],
  ['투네이션', 'https://toon.at/donator'],
];

/** 불러오기 창 '웹페이지' 탭: 원하는 사이트 주소를 직접 넣어 연다 */
export function WebPageTab({ onPick, desktop }: { onPick(p: PageSlot): void; desktop: boolean }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const open = (input: string) => {
    const r = makeWebPage(input);
    if (r.ok) onPick(r.value);
    else setError(r.error);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    open(url);
  };
  return (
    <div className="page-tab">
      <form className="page-tab__form" onSubmit={submit}>
        <input aria-label="웹 주소" value={url} placeholder="예: naver.com, https://…" onChange={(e) => setUrl(e.target.value)} autoFocus />
        <button type="submit" className="btn btn--donate">
          열기
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      <div className="page-tab__shortcuts">
        {SHORTCUTS.map(([label, u]) => (
          <button key={label} type="button" className="btn btn--ghost btn--sm" onClick={() => open(u)}>
            {label}
          </button>
        ))}
      </div>
      {!desktop && <p className="muted">사이트에 따라 칸 안에 표시되지 않을 수 있습니다. 그때는 칸의 ↗ 버튼으로 새 창에서 여세요. 설치형은 모든 사이트가 표시됩니다.</p>}
    </div>
  );
}
