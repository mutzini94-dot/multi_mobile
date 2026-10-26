import { useState, type FormEvent, type ReactNode } from 'react';
import { makeCreator } from '../domain/creatorInput';
import type { Creator, Platform } from '../domain/types';
import type { FavoritesSource } from '../favorites/favorites';

interface Props {
  source: FavoritesSource;
  onPick(c: Creator): void;
  onClose(): void;
  children?: ReactNode; // 맨 위에 넣을 내용 (투네이션 즐겨찾기)
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

export function FavoritesPicker({ source, onPick, onClose, children }: Props) {
  const [list, setList] = useState(() => source.list());
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<Platform>('twitch');
  const [channel, setChannel] = useState('');
  const [donateId, setDonateId] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      <div className="modal" role="dialog" aria-label="즐겨찾기에서 불러오기" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>즐겨찾기에서 불러오기</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        {children}
        <h3>직접 추가한 크리에이터</h3>
        {list.length === 0 ? (
          <p className="muted">아직 즐겨찾기가 없습니다. 아래에서 크리에이터를 추가하세요.</p>
        ) : (
          <ul className="fav-list">
            {list.map((c) => (
              <li key={c.key}>
                <button type="button" className="fav-item" onClick={() => onPick(c)}>
                  {c.name}
                  <span className="muted"> · {PLATFORM_LABEL[c.platform]} · {c.channel}</span>
                </button>
                <button type="button" className="btn btn--ghost" aria-label={`${c.name} 삭제`} onClick={() => setList(source.remove(c.key))}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="fav-form" onSubmit={submit}>
          <h3>크리에이터 추가</h3>
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
      </div>
    </div>
  );
}
