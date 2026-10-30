/**
 * 설치형: 웹 화면 저장값(localStorage의 mv.*) 사본을 앱 데이터 폴더(desktop/lib/webStore.js)와 맞춘다.
 * localStorage는 주소(포트 포함)별이라 고정 포트를 못 쓰고 다른 포트로 열린 실행에서는 비어 보인다.
 * 시작할 때 사본이 더 최신이면 사본으로 되살리고, 실행 중에는 바뀐 것을 몇 초마다 사본으로 보낸다.
 */
export interface WebStoreSnapshot {
  savedAt: number;
  data: Record<string, string>;
}

/** 마지막으로 사본에 보낸 시각 (이 주소의 저장값이 얼마나 최신인지) */
export const SAVED_AT_KEY = 'mv.__savedAt';

export function snapshotStorage(s: Storage): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k || !k.startsWith('mv.') || k === SAVED_AT_KEY) continue;
    const v = s.getItem(k);
    if (v !== null) data[k] = v;
  }
  return data;
}

/** 사본이 이 주소의 저장값보다 최신이면 mv.* 를 사본으로 바꾼다. 바꿨으면 true */
export function restoreIfNewer(s: Storage, snap: WebStoreSnapshot | null): boolean {
  if (!snap || !Number.isFinite(snap.savedAt) || !snap.data) return false;
  const local = Number(s.getItem(SAVED_AT_KEY)) || 0;
  if (snap.savedAt <= local) return false;
  for (const k of Object.keys(snapshotStorage(s))) s.removeItem(k);
  for (const [k, v] of Object.entries(snap.data)) if (k.startsWith('mv.') && typeof v === 'string') s.setItem(k, v);
  s.setItem(SAVED_AT_KEY, String(snap.savedAt));
  return true;
}

/** intervalMs마다 저장값을 살펴 바뀌었으면 저장 시각을 붙여 save로 보낸다. 창을 닫을 때도 한 번 */
export function startMirror(s: Storage, save: (snap: WebStoreSnapshot) => void, intervalMs = 3000): () => void {
  let last: string | null = null;
  const tick = () => {
    const data = snapshotStorage(s);
    const json = JSON.stringify(data);
    if (json === last) return;
    last = json;
    const savedAt = Date.now();
    s.setItem(SAVED_AT_KEY, String(savedAt));
    save({ savedAt, data });
  };
  const t = setInterval(tick, intervalMs);
  const onHide = () => tick();
  window.addEventListener('pagehide', onHide);
  return () => {
    clearInterval(t);
    window.removeEventListener('pagehide', onHide);
  };
}
