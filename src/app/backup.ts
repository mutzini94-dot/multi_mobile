import type { Result } from '../domain/creatorInput';
import type { KV } from '../storage/safeStorage';

/** JSON 값으로 저장하는 키: 설정(후원 메시지·금액 포함) · 직접 추가한 즐겨찾기 · 즐겨찾기 그룹 · 화면 구성 · 마지막 화면 · 최근 본 방송 */
const JSON_KEYS = ['mv.settings.v1', 'mv.favorites.v1', 'mv.groups.v1', 'mv.presets.v1', 'mv.lastView.v1', 'mv.watchLog.v1', 'mv.vertical.v1', 'mv.vertical.seen.v1'];
/** 글자 값으로 저장하는 키와 모양: 리모컨 모드 · 추천 라이브 창 크기 */
const TEXT_KEYS: Record<string, RegExp> = {
  'mv.mode.v1': /^(donor|creator)$/,
  'mv.shortsWidth.v1': /^\d{3,4}$/,
  'mv.shortsHeight.v1': /^\d{3,4}$/,
};
export const BACKUP_KEYS = [...JSON_KEYS, ...Object.keys(TEXT_KEYS)];

const APP = 'multiview-donate';
const MAX_VALUE = 1_000_000;

/** 설치형 창 배치 (메인·PIP·분리 창 크기 등). 웹은 null */
export type DesktopLayout = Record<string, unknown>;

export interface BackupSummary {
  savedAt: number | null;
  settings: boolean;
  favorites: number;
  groups: number;
  presets: number;
  recent: number;
  windows: boolean; // 설치형 창 배치가 들어 있다
}

export function exportBackup(kv: KV, now = Date.now(), desktop: DesktopLayout | null = null): string {
  const data: Record<string, string> = {};
  for (const k of BACKUP_KEYS) {
    const v = kv.get(k);
    if (v !== null && valid(k, v)) data[k] = v; // 빈 값(기본으로 되돌린 값)·깨진 값은 담지 않는다
  }
  return JSON.stringify({ app: APP, v: 1, savedAt: now, data, ...(desktop ? { desktop } : {}) }, null, 2);
}

function valid(k: string, v: string): boolean {
  if (v.length > MAX_VALUE) return false;
  if (k in TEXT_KEYS) return TEXT_KEYS[k].test(v);
  if (!JSON_KEYS.includes(k)) return false;
  try {
    JSON.parse(v);
    return true;
  } catch {
    return false;
  }
}

interface Parsed {
  savedAt: number | null;
  entries: [string, string][];
  desktop: DesktopLayout | null;
}

function parse(text: string): Result<Parsed> {
  const fail = (error: string): Result<Parsed> => ({ ok: false, error });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('백업 파일을 읽을 수 없습니다');
  }
  const r = raw as { app?: unknown; v?: unknown; data?: unknown; savedAt?: unknown; desktop?: unknown };
  if (!r || r.app !== APP || r.v !== 1 || !r.data || typeof r.data !== 'object' || Array.isArray(r.data)) return fail('투네이션 후원 브라우저 백업 파일이 아닙니다');
  const entries = Object.entries(r.data as Record<string, unknown>);
  for (const [k, v] of entries) if (typeof v !== 'string' || !valid(k, v)) return fail('백업 파일의 내용이 올바르지 않습니다');
  const desktop = r.desktop && typeof r.desktop === 'object' && !Array.isArray(r.desktop) ? (r.desktop as DesktopLayout) : null;
  return { ok: true, value: { savedAt: typeof r.savedAt === 'number' ? r.savedAt : null, entries: entries as [string, string][], desktop } };
}

const count = (entries: [string, string][], key: string) => {
  const v = entries.find(([k]) => k === key)?.[1];
  if (!v) return 0;
  try {
    const x = JSON.parse(v);
    return Array.isArray(x) ? x.length : 0;
  } catch {
    return 0;
  }
};

/** 되살리기 전에 보여 줄 내용 요약 */
export function describeBackup(text: string): Result<BackupSummary> {
  const p = parse(text);
  if (!p.ok) return p;
  const { entries, savedAt, desktop } = p.value;
  return {
    ok: true,
    value: {
      savedAt,
      settings: entries.some(([k]) => k === 'mv.settings.v1'),
      favorites: count(entries, 'mv.favorites.v1'),
      groups: count(entries, 'mv.groups.v1'),
      presets: count(entries, 'mv.presets.v1'),
      recent: count(entries, 'mv.watchLog.v1'),
      windows: !!desktop,
    },
  };
}

/** 백업 파일을 확인한 뒤 모두 맞을 때만 저장한다 (하나라도 틀리면 아무것도 바꾸지 않는다). 되살린 항목 수와 설치형 창 배치 */
export function importBackup(kv: KV, text: string): Result<{ count: number; desktop: DesktopLayout | null }> {
  const p = parse(text);
  if (!p.ok) return p;
  for (const [k, v] of p.value.entries) kv.set(k, v);
  return { ok: true, value: { count: p.value.entries.length, desktop: p.value.desktop } };
}
