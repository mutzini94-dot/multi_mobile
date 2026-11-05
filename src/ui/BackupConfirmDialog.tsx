import type { BackupSummary } from '../app/backup';

/** 백업 불러오기 확인: 파일에 무엇이 들어 있는지 보여 주고, 지금 설정을 바꿔도 되는지 묻는다 */
export function BackupConfirmDialog({ summary, onConfirm, onClose }: { summary: BackupSummary; onConfirm(): void; onClose(): void }) {
  const rows: [string, string][] = [];
  if (summary.settings) rows.push(['설정', '테마·소리·후원 메시지·금액 등']);
  if (summary.favorites) rows.push(['직접 추가한 즐겨찾기', `${summary.favorites}개`]);
  if (summary.groups) rows.push(['즐겨찾기 그룹', `${summary.groups}개`]);
  if (summary.presets) rows.push(['화면 구성', `${summary.presets}개`]);
  if (summary.recent) rows.push(['최근 본 방송', `${summary.recent}개`]);
  if (summary.windows) rows.push(['창 크기·위치', '메인 창·후원창·분리 창']);
  const when = summary.savedAt ? new Date(summary.savedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : null;
  return (
    <div className="modal-backdrop modal-backdrop--top" onClick={onClose}>
      <div className="modal backup-confirm" role="dialog" aria-label="백업 불러오기" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>백업 불러오기</h2>
        </div>
        <p className="muted">{when ? `${when}에 저장한 백업입니다. ` : ''}아래 내용으로 지금 설정을 바꾸고 화면을 다시 읽습니다.</p>
        <dl className="backup-confirm__list">
          {rows.map(([k, v]) => (
            <div key={k} className="backup-confirm__row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          {rows.length === 0 && <p className="muted">되살릴 내용이 없습니다.</p>}
        </dl>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn btn--donate" disabled={rows.length === 0} onClick={onConfirm}>
            불러오기
          </button>
        </div>
      </div>
    </div>
  );
}
