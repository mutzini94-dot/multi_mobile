import type { Creator } from '../domain/types';

interface Props {
  creator: Creator;
  onConfirm(): void;
  onCancel(): void;
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

export function ConfirmDialog({ creator, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal modal--small" role="dialog" aria-label="후원 대상 확인">
        <h2>후원 대상 확인</h2>
        <p>
          합방 링크로 받은 정보는 검증되지 않았습니다. 이 방송(채널)의 후원 아이디가 {creator.donateId}가 맞는지 확인하세요.
        </p>
        <dl className="confirm-info">
          <dt>방송</dt>
          <dd>
            {creator.name} · {PLATFORM_LABEL[creator.platform]} · {creator.channel}
          </dd>
          <dt>후원 페이지</dt>
          <dd>toon.at/donate/{creator.donateId}</dd>
        </dl>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="btn btn--donate" onClick={onConfirm}>
            확인하고 후원
          </button>
        </div>
      </div>
    </div>
  );
}
