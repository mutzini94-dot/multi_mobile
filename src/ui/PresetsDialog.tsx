import { useState, type FormEvent } from 'react';
import { deletePreset, listPresets, savePreset, type Preset } from '../app/presets';
import type { ViewState } from '../domain/types';
import { LAYOUT_LABEL, visibleSlots } from '../layout/layouts';
import type { KV } from '../storage/safeStorage';

interface Props {
  kv: KV;
  current: ViewState; // 저장할 지금 구성 (분리한 칸은 원래 내용으로)
  onLoad(view: ViewState): void;
  onClose(): void;
}

const summary = (p: Preset) => {
  const names = visibleSlots(p.view).filter((s) => s).map((s) => s!.name);
  return `${LAYOUT_LABEL[p.view.layout]} · ${names.length ? names.join(', ') : '빈 화면'}`;
};

/** 화면 구성: 지금 레이아웃·칸 구성을 이름 붙여 저장하고 한 번에 불러온다 */
export function PresetsDialog({ kv, current, onLoad, onClose }: Props) {
  const [list, setList] = useState(() => listPresets(kv));
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = savePreset(kv, name, current);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setList(r.value);
    setName('');
    setError(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="화면 구성" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>화면 구성</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        <form className="page-tab__form" onSubmit={submit}>
          <input aria-label="구성 이름" value={name} placeholder="예: 저녁 방송 세트" maxLength={30} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn--donate">
            지금 구성 저장
          </button>
        </form>
        {error && <p className="form-error">{error}</p>}
        <p className="muted">같은 이름으로 저장하면 덮어씁니다.</p>
        {list.length === 0 ? (
          <p className="muted">저장한 구성이 없습니다.</p>
        ) : (
          <ul className="preset-list">
            {list.map((p) => (
              <li key={p.id}>
                <span className="preset-list__text">
                  <strong>{p.name}</strong>
                  <span className="muted">{summary(p)}</span>
                </span>
                <button type="button" className="btn btn--ghost btn--sm" aria-label={`${p.name} 불러오기`} onClick={() => onLoad(p.view)}>
                  불러오기
                </button>
                <button type="button" className="btn btn--icon" aria-label={`${p.name} 삭제`} onClick={() => setList(deletePreset(kv, p.id))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
