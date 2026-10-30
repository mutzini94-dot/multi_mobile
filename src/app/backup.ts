import type { Result } from '../domain/creatorInput';
import type { KV } from '../storage/safeStorage';

/** 백업에 담는 저장값: 설정(후원 메시지·금액 포함) · 직접 추가한 즐겨찾기 · 즐겨찾기 그룹 · 화면 구성 · 마지막 화면 */
export const BACKUP_KEYS = ['mv.settings.v1', 'mv.favorites.v1', 'mv.groups.v1', 'mv.presets.v1', 'mv.lastView.v1'];

const APP = 'multiview-donate';
const MAX_VALUE = 1_000_000;

export function exportBackup(kv: KV, now = Date.now()): string {
  const data: Record<string, string> = {};
  for (const k of BACKUP_KEYS) {
    const v = kv.get(k);
    if (v !== null) data[k] = v;
  }
  return JSON.stringify({ app: APP, v: 1, savedAt: now, data }, null, 2);
}

/** 백업 파일을 확인한 뒤 모두 맞을 때만 저장한다 (하나라도 틀리면 아무것도 바꾸지 않는다). 되살린 항목 수 */
export function importBackup(kv: KV, text: string): Result<number> {
  const fail = (error: string): Result<number> => ({ ok: false, error });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('백업 파일을 읽을 수 없습니다');
  }
  const r = raw as { app?: unknown; v?: unknown; data?: unknown };
  if (!r || r.app !== APP || r.v !== 1 || !r.data || typeof r.data !== 'object' || Array.isArray(r.data)) return fail('멀티뷰 후원 백업 파일이 아닙니다');
  const entries = Object.entries(r.data as Record<string, unknown>);
  for (const [k, v] of entries) {
    if (!BACKUP_KEYS.includes(k) || typeof v !== 'string' || v.length > MAX_VALUE) return fail('백업 파일의 내용이 올바르지 않습니다');
    try {
      JSON.parse(v);
    } catch {
      return fail('백업 파일의 내용이 올바르지 않습니다');
    }
  }
  for (const [k, v] of entries) kv.set(k, v as string);
  return { ok: true, value: entries.length };
}
