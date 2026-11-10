import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { PageView } from '../../src/ui/PageView';

/** 창 크기 (jsdom은 레이아웃이 없어 틀의 clientWidth·clientHeight를 흉내) */
function fakeBox(width: number, height: number) {
  const w = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('page-view-fit') ? width : 0;
  });
  const h = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('page-view-fit') ? height : 0;
  });
  return () => {
    w.mockRestore();
    h.mockRestore();
  };
}

const donate = { kind: 'donate' as const, key: 'p1', name: '후원 페이지' };
let rerender: () => void = () => {};
function Host() {
  const [n, setN] = useState(0);
  rerender = () => setN((x) => x + 1);
  return <PageView page={donate} url={`https://toon.at/donate/abc`} embed="webview" key="pv" data-n={n} />;
}

test('후원 페이지 창: 크기가 그대로면 다시 그려도 크기를 다시 정하지 않는다 (전체 화면 나가기 등에서 무한 갱신으로 화면이 사라지던 문제)', () => {
  const restore = fakeBox(763, 355);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<Host />);
    for (let i = 0; i < 80; i++) act(() => rerender());
    expect(document.querySelector('webview')).not.toBeNull();
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/Maximum update depth/);
  } finally {
    errors.mockRestore();
    restore();
  }
});

test('후원 페이지 창이 모바일 폭보다 넓으면 767px로 그리고 창 크기만큼 키운다', () => {
  const restore = fakeBox(1534, 1000);
  try {
    render(<PageView page={donate} url="https://toon.at/donate/abc" embed="webview" />);
    const wv = document.querySelector('webview') as HTMLElement;
    expect(wv.style.width).toBe('767px');
    expect(wv.style.transform).toBe('scale(2)');
  } finally {
    restore();
  }
});
