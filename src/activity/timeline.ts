import type { Creator } from '../domain/types';
import type { DonationRecord } from '../toonation/history';
import { describeChange, type SettingsChange } from './settingsLog';
import type { WatchEntry } from './watchLog';

/** 활동 위젯 '최근 활동' 한 줄 */
export type TimelineItem =
  | { kind: 'watch'; at: number; creator: Creator }
  | { kind: 'donation'; at: number; name: string; cash: number }
  | { kind: 'settings'; at: number; text: string };

/** 시청·후원·설정 변경을 최근 순으로 섞는다 (후원 내역을 모르면 null) */
export function buildTimeline(watch: WatchEntry[], donations: DonationRecord[] | null, settings: SettingsChange[], limit = 50): TimelineItem[] {
  const items: TimelineItem[] = [
    ...watch.map((w): TimelineItem => ({ kind: 'watch', at: w.at, creator: w.creator })),
    ...(donations ?? []).map((d): TimelineItem => ({ kind: 'donation', at: d.at, name: d.creator || d.tag, cash: d.cash })),
    ...settings.map((c): TimelineItem => ({ kind: 'settings', at: c.at, text: describeChange(c) })),
  ];
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

const KST_OFFSET = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const kstDay = (t: number) => Math.floor((t + KST_OFFSET) / DAY);

/** 한국 시간 기준: 오늘은 '14:32', 어제는 '어제', 그 전은 '10/31' */
export function timeLabel(at: number, now: number): string {
  const d = new Date(at + KST_OFFSET);
  const diff = kstDay(now) - kstDay(at);
  if (diff <= 0) return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  if (diff === 1) return '어제';
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
