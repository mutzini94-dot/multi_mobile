import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { Creator } from '../domain/types';
import type { FavoritesSource } from '../favorites/favorites';
import { LAYOUT_LABEL, LAYOUTS } from '../layout/layouts';
import { cleanAmounts, cleanMessages, LIVE_REFRESH_OPTIONS, type Settings } from '../settings/settings';

interface Props {
  settings: Settings;
  onChange(patch: Partial<Settings>): void;
  desktop: boolean; // 설치형 전용 항목(항상 위·후원창 모드·빠른 후원)
  host: Creator | null;
  onEditHost(): void;
  publicBase: string;
  onSavePublicBase(base: string): string | null; // 오류 메시지 또는 null
  toonationAccount: string | null; // 로그인한 투네이션 계정 이름
  onLogout(): void;
  favorites: FavoritesSource;
  onExportFavorites(json: string): void;
  onClose(): void;
}

const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' } as const;

/** "1,000 5,000 10,000" · "1,000, 5000" → [1000, 5000, 10000]: 띄어쓰기·'쉼표+공백'·/ 로 구분, 숫자 안 쉼표는 천 단위 */
export function parseAmounts(text: string): number[] {
  const tokens = text.split(/\s*,\s+|[\s/]+/).filter(Boolean);
  return cleanAmounts(tokens.map((t) => (/^\d{1,3}(,\d{3})+$|^\d+$/.test(t) ? Number(t.replace(/,/g, '')) : NaN)));
}
/** File.text()가 없는 환경(구형 브라우저·테스트)도 읽을 수 있게 */
function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
const formatAmounts = (a: number[]) => a.map((n) => n.toLocaleString('ko-KR')).join(' ');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange(v: boolean): void; hint?: string }) {
  return (
    <label className="settings__row settings__row--toggle">
      <span>
        {label}
        {hint && <small className="muted">{hint}</small>}
      </span>
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Select<T extends string | number>({ label, value, options, onChange, hint }: { label: string; value: T; options: [T, string][]; onChange(v: T): void; hint?: string }) {
  return (
    <label className="settings__row">
      <span>
        {label}
        {hint && <small className="muted">{hint}</small>}
      </span>
      <select
        aria-label={label}
        value={String(value)}
        onChange={(e) => onChange(options.find(([v]) => String(v) === e.target.value)![0])}
      >
        {options.map(([v, text]) => (
          <option key={String(v)} value={String(v)}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SettingsDialog(p: Props) {
  const s = p.settings;
  const [list, setList] = useState(() => p.favorites.list());
  const [amountText, setAmountText] = useState(formatAmounts(s.quickAmounts));
  const [messageText, setMessageText] = useState(s.quickMessages.join('\n'));
  const [limitText, setLimitText] = useState(s.monthlyLimit ? s.monthlyLimit.toLocaleString('ko-KR') : '0');
  const [base, setBase] = useState(p.publicBase);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [favMessage, setFavMessage] = useState<string | null>(null);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = p.favorites.importJson(await readText(file));
    setFavMessage(r.ok ? `즐겨찾기 ${r.value}개를 가져왔습니다` : r.error);
    setList(p.favorites.list());
  };

  return (
    <div className="modal-backdrop" onClick={p.onClose}>
      <div className="modal settings" role="dialog" aria-label="설정" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>설정</h2>
          <button type="button" className="btn btn--ghost" onClick={p.onClose}>
            닫기
          </button>
        </div>

        <Section title="화면">
          <Toggle label="시작할 때 마지막 화면 복원" checked={s.restoreLastView} onChange={(v) => p.onChange({ restoreLastView: v })} hint="레이아웃·칸·칸 크기를 그대로 불러옵니다" />
          <Select
            label="기본 레이아웃"
            value={s.defaultLayout}
            options={LAYOUTS.map((l) => [l, LAYOUT_LABEL[l]])}
            onChange={(v) => p.onChange({ defaultLayout: v })}
            hint="마지막 화면을 복원하지 않을 때"
          />
          <Select
            label="영상 클릭"
            value={s.videoClick}
            options={[
              ['select', '칸 선택 (영상을 잡고 끌기 가능)'],
              ['player', '플레이어 재생·정지'],
            ]}
            onChange={(v) => p.onChange({ videoClick: v })}
          />
          <Select
            label="테마"
            value={s.theme}
            options={[
              ['system', '시스템 설정 따라가기'],
              ['light', '라이트'],
              ['dark', '다크'],
            ]}
            onChange={(v) => p.onChange({ theme: v })}
          />
          <Toggle label="단축키" checked={s.shortcuts} onChange={(v) => p.onChange({ shortcuts: v })} hint="1~9 칸 선택 · M 소리 · F 전체 화면 · D 후원하기" />
          {p.desktop && <Toggle label="항상 위에 표시" checked={s.alwaysOnTop} onChange={(v) => p.onChange({ alwaysOnTop: v })} />}
        </Section>

        <Section title="재생·소리">
          <Select
            label="소리"
            value={s.soundMode}
            options={[
              ['single', '선택한 칸만 소리'],
              ['mix', '여러 칸 동시에 듣기 (칸별 볼륨)'],
            ]}
            onChange={(v) => p.onChange({ soundMode: v })}
          />
          <label className="settings__row">
            <span>기본 볼륨 {s.masterVolume}</span>
            <input type="range" aria-label="기본 볼륨" min={0} max={100} value={s.masterVolume} onChange={(e) => p.onChange({ masterVolume: Number(e.target.value) })} />
          </label>
          <Select
            label="숨긴 칸 재생"
            value={s.hiddenSlotPlayback}
            options={[
              ['keep', '계속 재생 (다시 보이면 바로 이어서)'],
              ['pause', '정지 (인터넷·PC 부담 줄이기)'],
            ]}
            onChange={(v) => p.onChange({ hiddenSlotPlayback: v })}
          />
          <Toggle label="선택하지 않은 칸은 낮은 화질" checked={s.lowQualityOthers} onChange={(v) => p.onChange({ lowQualityOthers: v })} hint="트위치만 (유튜브는 화질 지정을 지원하지 않습니다)" />
          <Toggle
            label="방송이 끝나면 라이브 중인 즐겨찾기로 바꾸기"
            checked={s.autoReplaceEnded}
            onChange={(v) => p.onChange({ autoReplaceEnded: v })}
            hint="투네이션 즐겨찾기 중 지금 라이브인 방송으로 자동으로 바꿉니다 (투네이션 로그인 필요)"
          />
        </Section>

        {p.desktop && (
          <Section title="후원">
            <Select
              label="후원창 기본 모드"
              value={s.donateMode}
              options={[
                ['last', '마지막으로 쓴 모드'],
                ['modal', '모달 (앱 가운데)'],
                ['pip', 'PIP (항상 위 작은 창)'],
              ]}
              onChange={(v) => p.onChange({ donateMode: v })}
            />
            <label className="settings__row settings__row--top">
              <span>
                자주 쓰는 후원 메시지
                <small className="muted">한 줄에 하나, 5개까지. 후원창에서 고르면 메시지 칸만 채웁니다</small>
              </span>
              <textarea
                aria-label="자주 쓰는 후원 메시지"
                rows={3}
                value={messageText}
                placeholder={'예: 오늘도 방송 잘 보고 있어요!'}
                onChange={(e) => setMessageText(e.target.value)}
                onBlur={() => {
                  const list = cleanMessages(messageText.split('\n'));
                  p.onChange({ quickMessages: list });
                  setMessageText(list.join('\n'));
                }}
              />
            </label>
            <label className="settings__row">
              <span>
                빠른 후원 금액
                <small className="muted">후원창에서 누르면 금액만 채웁니다 (후원 버튼은 직접)</small>
              </span>
              <input
                aria-label="빠른 후원 금액"
                value={amountText}
                placeholder="예: 1,000 5,000 10,000"
                onChange={(e) => setAmountText(e.target.value)}
                onBlur={() => {
                  const amounts = parseAmounts(amountText);
                  p.onChange({ quickAmounts: amounts });
                  setAmountText(formatAmounts(amounts));
                }}
              />
            </label>
          </Section>
        )}

        <Section title="투네이션">
          <Select
            label="라이브 자동 갱신"
            value={s.liveRefreshMinutes}
            options={LIVE_REFRESH_OPTIONS.map((m) => [m, m === 0 ? '끔 (불러오기 창을 열 때만)' : `${m}분마다`])}
            onChange={(v) => p.onChange({ liveRefreshMinutes: v })}
          />
          <Toggle label="즐겨찾기 방송 시작 알림" checked={s.liveNotify} onChange={(v) => p.onChange({ liveNotify: v })} hint="라이브 자동 갱신이 켜져 있어야 합니다" />
          <label className="settings__row">
            <span>
              월 후원 한도
              <small className="muted">이번 달 후원 합계가 한도에 이르면 후원 전에 한 번 더 확인합니다 (0이면 끔)</small>
            </span>
            <input
              aria-label="월 후원 한도"
              inputMode="numeric"
              value={limitText}
              placeholder="예: 50,000"
              onChange={(e) => setLimitText(e.target.value)}
              onBlur={() => {
                const n = Number(limitText.replace(/[,\s원]/g, ''));
                const v = Number.isInteger(n) && n >= 0 && n <= 100_000_000 ? n : 0;
                p.onChange({ monthlyLimit: v });
                setLimitText(v ? v.toLocaleString('ko-KR') : '0');
              }}
            />
          </label>
          <div className="settings__row">
            <span>{p.toonationAccount ? `${p.toonationAccount} 님으로 로그인됨` : '로그인하지 않음'}</span>
            {p.toonationAccount && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={p.onLogout}>
                투네이션 로그아웃
              </button>
            )}
          </div>
        </Section>

        <Section title="직접 추가한 즐겨찾기">
          {list.length === 0 ? (
            <p className="muted">직접 추가한 즐겨찾기가 없습니다.</p>
          ) : (
            <ul className="settings__favs">
              {list.map((c, i) => (
                <li key={c.key}>
                  <span>
                    {c.name} <span className="muted">· {PLATFORM_LABEL[c.platform]} · {c.channel}</span>
                  </span>
                  <button type="button" className="btn btn--icon" aria-label={`${c.name} 위로`} disabled={i === 0} onClick={() => setList(p.favorites.move(c.key, -1))}>
                    ↑
                  </button>
                  <button type="button" className="btn btn--icon" aria-label={`${c.name} 아래로`} disabled={i === list.length - 1} onClick={() => setList(p.favorites.move(c.key, 1))}>
                    ↓
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="settings__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => p.onExportFavorites(p.favorites.exportJson())}>
              내보내기
            </button>
            <label className="btn btn--ghost btn--sm settings__file">
              가져오기
              <input type="file" accept="application/json,.json" aria-label="즐겨찾기 가져오기" onChange={onImport} />
            </label>
          </div>
          {favMessage && <p className="muted">{favMessage}</p>}
        </Section>

        <Section title="합동 방송">
          <div className="settings__row">
            <span>{p.host ? `${p.host.name} · ${PLATFORM_LABEL[p.host.platform]} · ${p.host.channel}` : '내 방송 정보가 없습니다'}</span>
            <button type="button" className="btn btn--ghost btn--sm" aria-label="내 방송 정보 수정" onClick={p.onEditHost}>
              {p.host ? '수정' : '입력'}
            </button>
          </div>
          <label className="settings__row">
            <span>
              시청 페이지 주소
              <small className="muted">합방 URL에 쓰는 배포한 멀티뷰 웹 주소</small>
            </span>
            <input
              aria-label="시청 페이지 주소"
              value={base}
              placeholder="https://…"
              onChange={(e) => setBase(e.target.value)}
              onBlur={() => setBaseError(base.trim() ? p.onSavePublicBase(base.trim()) : null)}
            />
          </label>
          {baseError && <p className="form-error">{baseError}</p>}
        </Section>
      </div>
    </div>
  );
}
