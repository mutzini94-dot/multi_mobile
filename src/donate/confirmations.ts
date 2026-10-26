import type { Creator } from '../domain/types';
import type { KV } from '../storage/safeStorage';

export const CONFIRMED_KEY = 'mv.confirmed.v1';

const entry = (c: Creator) => `${c.key}|${c.donateId}`;

function read(kv: KV): string[] {
  try {
    const v = JSON.parse(kv.get(CONFIRMED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 합방 링크로 받은 (채널, 후원 아이디) 짝은 첫 후원 전에 사용자 확인을 거친다. */
export function needsConfirm(c: Creator, kv: KV): boolean {
  return c.source === 'link' && !read(kv).includes(entry(c));
}

export function markConfirmed(c: Creator, kv: KV): void {
  const list = read(kv);
  if (!list.includes(entry(c))) kv.set(CONFIRMED_KEY, JSON.stringify([...list, entry(c)]));
}
