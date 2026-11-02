import { buildTimeline, timeLabel } from '../../src/activity/timeline';
import { mkCreator } from '../helpers/fixtures';

const KST = (s: string) => Date.parse(`${s}+09:00`);

test('시청·후원·설정 변경을 최근 순으로 섞는다', () => {
  const t = buildTimeline(
    [{ at: 30, creator: mkCreator(1) }],
    [{ at: 20, tag: 'a', creator: '에이', cash: 5000 }],
    [{ at: 40, key: 'liveNotify', from: false, to: true }],
  );
  expect(t.map((i) => i.kind)).toEqual(['settings', 'watch', 'donation']);
  expect(t[0]).toMatchObject({ kind: 'settings', text: '즐겨찾기 방송 시작 알림: 끔 → 켬' });
  expect(t[2]).toMatchObject({ kind: 'donation', name: '에이', cash: 5000 });
});

test('후원 내역이 없으면(null) 빼고, 개수 제한을 지킨다', () => {
  const watch = Array.from({ length: 60 }, (_, i) => ({ at: i, creator: mkCreator(i) }));
  expect(buildTimeline(watch, null, []).length).toBe(50);
  expect(buildTimeline([], null, [], 5)).toEqual([]);
});

test('timeLabel: 오늘은 시:분, 어제는 어제, 그 전은 월/일 (한국 시간)', () => {
  const now = KST('2026-11-02T15:00:00');
  expect(timeLabel(KST('2026-11-02T14:32:00'), now)).toBe('14:32');
  expect(timeLabel(KST('2026-11-02T00:05:00'), now)).toBe('00:05');
  expect(timeLabel(KST('2026-11-01T23:00:00'), now)).toBe('어제');
  expect(timeLabel(KST('2026-10-31T10:00:00'), now)).toBe('10/31');
});
