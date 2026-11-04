/**
 * 크리에이터 시그니처 (후원 페이지의 '시그니처' 탭): 정해진 금액으로 후원하면 크리에이터가 등록한 이미지·소리가 나온다.
 * 출처: GET toon.at/dapi/donate/{후원 아이디} (Authorization: Bearer sign_token) → Conf.Signature.Signatures
 */
export interface Signature {
  hash: string;
  name: string;
  cash: number; // 시그니처 금액 (캐시)
  count: number; // 지금까지 쓰인 횟수
  image: string | null; // 썸네일
}

const HASH_RE = /^[A-Za-z0-9_-]{1,128}$/;
const THUMB = 'https://cache.cdn.toona.xyz/prod/uploaded/__signature__';

const decodeHtml = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e] ?? _);

/** 켜진(Enabled) 시그니처만, 랜덤 시그니처·잘못된 항목은 뺀다 */
export function parseSignatures(raw: unknown): Signature[] {
  if (!Array.isArray(raw)) return [];
  const out: Signature[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const s = r as Record<string, unknown>;
    const hash = String(s.Hash ?? '');
    const name = decodeHtml(String(s.Name ?? '')).trim().slice(0, 50);
    const cash = Number(s.Cash);
    if (!Number(s.Enabled) || Number(s.IsRandom) || !HASH_RE.test(hash) || !name || !Number.isInteger(cash) || cash <= 0) continue;
    out.push({ hash, name, cash, count: Math.max(0, Number(s.DonationCount) || 0), image: Number(s.Thumbnail) ? `${THUMB}/${hash}_thumb.img` : null });
  }
  return out;
}

export type SignatureSort = 'popular' | 'cashAsc' | 'cashDesc' | 'name';
export const SIGNATURE_SORTS: { key: SignatureSort; label: string }[] = [
  { key: 'popular', label: '인기순' },
  { key: 'cashAsc', label: '낮은 금액순' },
  { key: 'cashDesc', label: '높은 금액순' },
  { key: 'name', label: '이름순' },
];

const COMPARE: Record<SignatureSort, (a: Signature, b: Signature) => number> = {
  popular: (a, b) => b.count - a.count || a.cash - b.cash,
  cashAsc: (a, b) => a.cash - b.cash || a.name.localeCompare(b.name, 'ko'),
  cashDesc: (a, b) => b.cash - a.cash || a.name.localeCompare(b.name, 'ko'),
  name: (a, b) => a.name.localeCompare(b.name, 'ko') || a.cash - b.cash,
};

export function sortSignatures(list: Signature[], sort: SignatureSort): Signature[] {
  return [...list].sort(COMPARE[sort]);
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** 이름 일부(대소문자·띄어쓰기 무시)나 금액(쉼표·'원'·'캐시' 무시)으로 찾기 */
export function filterSignatures(list: Signature[], query: string): Signature[] {
  const q = squash(query);
  if (!q) return list;
  const amount = /^[\d,]+(원|캐시)?$/.test(q) ? Number(q.replace(/[^\d]/g, '')) : NaN;
  return list.filter((s) => squash(s.name).includes(q) || s.cash === amount);
}
