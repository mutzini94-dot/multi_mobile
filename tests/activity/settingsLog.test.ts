import { describeChange, readSettingsLog, recordSettings, SETTINGS_LOG_KEY } from '../../src/activity/settingsLog';
import { DEFAULT_SETTINGS } from '../../src/settings/settings';
import { safeStorage } from '../../src/storage/safeStorage';

const base = { ...DEFAULT_SETTINGS, liveRefreshMinutes: 5 as const };

test('바뀐 항목을 "항목: 이전 → 이후"로 남긴다', () => {
  const kv = safeStorage(undefined);
  const log = recordSettings(kv, base, { liveRefreshMinutes: 3 }, 1000);
  expect(log).toHaveLength(1);
  expect(describeChange(log[0])).toBe('라이브 자동 갱신: 5분마다 → 3분마다');
});

test('켜고 끄는 항목은 켬·끔으로', () => {
  const kv = safeStorage(undefined);
  const [c] = recordSettings(kv, base, { liveNotify: true }, 1);
  expect(describeChange(c)).toBe('즐겨찾기 방송 시작 알림: 끔 → 켬');
});

test('선택지 문구의 괄호 설명은 뺀다', () => {
  const kv = safeStorage(undefined);
  const [c] = recordSettings(kv, { ...DEFAULT_SETTINGS }, { liveRefreshMinutes: 3 }, 1);
  expect(describeChange(c)).toBe('라이브 자동 갱신: 끔 → 3분마다');
});

test('같은 값으로 바꾸면 남기지 않는다', () => {
  const kv = safeStorage(undefined);
  expect(recordSettings(kv, base, { liveRefreshMinutes: 5, quickAmounts: [...base.quickAmounts] }, 1)).toEqual([]);
});

test('2초 안에 같은 항목이 연속으로 바뀌면 한 건으로 묶는다', () => {
  const kv = safeStorage(undefined);
  recordSettings(kv, base, { masterVolume: 80 }, 0);
  const log = recordSettings(kv, { ...base, masterVolume: 80 }, { masterVolume: 60 }, 1000);
  expect(log).toHaveLength(1);
  expect(describeChange(log[0])).toBe('기본 볼륨: 100 → 60');
  expect(recordSettings(kv, { ...base, masterVolume: 60 }, { masterVolume: 50 }, 4000)).toHaveLength(2);
});

test('최근 100건만 보관', () => {
  const kv = safeStorage(undefined);
  for (let i = 0; i < 101; i++) recordSettings(kv, { ...base, liveNotify: i % 2 === 1 }, { liveNotify: i % 2 === 0 }, i * 10_000);
  expect(readSettingsLog(kv)).toHaveLength(100);
});

test('깨진 저장값·모르는 항목은 버린다', () => {
  const kv = safeStorage(undefined);
  kv.set(SETTINGS_LOG_KEY, 'nope');
  expect(readSettingsLog(kv)).toEqual([]);
  kv.set(SETTINGS_LOG_KEY, JSON.stringify([{ at: 1, key: 'zzz', from: 1, to: 2 }, { at: 2, key: 'theme', from: 'light', to: 'dark' }]));
  expect(readSettingsLog(kv)).toEqual([{ at: 2, key: 'theme', from: 'light', to: 'dark' }]);
});
