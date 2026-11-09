import { orientationFromPixels } from '../../src/players/verticalThumb';

/** w×h RGBA 이미지: 안쪽 사각형(x0..x1, y0..y1)만 밝고 나머지는 검은 여백 */
function image(w: number, h: number, box: [number, number, number, number] | null) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const on = box && x >= box[0] && x < box[1] && y >= box[2] && y < box[3];
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = on ? 150 + ((x * 7 + y * 3) % 80) : 4;
      data[i + 3] = 255;
    }
  return data;
}

test('유튜브 썸네일(4:3 틀) 안 내용 영역의 비율로 세로·가로를 판단', () => {
  // 세로 영상: 양옆이 검은 여백 (480×360 썸네일에서 139~341만 내용)
  expect(orientationFromPixels(image(48, 36, [14, 34, 0, 36]), 48, 36)).toBe(true);
  // 가로 영상: 위아래 검은 여백 (16:9)
  expect(orientationFromPixels(image(48, 36, [0, 48, 4, 31]), 48, 36)).toBe(false);
  // 꽉 찬 4:3
  expect(orientationFromPixels(image(48, 36, [0, 48, 0, 36]), 48, 36)).toBe(false);
  // 전부 검다: 알 수 없음
  expect(orientationFromPixels(image(48, 36, null), 48, 36)).toBeNull();
});
