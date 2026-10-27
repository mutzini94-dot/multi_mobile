import { makeCreator, type CreatorInput, type Result } from '../domain/creatorInput';
import type { Creator } from '../domain/types';
import type { KV } from '../storage/safeStorage';

/** 합동 방송 호스트(나)의 방송 정보: 처음 개설할 때 한 번 입력해 저장한다. */
export const HOST_KEY = 'mv.host.v1';

export function loadHost(kv: KV): Creator | null {
  try {
    const raw = JSON.parse(kv.get(HOST_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const r = makeCreator(raw as CreatorInput, 'manual');
    return r.ok ? r.value : null;
  } catch {
    return null;
  }
}

export function saveHost(kv: KV, input: CreatorInput): Result<Creator> {
  const r = makeCreator(input, 'manual');
  if (r.ok) {
    const { name, donateId, platform, channel } = r.value;
    kv.set(HOST_KEY, JSON.stringify({ name, donateId, platform, channel }));
  }
  return r;
}
