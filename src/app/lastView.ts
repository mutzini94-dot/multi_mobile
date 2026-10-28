import { makeCreator, type CreatorInput } from '../domain/creatorInput';
import type { Creator, LayoutKind, SlotItem, ViewState } from '../domain/types';
import { isStream, makeDonatePage, makeWebPage } from '../domain/pages';
import { MAX_SLOTS, SLOT_COUNT } from '../layout/layouts';
import type { KV } from '../storage/safeStorage';

/** 마지막 화면(레이아웃·칸·칸 크기): 다음 실행에서 복원 (설정: 시작할 때 마지막 화면 복원) */
export const LAST_VIEW_KEY = 'mv.lastView.v1';

type SavedSlot = (CreatorInput & { source: Creator['source'] }) | { kind: 'web'; url: string } | { kind: 'donate' } | null;

export function saveLastView(kv: KV, state: ViewState): void {
  const slots: SavedSlot[] = state.slots.map((c) =>
    !c || (!isStream(c) && c.kind === 'detached')
      ? null // 분리 표시 (App이 원래 내용으로 바꿔 저장한다)
      : isStream(c)
        ? { name: c.name, donateId: c.donateId, platform: c.platform, channel: c.channel, source: c.source }
        : c.kind === 'web'
          ? { kind: 'web', url: c.url }
          : { kind: 'donate' },
  );
  kv.set(LAST_VIEW_KEY, JSON.stringify({ v: 1, layout: state.layout, sizes: state.sizes, slots }));
}

export function loadLastView(kv: KV): ViewState | null {
  try {
    const raw = JSON.parse(kv.get(LAST_VIEW_KEY) ?? 'null');
    if (!raw || raw.v !== 1 || !Object.prototype.hasOwnProperty.call(SLOT_COUNT, raw.layout) || !Array.isArray(raw.slots)) return null;
    const slots: (SlotItem | null)[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const s = raw.slots[i];
      if (!s || typeof s !== 'object') {
        slots.push(null);
        continue;
      }
      if (s.kind === 'donate') {
        slots.push(makeDonatePage());
        continue;
      }
      if (s.kind === 'web') {
        const w = makeWebPage(String(s.url ?? ''));
        slots.push(w.ok ? w.value : null);
        continue;
      }
      const source: Creator['source'] = s.source === 'toonation' || s.source === 'link' ? s.source : 'manual';
      const r = makeCreator(s, source);
      slots.push(r.ok ? r.value : null);
    }
    const sizes =
      raw.sizes && typeof raw.sizes === 'object' && !Array.isArray(raw.sizes)
        ? Object.fromEntries(Object.entries(raw.sizes as Record<string, unknown>).filter(([k, v]) => k !== '__proto__' && Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n)))) as Record<string, number[]>
        : {};
    return { layout: raw.layout as LayoutKind, slots, sizes, selected: null, soundOn: true };
  } catch {
    return null;
  }
}
