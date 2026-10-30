import { useEffect, useState } from 'react';
import { monthKey, monthTotal, summarize, type DonationRecord } from '../toonation/history';

interface Props {
  load(): Promise<DonationRecord[]>; // 새로 불러오기
  cash: number | null; // 캐시 잔액
  monthlyLimit: number; // 0이면 한도 없음
  monthlyGoal?: number; // 0이면 목표 없음
  onDonate?(tag: string, name: string): void; // 크리에이터별 목록에서 바로 후원
  onCharge?(): void; // 캐시 충전 (투네이션 충전 페이지)
  onClose(): void;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const monthLabel = (m: string) => `${Number(m.slice(0, 4))}년 ${Number(m.slice(5))}월`;

/** 내 후원 내역: 이번 달 합계(한도), 월별·크리에이터별 합계 (최근 13개월) */
export function HistoryDialog({ load, cash, monthlyLimit, monthlyGoal = 0, onCharge, onDonate, onClose }: Props) {
  const [items, setItems] = useState<DonationRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    load().then(
      (r) => alive && setItems(r),
      (e: Error) => alive && setError(e.message === 'NOT_LOGGED_IN' ? '투네이션에 로그인해야 볼 수 있습니다' : '후원 내역을 불러오지 못했습니다'),
    );
    return () => {
      alive = false;
    };
  }, [load]);

  const now = Date.now();
  const s = items ? summarize(items) : null;
  const thisMonth = items ? monthTotal(items, now) : 0;
  const ratio = monthlyLimit > 0 ? Math.min(1, thisMonth / monthlyLimit) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal history" role="dialog" aria-label="내 후원 내역" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>내 후원 내역</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="history__cards">
          <div className="history__card">
            <span className="muted">캐시 잔액</span>
            <strong>{cash === null ? '-' : `${cash.toLocaleString('ko-KR')} 캐시`}</strong>
            {onCharge && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onCharge}>
                충전
              </button>
            )}
          </div>
          <div className="history__card">
            <span className="muted">이번 달 ({monthLabel(monthKey(now))})</span>
            <strong>{items ? won(thisMonth) : '…'}</strong>
            {monthlyLimit > 0 && (
              <>
                <span className={`history__bar${thisMonth >= monthlyLimit ? ' history__bar--over' : ''}`} aria-hidden="true">
                  <i style={{ width: `${ratio * 100}%` }} />
                </span>
                <span className="muted">한도 {won(monthlyLimit)}</span>
              </>
            )}
            {monthlyGoal > 0 && (
              <>
                <span className="history__bar history__bar--goal" aria-hidden="true">
                  <i style={{ width: `${Math.min(1, thisMonth / monthlyGoal) * 100}%` }} />
                </span>
                <span className="muted">
                  목표 {won(monthlyGoal)} · {Math.floor((thisMonth / monthlyGoal) * 100)}%
                </span>
              </>
            )}
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        {!items && !error && <p className="muted">불러오는 중…</p>}
        {s && s.months.length === 0 && <p className="muted">최근 13개월 동안 후원한 내역이 없습니다.</p>}
        {s && s.months.length > 0 && (
          <div className="history__cols">
            <section>
              <h3>크리에이터별</h3>
              <ul className="history__list" aria-label="크리에이터별">
                {s.creators.map((c) => (
                  <li key={c.tag || c.creator}>
                    <span>{c.creator || c.tag}</span>
                    <span className="history__right">
                      <span className="muted">
                        {won(c.total)} · {c.count}회
                      </span>
                      {onDonate && /^[A-Za-z0-9_-]{1,64}$/.test(c.tag) && (
                        <button type="button" className="btn btn--ghost btn--sm" aria-label={`${c.creator || c.tag} 후원하기`} onClick={() => onDonate(c.tag, c.creator || c.tag)}>
                          후원
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3>월별</h3>
              <ul className="history__list" aria-label="월별">
                {s.months.map((m) => (
                  <li key={m.month}>
                    <span>{monthLabel(m.month)}</span>
                    <span className="muted">
                      {won(m.total)} · {m.count}회
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
        <p className="muted">최근 13개월 내역입니다. 자세한 내역은 투네이션 마이페이지에서 볼 수 있습니다.</p>
      </div>
    </div>
  );
}
