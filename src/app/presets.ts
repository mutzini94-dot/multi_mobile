import type { Result } from '../domain/creatorInput';
import type { ViewState } from '../domain/types';
import type { KV } from '../storage/safeStorage';
import { parseView, serializeView } from './lastView';

/** 화면 구성 저장: "저녁 방송 세트"처럼 레이아웃·칸·칸 크기를 이름 붙여 저장해 두고 한 번에 불러온다 */
export const PRESETS_KEY = 'mv.presets.v1';
export const MAX_PRESETS = 20;

export interface Preset {
  id: string;
  name: string;
  savedAt: number;
  view: ViewState;
}

function readRaw(kv: KV): unknown[] {
  try {
    const raw = JSON.parse(kv.get(PRESETS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** 최근 저장한 것부터. 깨진 항목은 건너뛴다 */
export function listPresets(kv: KV): Preset[] {
  const out: Preset[] = [];
  for (const r of readRaw(kv)) {
    if (!r || typeof r !== 'object') continue;
    const { id, name, savedAt, view } = r as Record<string, unknown>;
    const v = parseView(view);
    if (typeof id !== 'string' || typeof name !== 'string' || !v) continue;
    out.push({ id, name, savedAt: Number(savedAt) || 0, view: v });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

function write(kv: KV, list: Preset[]) {
  kv.set(PRESETS_KEY, JSON.stringify(list.map((p) => ({ id: p.id, name: p.name, savedAt: p.savedAt, view: serializeView(p.view) }))));
}

let seq = 0;

/** 같은 이름이 있으면 덮어쓴다 */
export function savePreset(kv: KV, nameInput: string, view: ViewState): Result<Preset[]> {
  const name = String(nameInput ?? '').trim();
  if (name.length < 1 || name.length > 30) return { ok: false, error: '구성 이름을 1~30자로 입력해 주세요' };
  const list = listPresets(kv);
  const same = list.find((p) => p.name === name);
  if (!same && list.length >= MAX_PRESETS) return { ok: false, error: `구성은 ${MAX_PRESETS}개까지 저장할 수 있습니다. 안 쓰는 구성을 지워 주세요` };
  const savedAt = Math.max(Date.now(), ...list.map((p) => p.savedAt + 1)); // 같은 시각이어도 최근 것이 먼저
  const preset: Preset = { id: same?.id ?? `p${Date.now().toString(36)}${(++seq).toString(36)}`, name, savedAt, view };
  const next = [preset, ...list.filter((p) => p !== same)];
  write(kv, next);
  return { ok: true, value: listPresets(kv) };
}

export function deletePreset(kv: KV, id: string): Preset[] {
  write(
    kv,
    listPresets(kv).filter((p) => p.id !== id),
  );
  return listPresets(kv);
}
