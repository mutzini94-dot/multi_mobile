'use strict';
// 후원창: 같은 후원 페이지(WebContentsView 하나)를 두 자리 중 한 곳에 붙인다.
//   modal — 메인 창 가운데 (웹이 그린 모달 틀의 본문 자리에 놓는다)
//   pip   — 항상 위에 떠 있는 작은 별도 창 (얇은 머리줄 아래)
// 자리를 옮길 때는 페이지를 새로 만들지 않고 붙이는 곳만 바꾸므로 입력 중인 금액·메시지가 유지된다.

const PIP_HEAD = 36; // PIP 창 머리줄(pip.html) 높이

function createDonateController({ main, createView, createPipWindow, donateUrl, send }) {
  let view = null;
  let pip = null;
  let mode = 'modal'; // 마지막으로 쓴 모드 (다시 열 때도 그대로)
  let tag = null;
  let name = null;

  const titleOf = (n) => `${n}에게 후원 · 멀티뷰 후원`;

  function layoutPip() {
    if (!pip || pip.isDestroyed() || !view) return;
    const [width, height] = pip.getContentSize();
    view.setBounds({ x: 0, y: PIP_HEAD, width, height: Math.max(0, height - PIP_HEAD) });
  }

  function detach() {
    if (!view) return;
    if (mode === 'modal') main.contentView.removeChildView(view);
    else if (pip && !pip.isDestroyed()) pip.contentView.removeChildView(view);
  }

  function closePipWindow() {
    const w = pip;
    pip = null; // onClosed에서 후원 전체를 닫지 않도록 먼저 비운다
    if (w && !w.isDestroyed()) w.close();
  }

  function attach(next) {
    if (next === 'modal') {
      closePipWindow();
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 }); // 웹이 모달 본문 자리를 알려주면 놓는다
      main.contentView.addChildView(view);
    } else {
      if (!pip || pip.isDestroyed()) {
        const w = createPipWindow({
          title: titleOf(name),
          onResize: layoutPip,
          // 사용자가 PIP 창을 직접 닫음 → 후원을 닫는다 (모달로 옮기느라 닫은 경우는 pip가 이미 비어 있다)
          onClosed: () => pip === w && close(),
        });
        pip = w;
      }
      pip.setTitle(titleOf(name));
      pip.contentView.addChildView(view);
      layoutPip();
    }
    mode = next;
    send('mv:donate:mode', mode);
  }

  // wantMode: 설정의 후원창 기본 모드 ('modal' | 'pip'). 없으면 마지막으로 쓴 모드
  function open(nextTag, nextName, wantMode) {
    tag = nextTag;
    name = nextName;
    const target = wantMode === 'modal' || wantMode === 'pip' ? wantMode : mode;
    if (!view) {
      view = createView();
      attach(target);
    } else if (target !== mode) {
      detach();
      attach(target);
    } else if (mode === 'pip' && pip && !pip.isDestroyed()) {
      pip.setTitle(titleOf(name));
      pip.focus();
    }
    view.webContents.loadURL(donateUrl(tag));
  }

  function setMode(next) {
    if (!view || (next !== 'modal' && next !== 'pip') || next === mode) return;
    detach();
    attach(next);
  }

  function setModalBounds(r) {
    if (!view || mode !== 'modal' || !r) return;
    const n = (v) => Math.max(0, Math.round(Number(v) || 0));
    view.setBounds({ x: n(r.x), y: n(r.y), width: n(r.width), height: n(r.height) });
  }

  function close({ notify = true } = {}) {
    if (!view) return;
    const v = view;
    detach();
    view = null;
    tag = null;
    name = null;
    closePipWindow();
    if (typeof v.webContents.close === 'function') v.webContents.close();
    if (notify) send('mv:donate:closed');
  }

  return {
    open,
    setMode,
    setModalBounds,
    close,
    state: () => ({ open: !!view, mode, tag, name }),
    /** 점검(스모크)용: 현재 후원 페이지 */
    view: () => view,
    /** 메인 창이 사라졌을 때: PIP 창까지 정리 */
    dispose: () => close({ notify: false }),
  };
}

module.exports = { createDonateController, PIP_HEAD };
