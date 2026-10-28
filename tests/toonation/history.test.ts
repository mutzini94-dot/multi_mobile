import { monthKey, monthTotal, summarize } from '../../src/toonation/history';

const kst = (s: string) => Date.parse(`${s}+09:00`);

test('monthKey: 한국 시간 기준 달', () => {
  expect(monthKey(kst('2026-10-31T23:30:00'))).toBe('2026-10');
  expect(monthKey(kst('2026-11-01T00:10:00'))).toBe('2026-11');
});

test('summarize: 월별(최근 달부터)·크리에이터별(많이 후원한 순) 합계', () => {
  const items = [
    { at: kst('2026-10-02T12:00:00'), tag: 'a', creator: 'A', cash: 1000 },
    { at: kst('2026-10-20T12:00:00'), tag: 'b', creator: 'B', cash: 5000 },
    { at: kst('2026-09-15T12:00:00'), tag: 'a', creator: 'A', cash: 3000 },
    { at: kst('2026-09-16T12:00:00'), tag: 'a', creator: 'A(새 이름)', cash: 3000 },
  ];
  const s = summarize(items);
  expect(s.months).toEqual([
    { month: '2026-10', total: 6000, count: 2 },
    { month: '2026-09', total: 6000, count: 2 },
  ]);
  expect(s.creators).toEqual([
    { tag: 'a', creator: 'A', total: 7000, count: 3 }, // 이름은 가장 최근 것이 아니라 처음(최근 내역부터) 본 것
    { tag: 'b', creator: 'B', total: 5000, count: 1 },
  ]);
  expect(s.total).toBe(12000);
});

test('monthTotal: 이번 달 합계', () => {
  const now = kst('2026-10-28T10:00:00');
  expect(monthTotal([{ at: kst('2026-10-01T00:00:00'), tag: 'a', creator: 'A', cash: 700 }, { at: kst('2026-09-30T23:59:00'), tag: 'a', creator: 'A', cash: 900 }], now)).toBe(700);
});
