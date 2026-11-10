import { barsHidden, floatingBox } from '../../src/ui/phoneScroll';

const vp = { width: 375, height: 812 };

test('선택한 칸이 화면 안에 보이면 떠 있는 창 없음', () => {
  expect(floatingBox({ left: 8, top: 100, width: 359, height: 202 }, vp)).toBeNull();
  expect(floatingBox({ left: 8, top: -100, width: 359, height: 202 }, vp)).toBeNull(); // 아직 절반 넘게 보임
});

test('위로 넘어가거나 아래로 밀려나면 오른쪽 아래 하단 바 위에 작은 창 (화면 기준 좌표)', () => {
  const box = floatingBox({ left: 8, top: -300, width: 359, height: 202 }, vp)!;
  expect(box).toEqual({ left: 375 - 10 - 173, top: 812 - 70 - 10 - 97, width: 173, height: 97 });
  expect(floatingBox({ left: 8, top: 760, width: 359, height: 202 }, vp)).not.toBeNull();
  // 세로 방송은 세로로 길게
  expect(floatingBox({ left: 8, top: -390, width: 359, height: 404 }, vp, true)).toMatchObject({ width: 96, height: 170 });
});

test('바 숨기기: 아래로 넘기면 숨기고 위로 올리면 보인다, 맨 위 근처는 늘 보인다', () => {
  expect(barsHidden(100, 140, false)).toBe(true);
  expect(barsHidden(140, 120, true)).toBe(false);
  expect(barsHidden(140, 144, true)).toBe(true); // 조금 흔들린 것은 그대로
  expect(barsHidden(200, 30, true)).toBe(false);
});
