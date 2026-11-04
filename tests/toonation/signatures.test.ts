import { filterSignatures, parseSignatures, sortSignatures, SIGNATURE_SORTS } from '../../src/toonation/signatures';

const raw = [
  { Hash: 'rnd', Name: '랜덤시그니처', Cash: 10000, DonationCount: 0, Enabled: 0, IsRandom: 1, Thumbnail: 0 },
  { Hash: 'a-1', Name: '슈퍼맨', Cash: 20000, DonationCount: 88, Enabled: 1, IsRandom: 0, Thumbnail: 1 },
  { Hash: 'b_2', Name: '딱밤 &amp; 터미널', Cash: 5000, DonationCount: 3, Enabled: 1, IsRandom: 0, Thumbnail: 1 },
  { Hash: 'c3', Name: '가나다', Cash: 12345, DonationCount: 3, Enabled: 1, IsRandom: 0, Thumbnail: 0 },
  { Hash: 'bad hash', Name: 'x', Cash: 1000, Enabled: 1 },
  { Hash: 'd4', Name: '', Cash: -1, Enabled: 1 },
  null,
];

test('parseSignatures: 켜진 시그니처만, 썸네일 주소, 이름 디코딩, 잘못된 항목은 뺀다', () => {
  const list = parseSignatures(raw);
  expect(list.map((s) => s.name)).toEqual(['슈퍼맨', '딱밤 & 터미널', '가나다']);
  expect(list[0]).toEqual({ hash: 'a-1', name: '슈퍼맨', cash: 20000, count: 88, image: 'https://cache.cdn.toona.xyz/prod/uploaded/__signature__/a-1_thumb.img' });
  expect(list[2].image).toBeNull(); // 썸네일 없음
  expect(parseSignatures('nope')).toEqual([]);
});

test('정렬: 인기순(기본)·낮은 금액순·높은 금액순·이름순', () => {
  const list = parseSignatures(raw);
  expect(SIGNATURE_SORTS.map((s) => s.label)).toEqual(['인기순', '낮은 금액순', '높은 금액순', '이름순']);
  expect(sortSignatures(list, 'popular').map((s) => s.name)).toEqual(['슈퍼맨', '딱밤 & 터미널', '가나다']); // 같은 횟수면 낮은 금액 먼저
  expect(sortSignatures(list, 'cashAsc').map((s) => s.cash)).toEqual([5000, 12345, 20000]);
  expect(sortSignatures(list, 'cashDesc').map((s) => s.cash)).toEqual([20000, 12345, 5000]);
  expect(sortSignatures(list, 'name').map((s) => s.name)).toEqual(['가나다', '딱밤 & 터미널', '슈퍼맨']);
});

test('검색: 이름 일부(대소문자·띄어쓰기 무시) 또는 금액', () => {
  const list = parseSignatures(raw);
  expect(filterSignatures(list, '터미').map((s) => s.name)).toEqual(['딱밤 & 터미널']);
  expect(filterSignatures(list, '딱밤&터미널').map((s) => s.name)).toEqual(['딱밤 & 터미널']);
  expect(filterSignatures(list, '20,000').map((s) => s.name)).toEqual(['슈퍼맨']);
  expect(filterSignatures(list, '12345').map((s) => s.name)).toEqual(['가나다']);
  expect(filterSignatures(list, '  ')).toHaveLength(3);
});
