import { MOBILE_MAX_WIDTH, mobileFit } from '../../src/ui/mobileFit';

test('투네이션 후원 페이지는 768px부터 PC판: 모바일판 최대 폭은 767px', () => {
  expect(MOBILE_MAX_WIDTH).toBe(767);
});

test('칸이 모바일 폭 안이면 그대로 꽉 채운다 (배율 1)', () => {
  expect(mobileFit(600, 400)).toEqual({ width: 600, height: 400, scale: 1 });
  expect(mobileFit(767, 500)).toEqual({ width: 767, height: 500, scale: 1 });
});

test('칸이 더 넓으면 767px 폭으로 그린 뒤 칸 크기만큼 키워 좌우 여백 없이 채운다', () => {
  const f = mobileFit(1534, 1000);
  expect(f.width).toBe(767);
  expect(f.scale).toBe(2);
  expect(f.height).toBe(500); // 키우면 칸 높이와 같다
  expect(f.width * f.scale).toBe(1534);
});

test('크기를 아직 모르면(0) 배율 1', () => {
  expect(mobileFit(0, 0)).toEqual({ width: 0, height: 0, scale: 1 });
});
