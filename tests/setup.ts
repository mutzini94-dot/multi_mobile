import '@testing-library/jest-dom/vitest';

// jsdom에는 PointerEvent가 없어 fireEvent.pointer*가 좌표 없는 일반 Event가 된다.
// 끌기 기준 거리(useTileDrag)를 시험할 수 있도록 MouseEvent 기반으로 채운다.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
}
