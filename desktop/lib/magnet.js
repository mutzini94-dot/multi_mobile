'use strict';
// 크리에이터 리모컨 위젯 창의 자석 기능: 창끼리 가까워지면 모서리가 붙는다.
// caprisontoon/remote01 의 electron/magnet.ts 를 옮긴 것.

const SNAP = 14;

const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

/** rect를 others의 가장자리에 붙인다. 붙을 곳이 없으면 그대로 돌려준다. */
function snap(rect, others, threshold = SNAP) {
  let { x, y } = rect;
  let bestX = threshold + 1;
  let bestY = threshold + 1;
  for (const o of others) {
    const vertical = overlaps(rect.y, rect.y + rect.height, o.y - threshold, o.y + o.height + threshold);
    const horizontal = overlaps(rect.x, rect.x + rect.width, o.x - threshold, o.x + o.width + threshold);
    if (vertical) {
      const candidates = [
        [o.x + o.width, Math.abs(rect.x - (o.x + o.width))], // 내 왼쪽 ↔ 상대 오른쪽
        [o.x - rect.width, Math.abs(rect.x + rect.width - o.x)], // 내 오른쪽 ↔ 상대 왼쪽
      ];
      for (const [nx, d] of candidates) if (d < bestX) { bestX = d; x = nx; }
    }
    if (horizontal) {
      const candidates = [
        [o.y + o.height, Math.abs(rect.y - (o.y + o.height))],
        [o.y - rect.height, Math.abs(rect.y + rect.height - o.y)],
      ];
      for (const [ny, d] of candidates) if (d < bestY) { bestY = d; y = ny; }
    }
  }
  // 붙은 축의 반대쪽 모서리도 가까우면 정렬 (위·아래 끝 맞춤)
  for (const o of others) {
    if (bestX <= threshold && Math.abs(y - o.y) < threshold && bestY > threshold) { y = o.y; bestY = 0; }
    if (bestY <= threshold && Math.abs(x - o.x) < threshold && bestX > threshold) { x = o.x; bestX = 0; }
  }
  return { ...rect, x, y };
}

/** 두 창이 맞닿아 있는지 (1px 오차 허용) */
function touching(a, b) {
  const v = overlaps(a.y, a.y + a.height, b.y, b.y + b.height);
  const h = overlaps(a.x, a.x + a.width, b.x, b.x + b.width);
  return (
    (v && (Math.abs(a.x + a.width - b.x) <= 1 || Math.abs(b.x + b.width - a.x) <= 1)) ||
    (h && (Math.abs(a.y + a.height - b.y) <= 1 || Math.abs(b.y + b.height - a.y) <= 1))
  );
}

/** anchor에 직접 또는 다른 창을 거쳐 붙어 있는 창들 (메인 창을 옮기면 같이 움직일 무리) */
function attachedGroup(anchor, windows) {
  const group = [];
  const frontier = [anchor];
  const left = new Map(windows);
  while (frontier.length) {
    const cur = frontier.pop();
    for (const [k, b] of left) {
      if (touching(cur, b)) {
        group.push(k);
        frontier.push(b);
        left.delete(k);
      }
    }
  }
  return group;
}

module.exports = { SNAP, snap, touching, attachedGroup };
