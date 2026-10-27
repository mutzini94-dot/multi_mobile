'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createDonateController, PIP_HEAD } = require('../lib/donateController');

/** 창의 contentView 흉내 */
function host() {
  const children = [];
  return {
    children,
    contentView: {
      addChildView: (v) => children.push(v),
      removeChildView: (v) => children.splice(children.indexOf(v), 1),
    },
  };
}

function setup() {
  const main = host();
  const views = [];
  const pips = [];
  const sent = [];
  const ctrl = createDonateController({
    main,
    createView: () => {
      const v = { url: null, bounds: null, closed: false, webContents: { loadURL: (u) => (v.url = u), close: () => (v.closed = true) }, setBounds: (b) => (v.bounds = b) };
      views.push(v);
      return v;
    },
    createPipWindow: ({ title, onClosed, onResize }) => {
      const h = host();
      const w = { ...h, title, destroyed: false, size: { width: 420, height: 700 }, onClosed, onResize,
        getContentSize: () => [w.size.width, w.size.height], isDestroyed: () => w.destroyed,
        close: () => { if (!w.destroyed) { w.destroyed = true; onClosed(); } }, setTitle: (t) => (w.title = t), focus: () => {} };
      pips.push(w);
      return w;
    },
    donateUrl: (tag) => `https://toon.at/donate/${tag}`,
    send: (ch, p) => sent.push([ch, p]),
  });
  return { ctrl, main, views, pips, sent };
}

test('처음 열면 모달: 메인 창에 후원 페이지를 붙이고 웹이 알려준 자리에 놓는다', () => {
  const { ctrl, main, views, sent } = setup();
  ctrl.open('tagA', 'A');
  assert.strictEqual(views.length, 1);
  assert.strictEqual(views[0].url, 'https://toon.at/donate/tagA');
  assert.deepStrictEqual(main.children, [views[0]]);
  assert.deepStrictEqual(ctrl.state(), { open: true, mode: 'modal', tag: 'tagA', name: 'A' });
  assert.deepStrictEqual(sent.at(-1), ['mv:donate:mode', 'modal']);
  ctrl.setModalBounds({ x: 10.4, y: 20, width: 400, height: -5 });
  assert.deepStrictEqual(views[0].bounds, { x: 10, y: 20, width: 400, height: 0 });
});

test('PIP로 바꾸면 같은 후원 페이지를 PIP 창으로 옮긴다 (입력 내용 유지)', () => {
  const { ctrl, main, views, pips, sent } = setup();
  ctrl.open('tagA', 'A');
  ctrl.setMode('pip');
  assert.strictEqual(views.length, 1, '새로 만들지 않는다');
  assert.deepStrictEqual(main.children, []);
  assert.strictEqual(pips.length, 1);
  assert.deepStrictEqual(pips[0].children, [views[0]]);
  assert.match(pips[0].title, /A에게 후원/);
  assert.deepStrictEqual(views[0].bounds, { x: 0, y: PIP_HEAD, width: 420, height: 700 - PIP_HEAD });
  pips[0].size = { width: 500, height: 800 };
  pips[0].onResize();
  assert.deepStrictEqual(views[0].bounds, { x: 0, y: PIP_HEAD, width: 500, height: 800 - PIP_HEAD });
  assert.deepStrictEqual(sent.at(-1), ['mv:donate:mode', 'pip']);
});

test('PIP에서 모달로 돌아오면 PIP 창을 닫고 페이지를 메인 창으로 되돌린다 (닫힘 알림 없음)', () => {
  const { ctrl, main, views, pips, sent } = setup();
  ctrl.open('tagA', 'A');
  ctrl.setMode('pip');
  ctrl.setMode('modal');
  assert.strictEqual(pips[0].destroyed, true);
  assert.deepStrictEqual(main.children, [views[0]]);
  assert.strictEqual(views[0].closed, false);
  assert.ok(!sent.some(([ch]) => ch === 'mv:donate:closed'));
  assert.strictEqual(ctrl.state().mode, 'modal');
});

test('사용자가 PIP 창을 닫으면 후원을 닫고 웹에 알린다', () => {
  const { ctrl, views, pips, sent } = setup();
  ctrl.open('tagA', 'A');
  ctrl.setMode('pip');
  pips[0].close();
  assert.strictEqual(views[0].closed, true);
  assert.deepStrictEqual(sent.at(-1), ['mv:donate:closed', undefined]);
  assert.deepStrictEqual(ctrl.state(), { open: false, mode: 'pip', tag: null, name: null });
});

test('다른 크리에이터를 열면 같은 자리(마지막 모드)에서 페이지만 바꾼다', () => {
  const { ctrl, views, pips } = setup();
  ctrl.open('tagA', 'A');
  ctrl.setMode('pip');
  ctrl.open('tagB', 'B');
  assert.strictEqual(views.length, 1);
  assert.strictEqual(views[0].url, 'https://toon.at/donate/tagB');
  assert.strictEqual(pips.length, 1);
  assert.match(pips[0].title, /B에게 후원/);
});

test('닫았다가 다시 열면 마지막 모드(PIP)로 연다', () => {
  const { ctrl, pips } = setup();
  ctrl.open('tagA', 'A');
  ctrl.setMode('pip');
  ctrl.close();
  ctrl.open('tagA', 'A');
  assert.strictEqual(ctrl.state().mode, 'pip');
  assert.strictEqual(pips.length, 2);
});

test('웹이 닫으면(close) 웹에는 다시 알리지 않는다', () => {
  const { ctrl, views, sent } = setup();
  ctrl.open('tagA', 'A');
  ctrl.close({ notify: false });
  assert.strictEqual(views[0].closed, true);
  assert.ok(!sent.some(([ch]) => ch === 'mv:donate:closed'));
});

test('잘못된 모드·열리지 않은 상태의 요청은 무시', () => {
  const { ctrl, pips } = setup();
  ctrl.setMode('pip');
  ctrl.setModalBounds({ x: 0, y: 0, width: 1, height: 1 });
  assert.strictEqual(pips.length, 0);
  ctrl.open('tagA', 'A');
  ctrl.setMode('fullscreen');
  assert.strictEqual(ctrl.state().mode, 'modal');
});

test('open에 모드를 주면 그 모드로 연다 (설정: 후원창 기본 모드), 없으면 마지막 모드', () => {
  const { ctrl, main, pips, views } = setup();
  ctrl.open('tagA', 'A', 'pip');
  assert.strictEqual(ctrl.state().mode, 'pip');
  assert.deepStrictEqual(pips[0].children, [views[0]]);
  ctrl.open('tagB', 'B', 'modal'); // 열려 있는 PIP에서 모달로 옮겨 연다
  assert.strictEqual(ctrl.state().mode, 'modal');
  assert.deepStrictEqual(main.children, [views[0]]);
  ctrl.close();
  ctrl.open('tagA', 'A'); // 모드 없음 → 마지막(modal)
  assert.strictEqual(ctrl.state().mode, 'modal');
});
