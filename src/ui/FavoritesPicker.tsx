import { useState, type FormEvent, type ReactNode } from 'react';
import { parseSharedLink } from '../app/sharedLink';
import { makeCreator } from '../domain/creatorInput';
import type { Creator, Platform } from '../domain/types';
import type { FavoritesSource } from '../favorites/favorites';

interface Props {
  source: FavoritesSource;
  onPick(c: Creator): void;
  onClose(): void;
  children?: ReactNode; // 맨 위에 넣을 내용 (투네이션 즐겨찾기)
  tabs?: { label: string; content: ReactNode }[]; // '방송' 탭 뒤의 탭들 (투네이션 라이브·후원 페이지·웹페이지)
  filter?(c: Creator): boolean; // 그룹으로 거르기
  rowExtra?(c: Creator): ReactNode; // 그룹 편집 중 줄마다 그룹 고르기
  findLink?(text: string): Promise<Creator | null>; // 유튜브·트위치 주소 → 투네이션에 등록된 크리에이터 (못 찾으면 null)
  compact?: boolean; // 휴대폰: 직접 추가 양식을 접어 둔다
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

/** 왼쪽 메뉴 아이콘 (탭 이름별) */
const TAB_ICON: Record<string, string> = { 방송: '▶', '투네이션 라이브': '●', '활동 위젯': '◷', '후원 페이지': '♥', 시그니처: '✦', 채팅: '💬', 웹페이지: '🌐' };

export function FavoritesPicker({ source, onPick, onClose, children, tabs = [], filter, rowExtra, findLink, compact = false }: Props) {
  const [tab, setTab] = useState(0); // 0: 방송
  const [list, setList] = useState(() => source.list());
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<Platform>('twitch');
  const [channel, setChannel] = useState('');
  const [donateId, setDonateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(!compact);

  // 주소 붙여넣기: 투네이션에 등록된 방송이면 바로 넣고, 아니면 직접 추가 양식을 채워 둔다
  const tryLink = async (text: string) => {
    const t = parseSharedLink(text.trim());
    if (!t) {
      setLinkMsg('유튜브·트위치 방송 주소를 붙여넣어 주세요');
      return;
    }
    setLinkBusy(true);
    setLinkMsg(null);
    const found = await (findLink?.(text.trim()) ?? Promise.resolve(null)).catch(() => null);
    setLinkBusy(false);
    if (found) {
      onPick(found);
      return;
    }
    // 후원 대상은 짐작하지 않는다: 채널만 채우고 후원 아이디는 직접
    setFormOpen(true);
    setPlatform(t.platform);
    if (t.platform === 'twitch') {
      setChannel(t.channel);
      setName((n) => n || t.channel);
    } else if (t.channel) setChannel(t.channel);
    setLinkMsg(
      t.platform === 'youtube' && !t.channel
        ? '투네이션에서 이 방송을 찾지 못했습니다. 아래에 채널 ID(UC로 시작)와 후원 아이디를 넣어 주세요'
        : '투네이션에서 이 방송을 찾지 못했습니다. 아래에 후원 아이디를 넣고 추가해 주세요',
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = makeCreator({ name, platform, channel, donateId }, 'manual');
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setList(source.add(r.value));
    setName('');
    setChannel('');
    setDonateId('');
    setError(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal picker${tabs.length ? ' picker--nav' : ''}`} role="dialog" aria-label="불러오기" onClick={(e) => e.stopPropagation()}>
        <div className="picker__head">
          <div>
            <h2>불러오기</h2>
            <p className="picker__sub">이 창에 넣을 방송이나 페이지를 고르세요</p>
          </div>
          <button type="button" className="picker__close" aria-label="닫기" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="picker__body">
        {tabs.length > 0 && (
          <div className="picker__tabs" role="tablist" aria-orientation="vertical">
            {['방송', ...tabs.map((t) => t.label)].map((label, i) => (
              <button key={label} type="button" role="tab" aria-selected={tab === i} className={`picker__tab${tab === i ? ' picker__tab--on' : ''}`} data-icon={TAB_ICON[label] ?? '•'} onClick={() => setTab(i)}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="picker__content">
        {tab > 0 ? (
          <div role="tabpanel" aria-label={tabs[tab - 1].label}>
            {tabs[tab - 1].content}
          </div>
        ) : (
          <div role={tabs.length ? 'tabpanel' : undefined} aria-label={tabs.length ? '방송' : undefined}>
        <form
          className="link-add"
          onSubmit={(e) => {
            e.preventDefault();
            void tryLink(link);
          }}
        >
          <label className="link-add__label" htmlFor="link-add-input">
            방송 주소로 바로 넣기
          </label>
          <div className="link-add__row">
            <input
              id="link-add-input"
              type="url"
              inputMode="url"
              value={link}
              placeholder="유튜브·트위치 주소 붙여넣기"
              onChange={(e) => setLink(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (parseSharedLink(text.trim())) {
                  e.preventDefault();
                  setLink(text.trim());
                  void tryLink(text);
                }
              }}
            />
            <button type="submit" className="btn btn--donate" disabled={!link.trim() || linkBusy}>
              {linkBusy ? '찾는 중…' : '넣기'}
            </button>
          </div>
          {linkMsg && <p className="link-add__msg" role="status">{linkMsg}</p>}
        </form>
        {children}
        <h3>직접 추가한 크리에이터</h3>
        {list.length === 0 ? (
          <p className="muted">아직 즐겨찾기가 없습니다. 아래에서 크리에이터를 추가하세요.</p>
        ) : (
          <ul className="fav-list">
            {list.filter((c) => !filter || filter(c)).map((c) => (
              <li key={c.key}>
                <button type="button" className="fav-item" onClick={() => onPick(c)}>
                  {c.name}
                  <span className="muted"> · {PLATFORM_LABEL[c.platform]} · {c.channel}</span>
                </button>
                {rowExtra?.(c)}
                <button type="button" className="btn btn--ghost" aria-label={`${c.name} 삭제`} onClick={() => setList(source.remove(c.key))}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        {!formOpen ? (
          <button type="button" className="btn btn--ghost fav-form__open" onClick={() => setFormOpen(true)}>
            크리에이터 직접 입력해서 추가
          </button>
        ) : (
        <form className="fav-form" onSubmit={submit}>
          <h3>크리에이터 직접 추가</h3>
          <label>
            이름
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            플랫폼
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              <option value="twitch">Twitch</option>
              <option value="youtube">YouTube</option>
            </select>
          </label>
          <label>
            채널
            <input
              value={channel}
              placeholder={platform === 'youtube' ? 'UC로 시작하는 채널 ID 또는 채널 주소' : '트위치 아이디 또는 주소'}
              onChange={(e) => setChannel(e.target.value)}
            />
          </label>
          <label>
            투네이션 후원 아이디
            <input value={donateId} placeholder="toon.at/donate/… 의 아이디" onChange={(e) => setDonateId(e.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn--donate">
            추가
          </button>
        </form>
        )}
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
