/** 내 후원 내역 한 건 (설치형 handlers.history / 연동 확장 history) */
export interface DonationRecord {
  at: number; // ms
  tag: string; // 투네이션 후원 아이디
  creator: string;
  cash: number;
}

export interface HistorySummary {
  total: number;
  months: { month: string; total: number; count: number }[]; // 최근 달부터
  creators: { tag: string; creator: string; total: number; count: number }[]; // 많이 후원한 순
}

const KST_OFFSET = 9 * 60 * 60 * 1000;

/** 투네이션 기준(한국 시간) 달: 'YYYY-MM' */
export function monthKey(at: number): string {
  return new Date(at + KST_OFFSET).toISOString().slice(0, 7);
}

/** 내역을 최근 것부터 보며 월별·크리에이터별로 더한다 (크리에이터 이름은 처음 본 것) */
export function summarize(items: DonationRecord[]): HistorySummary {
  const sorted = [...items].sort((a, b) => b.at - a.at);
  const months = new Map<string, { month: string; total: number; count: number }>();
  const creators = new Map<string, { tag: string; creator: string; total: number; count: number }>();
  let total = 0;
  for (const i of sorted) {
    total += i.cash;
    const m = monthKey(i.at);
    const mm = months.get(m) ?? { month: m, total: 0, count: 0 };
    mm.total += i.cash;
    mm.count += 1;
    months.set(m, mm);
    const key = i.tag || i.creator;
    const c = creators.get(key) ?? { tag: i.tag, creator: i.creator, total: 0, count: 0 };
    c.total += i.cash;
    c.count += 1;
    creators.set(key, c);
  }
  return { total, months: [...months.values()], creators: [...creators.values()].sort((a, b) => b.total - a.total) };
}

/** 이번 달(한국 시간) 후원 합계 */
export function monthTotal(items: DonationRecord[], now: number): number {
  const m = monthKey(now);
  return items.filter((i) => monthKey(i.at) === m).reduce((s, i) => s + i.cash, 0);
}
