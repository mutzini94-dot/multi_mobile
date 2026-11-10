/** 취침 타이머: 고른 시간이 지나면 소리를 끄고 방송을 멈춘다 */
export const SLEEP_OPTIONS = [15, 30, 60, 90] as const;

export function SleepTimerDialog({ remainingMin, onPick, onCancel, onClose }: { remainingMin: number | null; onPick(min: number): void; onCancel(): void; onClose(): void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sleep-dialog" role="dialog" aria-label="취침 타이머" onClick={(e) => e.stopPropagation()}>
        <h2>취침 타이머</h2>
        <p className="muted">{remainingMin !== null ? `${remainingMin}분 뒤에 소리를 끄고 방송을 멈춥니다.` : '고른 시간이 지나면 소리를 끄고 방송을 멈춥니다.'}</p>
        <div className="sleep-dialog__options">
          {SLEEP_OPTIONS.map((m) => (
            <button key={m} type="button" className="btn btn--ghost" onClick={() => onPick(m)}>
              {m < 60 ? `${m}분` : m === 60 ? '1시간' : '1시간 30분'}
            </button>
          ))}
        </div>
        <div className="sleep-dialog__foot">
          {remainingMin !== null && (
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              타이머 끄기
            </button>
          )}
          <button type="button" className="btn btn--donate" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
