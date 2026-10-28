import { decodeSolo, encodeSolo, soloUrl } from '../../src/detach/soloLink';
import { makeDonatePage, makeWebPage } from '../../src/domain/pages';
import { mkCreator } from '../helpers/fixtures';

test('왕복: 방송 (라이브 영상 ID·소리 포함)', () => {
  const c = mkCreator(1, { source: 'toonation', videoId: 'm8HaYP0qcRM', platform: 'youtube', channel: 'UC' + 'a'.repeat(22), key: 'youtube:UC' + 'a'.repeat(22) });
  const p = decodeSolo(encodeSolo({ id: 'd1', item: c, sound: true }))!;
  expect(p.id).toBe('d1');
  expect(p.sound).toBe(true);
  expect(p.item).toMatchObject({ name: c.name, donateId: 'don1', platform: 'youtube', channel: c.channel, source: 'toonation', videoId: 'm8HaYP0qcRM' });
});

test('왕복: 웹페이지·후원 페이지 (따라갈 크리에이터 포함)', () => {
  const w = makeWebPage('naver.com');
  if (!w.ok) throw new Error();
  expect(decodeSolo(encodeSolo({ id: 'd2', item: w.value, sound: false }))!.item).toMatchObject({ kind: 'web', url: 'https://naver.com/' });
  const d = decodeSolo(encodeSolo({ id: 'd3', item: makeDonatePage(), sound: false, donateFor: mkCreator(2) }))!;
  expect(d.item).toMatchObject({ kind: 'donate' });
  expect(d.donateFor).toMatchObject({ donateId: 'don2' });
});

test('깨진 값·이상한 주소·잘못된 id는 null', () => {
  expect(decodeSolo('#solo=@@@')).toBeNull();
  expect(decodeSolo('#j=abc')).toBeNull();
  const bad = encodeSolo({ id: 'd1', item: { kind: 'web', key: 'web:x', name: 'x', url: 'https://x.com/' }, sound: false }).replace(/^#solo=/, '');
  const json = JSON.parse(atob(bad.replace(/-/g, '+').replace(/_/g, '/')));
  const re = (o: object) => '#solo=' + btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  expect(decodeSolo(re({ ...json, item: { kind: 'web', url: 'javascript:alert(1)' } }))).toBeNull();
  expect(decodeSolo(re({ ...json, id: '<script>' }))).toBeNull();
});

test('soloUrl: 지금 주소의 해시만 바꾼다', () => {
  const u = soloUrl('http://127.0.0.1:47230/?x=1#j=abc', { id: 'd1', item: makeDonatePage(), sound: false });
  expect(u.startsWith('http://127.0.0.1:47230/?x=1#solo=')).toBe(true);
});
