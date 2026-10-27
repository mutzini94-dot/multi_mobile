'use strict';
// 저장한 창 위치·크기를 다시 쓸 수 있는지 판단한다: 지금 연결된 화면과 100px 이상 겹쳐야 한다
// (모니터를 빼서 창이 보이지 않는 곳에 열리는 일을 막는다).

const MIN_OVERLAP = 100;

function restoreBounds(saved, workAreas, fallback, min = { width: 0, height: 0 }) {
  const ok = saved && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(saved[k]));
  if (!ok) return fallback;
  const b = { x: Math.round(saved.x), y: Math.round(saved.y), width: Math.max(min.width, Math.round(saved.width)), height: Math.max(min.height, Math.round(saved.height)) };
  const visible = workAreas.some((a) => {
    const w = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
    const h = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
    return w >= MIN_OVERLAP && h >= MIN_OVERLAP;
  });
  return visible ? b : fallback;
}

module.exports = { restoreBounds };
