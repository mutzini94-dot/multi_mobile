'use strict';

/**
 * 창 사이 끌어 놓기: 끄는 창의 화면 안 좌표(clientX/Y, 창 밖이면 음수·창 크기 이상)를 화면 좌표로 바꿔 놓인 창을 찾는다.
 * 창 순서(z-order)는 알 수 없으므로 끄는 창 자신 → 메인 창 → 다른 분리 창 순으로 본다.
 *
 * @param {{ source: 'main' | string, client: { x: number, y: number },
 *           main: { bounds: Rect, visible: boolean }, solos: { id: string, bounds: Rect, visible: boolean }[] }} p
 *   bounds = 각 창의 내용 영역 (BrowserWindow.getContentBounds)
 * @returns {{ where: 'main', x: number, y: number } | { where: 'solo', id: string } | { where: 'self' } | { where: 'outside', x: number, y: number } | null}
 *   main: 메인 창 안 좌표, outside: 화면 좌표
 */
function dropTarget({ source, client, main, solos }) {
  if (!client || !Number.isFinite(client.x) || !Number.isFinite(client.y)) return null;
  const src = source === 'main' ? main : solos.find((s) => s.id === source);
  if (!src || !src.bounds) return null;
  const p = { x: Math.round(src.bounds.x + client.x), y: Math.round(src.bounds.y + client.y) };
  const inside = (w) => w && w.visible && w.bounds && p.x >= w.bounds.x && p.y >= w.bounds.y && p.x < w.bounds.x + w.bounds.width && p.y < w.bounds.y + w.bounds.height;
  if (inside(src)) return { where: 'self' };
  if (source !== 'main' && inside(main)) return { where: 'main', x: p.x - main.bounds.x, y: p.y - main.bounds.y };
  const other = solos.find((s) => s.id !== source && inside(s));
  if (other) return { where: 'solo', id: other.id };
  return { where: 'outside', x: p.x, y: p.y };
}

/** 창 밖에 놓아 새로 여는 분리 창 자리: 커서가 창 위쪽 가운데(위에서 20px)에 오게, 커서가 있는 화면 안으로 */
function soloPlacement(point, size, workAreas) {
  const area =
    workAreas.find((a) => point.x >= a.x && point.y >= a.y && point.x < a.x + a.width && point.y < a.y + a.height) || workAreas[0];
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    x: Math.round(clamp(point.x - width / 2, area.x, area.x + area.width - width)),
    y: Math.round(clamp(point.y - 20, area.y, area.y + area.height - height)),
    width,
    height,
  };
}

module.exports = { dropTarget, soloPlacement };
