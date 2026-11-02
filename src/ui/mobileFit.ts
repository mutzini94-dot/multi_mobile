/** 투네이션 후원 페이지는 화면 폭 768px부터 PC판(배너·메뉴)이다. 이보다 좁으면 모바일판 */
export const MOBILE_MAX_WIDTH = 767;

/**
 * 후원 페이지를 모바일판으로 칸에 꽉 채우기: 칸이 모바일 폭보다 넓으면 페이지를 모바일 폭으로 그리고 칸 크기만큼 키운다.
 * width·height: 페이지를 그릴 크기, scale: 키우는 배율 (width*scale = 칸 폭, height*scale = 칸 높이)
 */
export function mobileFit(boxWidth: number, boxHeight: number, max = MOBILE_MAX_WIDTH): { width: number; height: number; scale: number } {
  if (boxWidth <= max) return { width: boxWidth, height: boxHeight, scale: 1 };
  const scale = boxWidth / max;
  return { width: max, height: boxHeight / scale, scale };
}
