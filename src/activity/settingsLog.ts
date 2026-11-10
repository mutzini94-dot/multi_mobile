import { LAYOUT_LABEL } from '../layout/layouts';
import type { Settings } from '../settings/settings';
import type { KV } from '../storage/safeStorage';

/** 설정 변경 기록 (최근 것이 앞) */
export const SETTINGS_LOG_KEY = 'mv.settingsLog.v1';
const MAX = 100;
const MERGE_MS = 2000; // 슬라이더처럼 연속으로 바뀌는 값은 한 건으로

export interface SettingsChange {
  at: number;
  key: keyof Settings;
  from: unknown;
  to: unknown;
}

const onOff = (v: unknown) => (v ? '켬' : '끔');
const won = (v: unknown) => (Number(v) > 0 ? `${Number(v).toLocaleString('ko-KR')}원` : '끔');
const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : '없음');
const pick = (m: Record<string, string>) => (v: unknown) => m[String(v)] ?? String(v);

/** 설정 창의 항목 이름·선택지 문구 (괄호 설명은 뺐다) */
const LABELS: Record<keyof Settings, [string, (v: unknown) => string]> = {
  restoreLastView: ['시작할 때 마지막 화면 복원', onOff],
  defaultLayout: ['기본 레이아웃', pick(LAYOUT_LABEL)],
  videoClick: ['영상 클릭', pick({ select: '창 선택', player: '플레이어 재생·정지' })],
  theme: ['테마', pick({ system: '시스템 설정 따라가기', light: '라이트', dark: '다크' })],
  skin: ['스킨', pick({ classic: '기본', breeze: '브리즈', pure: '퓨어' })],
  showLiveInfo: ['창에 방송 정보 표시', onOff],
  shortcuts: ['단축키', onOff],
  alwaysOnTop: ['항상 위에 표시', onOff],
  soundMode: ['소리', pick({ single: '선택한 창만 소리', mix: '여러 창 동시에 듣기' })],
  masterVolume: ['기본 볼륨', String],
  hiddenSlotPlayback: ['숨긴 창 재생', pick({ keep: '계속 재생', pause: '정지' })],
  lowQualityOthers: ['선택하지 않은 창은 낮은 화질', onOff],
  autoReplaceEnded: ['방송이 끝나면 라이브 중인 즐겨찾기로 바꾸기', onOff],
  donateMode: ['후원창 기본 모드', pick({ last: '마지막으로 쓴 모드', modal: '모달', pip: 'PIP' })],
  quickMessages: ['자주 쓰는 후원 메시지', list],
  quickAmounts: ['빠른 후원 금액', list],
  liveRefreshMinutes: ['라이브 자동 갱신', (v) => (Number(v) > 0 ? `${v}분마다` : '끔')],
  liveNotify: ['즐겨찾기 방송 시작 알림', onOff],
  keepScreenOn: ['화면 꺼짐 방지', onOff],
  dataSaver: ['데이터 절약', pick({ off: '끔', auto: '모바일 데이터일 때', on: '항상' })],
  monthlyGoal: ['월 후원 목표', won],
  monthlyLimit: ['월 후원 한도', won],
  quickPanel: ['퀵패널', pick({ left: '왼쪽', right: '오른쪽', off: '숨기기' })],
};

export function readSettingsLog(kv: KV): SettingsChange[] {
  try {
    const raw = JSON.parse(kv.get(SETTINGS_LOG_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((c): c is SettingsChange => !!c && Number.isFinite(c.at) && Object.prototype.hasOwnProperty.call(LABELS, c.key)).slice(0, MAX);
  } catch {
    return [];
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function recordSettings(kv: KV, before: Settings, patch: Partial<Settings>, now: number): SettingsChange[] {
  let log = readSettingsLog(kv);
  let changed = false;
  for (const key of Object.keys(patch) as (keyof Settings)[]) {
    if (!Object.prototype.hasOwnProperty.call(LABELS, key) || same(before[key], patch[key])) continue;
    changed = true;
    const recent = log.find((c) => c.key === key);
    if (recent && log[0] === recent && now - recent.at < MERGE_MS) {
      log = [{ ...recent, at: now, to: patch[key] }, ...log.slice(1)];
    } else {
      log = [{ at: now, key, from: before[key], to: patch[key] }, ...log];
    }
  }
  if (!changed) return log;
  log = log.slice(0, MAX);
  kv.set(SETTINGS_LOG_KEY, JSON.stringify(log));
  return log;
}

export function describeChange(c: SettingsChange): string {
  const [label, fmt] = LABELS[c.key];
  return `${label}: ${fmt(c.from)} → ${fmt(c.to)}`;
}
