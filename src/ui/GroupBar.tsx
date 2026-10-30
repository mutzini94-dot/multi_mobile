import { useState } from 'react';
import type { Creator } from '../domain/types';
import type { FavoriteGroups } from '../favorites/groups';

/** 불러오기 창 '방송' 탭: 그룹 칩(전체·그룹별)과 그룹 편집 켜고 끄기 */
export function GroupBar({ groups, active, onActive, editing, onEditing }: { groups: FavoriteGroups; active: string | null; onActive(g: string | null): void; editing: boolean; onEditing(v: boolean): void }) {
  return (
    <div className="group-bar">
      {(groups.names.length > 0 || editing) && (
        <button type="button" className={`chip chip--small group-bar__chip${active === null ? ' group-bar__chip--on' : ''}`} aria-label="그룹 전체" onClick={() => onActive(null)}>
          전체
        </button>
      )}
      {groups.names.map((g) => (
        <span key={g} className="group-bar__item">
          <button type="button" className={`chip chip--small group-bar__chip${active === g ? ' group-bar__chip--on' : ''}`} aria-label={`그룹 ${g}`} onClick={() => onActive(g)}>
            {g}
          </button>
          {editing && (
            <button
              type="button"
              className="btn btn--icon group-bar__remove"
              aria-label={`그룹 ${g} 지우기`}
              onClick={() => {
                groups.remove(g);
                if (active === g) onActive(null);
              }}
            >
              ✕
            </button>
          )}
        </span>
      ))}
      <button type="button" className="btn btn--text group-bar__edit" aria-label={editing ? '그룹 편집 끝' : '그룹 편집'} onClick={() => onEditing(!editing)}>
        {editing ? '완료' : '그룹 편집'}
      </button>
    </div>
  );
}

/** 그룹 편집 중 즐겨찾기 한 줄 옆: 그룹 고르기 (새 그룹 만들기 포함) */
export function GroupSelect({ creator, groups }: { creator: Creator; groups: FavoriteGroups }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  if (adding) {
    return (
      <span className="group-select">
        <input aria-label="새 그룹 이름" value={name} maxLength={20} placeholder="새 그룹" onChange={(e) => setName(e.target.value)} autoFocus />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          aria-label="그룹 만들기"
          onClick={() => {
            if (name.trim()) groups.assign(creator, name);
            setAdding(false);
            setName('');
          }}
        >
          확인
        </button>
      </span>
    );
  }
  return (
    <select
      className="group-select"
      aria-label={`${creator.name} 그룹`}
      value={groups.groupOf(creator) ?? ''}
      onChange={(e) => {
        if (e.target.value === '__new') setAdding(true);
        else groups.assign(creator, e.target.value || null);
      }}
    >
      <option value="">그룹 없음</option>
      {groups.names.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
      <option value="__new">+ 새 그룹</option>
    </select>
  );
}
