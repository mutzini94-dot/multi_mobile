import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings } from '../../src/settings/settings';
import { safeStorage } from '../../src/storage/safeStorage';

const kv = () => safeStorage(undefined);

test('기본값', () => {
  expect(loadSettings(kv())).toEqual(DEFAULT_SETTINGS);
  expect(DEFAULT_SETTINGS).toEqual({
    restoreLastView: true,
    defaultLayout: 'wideSide',
    hiddenSlotPlayback: 'keep',
    lowQualityOthers: false,
    autoReplaceEnded: false,
    showLiveInfo: true,
    monthlyGoal: 0,
    quickMessages: [],
    monthlyLimit: 0,
    videoClick: 'select',
    soundMode: 'single',
    masterVolume: 100,
    donateMode: 'last',
    quickAmounts: [1000, 5000, 10000],
    liveRefreshMinutes: 0,
    liveNotify: false,
    theme: 'system',
    skin: 'classic',
    shortcuts: true,
    alwaysOnTop: false,
    quickPanel: 'left',
  });
});

test('퀵패널 위치: 왼쪽·오른쪽·숨기기, 잘못된 값은 왼쪽', () => {
  const k = kv();
  k.set(SETTINGS_KEY, JSON.stringify({ quickPanel: 'right' }));
  expect(loadSettings(k).quickPanel).toBe('right');
  k.set(SETTINGS_KEY, JSON.stringify({ quickPanel: 'top' }));
  expect(loadSettings(k).quickPanel).toBe('left');
});

test('저장하면 다시 읽힌다', () => {
  const k = kv();
  saveSettings(k, { ...DEFAULT_SETTINGS, theme: 'dark', masterVolume: 40, quickAmounts: [500, 2000] });
  expect(loadSettings(k)).toMatchObject({ theme: 'dark', masterVolume: 40, quickAmounts: [500, 2000] });
});

test('잘못된 값은 항목별로 기본값으로 (나머지는 유지)', () => {
  const k = kv();
  k.set(SETTINGS_KEY, JSON.stringify({ theme: 'neon', masterVolume: 250, defaultLayout: 'grid9', quickAmounts: [-1, 'x', 3000, 3000.5, 2e9], liveRefreshMinutes: 7, shortcuts: false }));
  const s = loadSettings(k);
  expect(s.theme).toBe('system');
  expect(s.masterVolume).toBe(100);
  expect(s.defaultLayout).toBe('wideSide');
  expect(s.quickAmounts).toEqual([3000]); // 1~10,000,000 사이 정수만
  expect(s.liveRefreshMinutes).toBe(0); // 0·1·3·5·10만
  expect(s.shortcuts).toBe(false);
});

test('깨진 저장값이면 기본값', () => {
  const k = kv();
  k.set(SETTINGS_KEY, '{bad');
  expect(loadSettings(k)).toEqual(DEFAULT_SETTINGS);
});
