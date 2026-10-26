import { makeCreator, type CreatorInput } from '../domain/creatorInput';
import type { Creator, LayoutKind, ViewState } from '../domain/types';
import { SLOT_COUNT } from '../layout/layouts';

const PREFIX = '#s=';

interface SharePayload {
  v: 1;
  layout: LayoutKind;
  sizes: Record<string, number[]>;
  slots: (CreatorInput | null)[];
}

function toBase64Url(text: string): string {
  let bin = '';
  new TextEncoder().encode(text).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string): string {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function encodeShare(state: ViewState): string {
  const payload: SharePayload = {
    v: 1,
    layout: state.layout,
    sizes: state.sizes,
    slots: state.slots.map((c) => (c ? { name: c.name, donateId: c.donateId, platform: c.platform, channel: c.channel } : null)),
  };
  return PREFIX + toBase64Url(JSON.stringify(payload));
}

export function buildShareUrl(state: ViewState, base: string): string {
  const url = new URL(base);
  url.hash = encodeShare(state).slice(1);
  return url.toString();
}

function cleanSizes(raw: unknown): Record<string, number[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!Array.isArray(v) || !v.every((n) => typeof n === 'number' && Number.isFinite(n))) return {};
    out[k] = v;
  }
  return out;
}

export function decodeShare(hash: string): ViewState | null {
  if (!hash.startsWith(PREFIX)) return null;
  let p: Partial<SharePayload>;
  try {
    p = JSON.parse(fromBase64Url(hash.slice(PREFIX.length)));
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object' || p.v !== 1) return null;
  if (typeof p.layout !== 'string' || !Object.prototype.hasOwnProperty.call(SLOT_COUNT, p.layout)) return null;
  const layout = p.layout as LayoutKind;
  if (!Array.isArray(p.slots) || p.slots.length !== SLOT_COUNT[layout]) return null;
  const slots: (Creator | null)[] = [];
  for (const s of p.slots) {
    if (s === null) {
      slots.push(null);
      continue;
    }
    if (typeof s !== 'object') return null;
    const r = makeCreator(s, 'link');
    if (!r.ok) return null;
    slots.push(r.value);
  }
  return { layout, slots, sizes: cleanSizes(p.sizes), selected: null, soundOn: true };
}
