import { restoreIfNewer, SAVED_AT_KEY, snapshotStorage, startMirror } from '../../src/storage/webStoreSync';

beforeEach(() => localStorage.clear());

test('snapshotStorage: mv. 저장값만 (저장 시각 표시는 빼고)', () => {
  localStorage.setItem('mv.settings.v1', '{}');
  localStorage.setItem('other', 'x');
  localStorage.setItem(SAVED_AT_KEY, '9');
  expect(snapshotStorage(localStorage)).toEqual({ 'mv.settings.v1': '{}' });
});

test('restoreIfNewer: 사본이 더 최신이면 (포트가 바뀌어 비어 있는 경우 포함) 사본으로 바꾼다', () => {
  localStorage.setItem('mv.old', 'gone');
  expect(restoreIfNewer(localStorage, { savedAt: 100, data: { 'mv.settings.v1': '{"theme":"dark"}' } })).toBe(true);
  expect(localStorage.getItem('mv.settings.v1')).toBe('{"theme":"dark"}');
  expect(localStorage.getItem('mv.old')).toBeNull();
  expect(localStorage.getItem(SAVED_AT_KEY)).toBe('100');
});

test('restoreIfNewer: 여기가 더 최신이거나 같으면 그대로, 사본이 없으면 그대로', () => {
  localStorage.setItem('mv.settings.v1', 'local');
  localStorage.setItem(SAVED_AT_KEY, '200');
  expect(restoreIfNewer(localStorage, { savedAt: 100, data: { 'mv.settings.v1': 'copy' } })).toBe(false);
  expect(restoreIfNewer(localStorage, null)).toBe(false);
  expect(localStorage.getItem('mv.settings.v1')).toBe('local');
});

test('startMirror: 바뀐 것이 있을 때만 저장 시각을 붙여 사본으로 보낸다', () => {
  vi.useFakeTimers();
  try {
    const save = vi.fn();
    const stop = startMirror(localStorage, save, 1000);
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1); // 처음 한 번 (지금 상태)
    vi.advanceTimersByTime(3000);
    expect(save).toHaveBeenCalledTimes(1); // 바뀐 것 없음
    localStorage.setItem('mv.favorites.v1', '[]');
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(2);
    const snap = save.mock.calls[1][0];
    expect(snap.data).toEqual({ 'mv.favorites.v1': '[]' });
    expect(String(snap.savedAt)).toBe(localStorage.getItem(SAVED_AT_KEY));
    stop();
  } finally {
    vi.useRealTimers();
  }
});
