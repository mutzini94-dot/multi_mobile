/** 휴대폰 화면 넘기기 계산 (떠 있는 미니 플레이어 · 상단·하단 바 숨기기) */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 위·아래로 이만큼 가려지면 칸이 '안 보인다'고 본다 (상단 바 52px · 하단 퀵패널 약 64px) */
const TOP_BAR = 56;
const BOTTOM_BAR = 70;

/**
 * 선택한 방송 칸이 화면 밖으로 넘어갔으면 오른쪽 아래(하단 바 위)에 떠 있는 작은 창 자리 (화면 기준 좌표, position: fixed), 아니면 null.
 * 세로 방송은 세로로 길게.
 */
export function floatingBox(cell: Box, viewport: { width: number; height: number }, vertical = false): Box | null {
  const hidden = cell.top + cell.height < TOP_BAR + 24 || cell.top > viewport.height - BOTTOM_BAR - 24;
  if (!hidden) return null;
  const width = vertical ? 96 : Math.min(176, Math.round(viewport.width * 0.46));
  const height = vertical ? 170 : Math.round((width * 9) / 16);
  return {
    left: Math.round(viewport.width - 10 - width),
    top: Math.round(viewport.height - BOTTOM_BAR - 10 - height),
    width,
    height,
  };
}

/** 아래로 넘기면 바를 숨기고, 위로 조금이라도 올리면 다시 보인다. 맨 위 근처에서는 늘 보인다 */
export function barsHidden(prevY: number, y: number, hidden: boolean): boolean {
  if (y < 60) return false;
  if (y - prevY > 8) return true;
  if (prevY - y > 8) return false;
  return hidden;
}
