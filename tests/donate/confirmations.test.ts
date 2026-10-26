import { markConfirmed, needsConfirm } from '../../src/donate/confirmations';
import { safeStorage } from '../../src/storage/safeStorage';
import { mkCreator } from '../helpers/fixtures';

const kv = () => safeStorage(undefined);

test('manual이면 확인 불필요', () => expect(needsConfirm(mkCreator(1), kv())).toBe(false));
test('link이고 기록이 없으면 확인 필요', () => expect(needsConfirm(mkCreator(1, { source: 'link' }), kv())).toBe(true));
test('markConfirmed 후에는 불필요', () => {
  const store = kv();
  const c = mkCreator(1, { source: 'link' });
  markConfirmed(c, store);
  expect(needsConfirm(c, store)).toBe(false);
});
test('같은 채널이라도 donateId가 다르면 다시 필요', () => {
  const store = kv();
  markConfirmed(mkCreator(1, { source: 'link' }), store);
  expect(needsConfirm(mkCreator(1, { source: 'link', donateId: 'other' }), store)).toBe(true);
});
test('저장값이 깨져 있어도 동작', () => {
  const store = kv();
  store.set('mv.confirmed.v1', '{bad');
  expect(needsConfirm(mkCreator(1, { source: 'link' }), store)).toBe(true);
});
