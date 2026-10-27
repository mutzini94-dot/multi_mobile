import { useState } from 'react';

interface Props {
  url: string | null; // null: 시청 페이지 주소를 모름 (설치형·localhost)
  onApplyBase(base: string): string | null; // 오류 메시지 또는 null
  onCopy(url: string): Promise<boolean>;
  onRegenerate(): void;
  onClose(): void;
}

/** 방송 시작하기: 시작한 순간의 구성으로 고정된 합방 URL을 보여주고 복사한다. */
export function JointShareDialog({ url, onApplyBase, onCopy, onRegenerate, onClose }: Props) {
  const [base, setBase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="합방 방송 URL" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>합방 방송 URL</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        {url ? (
          <>
            <p>이 URL을 시청자에게 공유하세요. 시청자의 후원은 모두 호스트에게 갑니다.</p>
            <div className="share-url">
              <input aria-label="방송 URL" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                className="btn btn--donate"
                onClick={async () => setCopied((await onCopy(url)) ? 'ok' : 'fail')}
              >
                URL 복사
              </button>
            </div>
            {copied === 'ok' && <p className="share-url__ok">복사했습니다</p>}
            {copied === 'fail' && <p className="form-error">복사하지 못했습니다. 위 주소를 직접 선택해 복사하세요</p>}
            <p className="muted share-url__note">
              이 URL은 방송을 시작한 순간의 구성으로 고정됩니다. 게스트를 바꿨다면 새 URL을 만들어 다시 공유하세요.
            </p>
            <div className="modal__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setCopied(null);
                  onRegenerate();
                }}
              >
                새 URL 만들기
              </button>
            </div>
          </>
        ) : (
          <form
            className="fav-form"
            onSubmit={(e) => {
              e.preventDefault();
              setError(onApplyBase(base.trim()));
            }}
          >
            <p>
              지금 화면은 이 PC에서만 열리는 주소(localhost)라 시청자가 열 수 없습니다. 시청자에게 공유하려면 배포한 멀티뷰 웹 주소를
              입력하세요. 한 번 입력하면 저장됩니다.
            </p>
            <label>
              시청 페이지 주소
              <input value={base} placeholder="https://…" onChange={(e) => setBase(e.target.value)} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal__actions">
              <button type="submit" className="btn btn--donate">
                적용
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
