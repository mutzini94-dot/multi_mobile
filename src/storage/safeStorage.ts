export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** localStorage 접근 실패(사생활 보호 모드 등) 시 메모리로 대체한다. */
export function safeStorage(backing?: Storage): KV {
  const memory = new Map<string, string>();
  return {
    get(key) {
      try {
        if (backing) return backing.getItem(key);
      } catch {
        // 메모리로 대체
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value);
      try {
        backing?.setItem(key, value);
      } catch {
        // 메모리에만 저장
      }
    },
  };
}
