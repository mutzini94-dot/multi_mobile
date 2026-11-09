import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';

interface Props {
  url: string;
  onClose(): void;
}

/** 화면 구성 공유: 링크 복사 · 휴대폰 공유하기 · QR (PC에서 만든 구성을 휴대폰 카메라로 바로 연다) */
export function ShareDialog({ url, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const svg = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch {
      return null; // 너무 긴 주소
    }
  }, [url]);
  const nav = navigator as Navigator & { share?(d: ShareData): Promise<void> };
  const copy = () => {
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal share-dialog" role="dialog" aria-label="화면 구성 공유" onClick={(e) => e.stopPropagation()}>
        <div className="share-dialog__head">
          <h2>화면 구성 공유</h2>
          <button type="button" className="btn btn--icon" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted">지금 띄운 방송과 배치를 그대로 여는 링크입니다. 휴대폰 카메라로 QR을 찍어도 됩니다.</p>
        {svg && <div className="share-dialog__qr" role="img" aria-label="공유 QR 코드" dangerouslySetInnerHTML={{ __html: svg }} />}
        <input className="share-dialog__url" readOnly value={url} aria-label="공유 링크" onFocus={(e) => e.currentTarget.select()} />
        <div className="share-dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={copy}>
            {copied ? '복사했습니다' : '링크 복사'}
          </button>
          {nav.share && (
            <button type="button" className="btn btn--donate" onClick={() => nav.share!({ title: '투네이션 멀티뷰 화면 구성', url }).catch(() => {})}>
              공유하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
