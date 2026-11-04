import { makeCreator, type CreatorInput } from '../domain/creatorInput';
import type { Creator, LayoutKind, SlotItem, ViewState } from '../domain/types';
import { isStream, makeActivityPage, makeSignaturePage, makeChatPage, makeDonatePage, makeWebPage } from '../domain/pages';
import { MAX_SLOTS, SLOT_COUNT } from '../layout/layouts';
import type { KV } from '../storage/safeStorage';

/** 마지막 화면(레이아웃·칸·칸 크기): 다음 실행에서 복원 (설정: 시작할 때 마지막 화면 복원) */
export const LAST_VIEW_KEY = 'mv.lastView.v1';

type SavedSlot = (CreatorInput & { source: Creator['source'] }) | { kind: 'web'; url: string } | { kind: 'donate' } | { kind: 'chat' } | { kind: 'activity' } | { kind: 'signature' } | null;
/** 저장 형식 (마지막 화면·화면 구성 저장 공통) */
export interface SavedView {
  v: 1;
  layout: LayoutKind;
  sizes: Record<string, number[]>;
  slots: SavedSlot[];
}

export function serializeView(state: ViewState): SavedView {
  const slots: SavedSlot[] = state.slots.map((c) =>
    !c || (!isStream(c) && c.kind === 'detached')
      ? null // 분리 표시 (App이 원래 내용으로 바꿔 저장한다)
      : isStream(c)
        ? { name: c.name, donateId: c.donateId, platform: c.platform, channel: c.channel, source: c.source }
        : c.kind === 'web'
          ? { kind: 'web', url: c.url }
          : { kind: c.kind },
  );
  return { v: 1, layout: state.layout, sizes: state.sizes, slots };
}

/** 저장한 값을 다시 확인하며 화면 상태로 (잘못된 칸은 빈 칸, 형식이 틀리면 null) */
export function parseView(raw: unknown): ViewState | null {
  const r = raw as Partial<SavedView> | null;
  if (!r || r.v !== 1 || typeof r.layout !== 'string' || !Object.prototype.hasOwnProperty.call(SLOT_COUNT, r.layout) || !Array.isArray(r.slots)) return null;
  const slots: (SlotItem | null)[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const s = r.slots[i] as Record<string, unknown> | null | undefined;
    if (!s || typeof s !== 'object') {
      slots.push(null);
      continue;
    }
    if (s.kind === 'donate' || s.kind === 'chat' || s.kind === 'activity' || s.kind === 'signature') {
      slots.push(s.kind === 'donate' ? makeDonatePage() : s.kind === 'chat' ? makeChatPage() : s.kind === 'activity' ? makeActivityPage() : makeSignaturePage());
      continue;
    }
    if (s.kind === 'web') {
      const w = makeWebPage(String(s.url ?? ''));
      slots.push(w.ok ? w.value : null);
      continue;
    }
    const source: Creator['source'] = s.source === 'toonation' ? 'toonation' : 'manual';
    const c = makeCreator(s as unknown as CreatorInput, source);
    slots.push(c.ok ? c.value : null);
  }
  const sizes =
    r.sizes && typeof r.sizes === 'object' && !Array.isArray(r.sizes)
      ? (Object.fromEntries(
          Object.entries(r.sizes as Record<string, unknown>).filter(([k, v]) => k !== '__proto__' && Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n))),
        ) as Record<string, number[]>)
      : {};
  return { layout: r.layout as LayoutKind, slots, sizes, selected: null, soundOn: true };
}

export function saveLastView(kv: KV, state: ViewState): void {
  kv.set(LAST_VIEW_KEY, JSON.stringify(serializeView(state)));
}

export function loadLastView(kv: KV): ViewState | null {
  try {
    return parseView(JSON.parse(kv.get(LAST_VIEW_KEY) ?? 'null'));
  } catch {
    return null;
  }
}
