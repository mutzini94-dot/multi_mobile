'use strict';
// 후원 패널을 열 때 창을 오른쪽으로 넓히고(화면 끝이면 왼쪽으로 밀어서), 닫을 때 원래대로 되돌린다.

/** → { bounds: 새 창 위치·크기, shift: { x: 왼쪽으로 민 양, width: 실제로 늘어난 폭 } } */
function widenForPanel(b, area, panelW) {
  const width = Math.min(b.width + panelW, area.width);
  const x = Math.max(area.x, Math.min(b.x, area.x + area.width - width));
  return { bounds: { x, y: b.y, width, height: b.height }, shift: { x: b.x - x, width: width - b.width } };
}

function restoreFromPanel(cur, shift) {
  return { x: cur.x + shift.x, y: cur.y, width: cur.width - shift.width, height: cur.height };
}

module.exports = { widenForPanel, restoreFromPanel };
