import { useState, type FormEvent } from 'react';
import type { CreatorInput, Result } from '../domain/creatorInput';
import type { Creator, Platform } from '../domain/types';

interface Props {
  initial: Creator | null;
  submitLabel: string; // '저장하고 개설' | '저장'
  onSave(input: CreatorInput): Result<Creator>;
  onCancel(): void;
}

/** 합동 방송 호스트(나)의 방송 정보: 이 합방의 후원은 여기 적은 후원 아이디로만 간다. */
export function HostProfileDialog({ initial, submitLabel, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [platform, setPlatform] = useState<Platform>(initial?.platform ?? 'twitch');
  const [channel, setChannel] = useState(initial?.channel ?? '');
  const [donateId, setDonateId] = useState(initial?.donateId ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = onSave({ name, platform, channel, donateId });
    if (!r.ok) setError(r.error);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--small" role="dialog" aria-label="내 방송 정보" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>내 방송 정보</h2>
        </div>
        <p>합방의 1번 칸에 고정되는 호스트 방송입니다. 이 합방에서 들어오는 후원은 모두 아래 후원 아이디로 갑니다.</p>
        <form className="fav-form" onSubmit={submit}>
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
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              취소
            </button>
            <button type="submit" className="btn btn--donate">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
