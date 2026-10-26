import type { Creator } from '../domain/types';

interface Props {
  creator: Creator;
  onConfirm(): void;
  onCancel(): void;
  action?: 'donate' | 'favorite'; // favorite: 링크 크리에이터를 즐겨찾기에 추가
  replacingDonateId?: string; // 같은 채널의 기존 즐겨찾기 후원 아이디 (바뀌는 경우)
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

export function ConfirmDialog({ creator, onConfirm, onCancel, action = 'donate', replacingDonateId }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal modal--small" role="dialog" aria-label="후원 대상 확인">
        <h2>후원 대상 확인</h2>
        <p>
          합방 링크로 받은 정보는 검증되지 않았습니다. 이 방송(채널)의 후원 아이디가 {creator.donateId}가 맞는지 확인하세요.
        </p>
        {replacingDonateId && (
          <p className="form-error">
            기존 즐겨찾기의 후원 아이디 {replacingDonateId}가 {creator.donateId}로 바뀝니다.
          </p>
        )}
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
            {action === 'favorite' ? '확인하고 추가' : '확인하고 후원'}
          </button>
        </div>
      </div>
    </div>
  );
}
