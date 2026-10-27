import type { ReactNode } from 'react';
import type { Creator } from '../domain/types';

interface Props {
  popupCreator: Creator | null;
  warning: string | null;
  message: string | null;
  children?: ReactNode; // 설치형 PIP 후원창 상태 등
}

/** 시안의 BOTTOM 영역: 현재 후원 창 대상, 대상 불일치 경고, 알림 */
export function DonationBar({ popupCreator, warning, message, children }: Props) {
  return (
    <footer className="donation-bar">
      {popupCreator && <span className="donation-bar__target">현재 후원 창: {popupCreator.name}</span>}
      {warning && (
        <span role="alert" className="donation-bar__warning">
          {warning}
        </span>
      )}
      {message && <span className="donation-bar__message">{message}</span>}
      {children}
    </footer>
  );
}
