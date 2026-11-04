'use strict';
// 크리에이터 리모컨의 설치형 전용 기능 (remote01 electron/main.ts 를 이 앱에 맞게 옮긴 것).
// - 메인 리모컨(leader)은 우리 메인 창 안의 <webview> (partition persist:remote)
// - 위젯을 끌어내면 테두리 없는 독립창(follower, #/widget/<id>)으로, 압정(항상 위)·자석·끌어 넣기(드레그 인)
// - 창 간 상태 동기화(sync), 전역 단축키, 투네이션 실시간 후원(알림창 웹소켓), 외부 링크는 기본 브라우저
// 요청은 리모컨 화면(leader webview·위젯 창)에서 온 것만 받는다.
const fs = require('fs');
const { attachedGroup, snap } = require('./magnet');
const { ToonationFeed } = require('./remoteFeed');
const { REMOTE_PARTITION, WIDGET_MIN, isRemoteUrl, widgetUrl, detachBounds, EMBED_CSS } = require('./remotePolicy');

/** 메인 창 화면에서 리모컨 webview 자리 (숨겨져 있으면 null) */
const LEADER_RECT_JS = `(() => { const r = document.querySelector('.creator-remote webview')?.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 ? [r.left, r.top, r.width, r.height] : null; })()`;

function createRemoteHost({ electron, getMain, preload, statePath, icon, fetchImpl, WebSocketImpl }) {
  const { BrowserWindow, ipcMain, globalShortcut, shell } = electron;
  let leader = null;
  let restored = false;
  const detached = new Map(); // id → { win, info: { bounds, pinned, title }, keepInState }
  let state = { detached: {} };
  try {
    state = { detached: {}, ...JSON.parse(fs.readFileSync(statePath, 'utf8')) };
  } catch {
    /* 처음 실행 */
  }
  let saveTimer;
  const saveState = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      } catch {
        /* 다음 저장 때 재시도 */
      }
    }, 300);
  };

  const alive = (wc) => wc && !wc.isDestroyed();
  const remoteContents = () => [leader, ...[...detached.values()].map((d) => d.win.webContents)].filter(alive);
  const toLeader = (channel, payload) => alive(leader) && leader.send(channel, payload);
  const isRemoteSender = (e) => remoteContents().includes(e.sender);
  const detachedIdOf = (e) => [...detached].find(([, d]) => d.win.webContents === e.sender)?.[0];
  /** 요청한 화면의 창: leader면 우리 메인 창 */
  const windowOf = (e) => (e.sender === leader ? getMain() : BrowserWindow.fromWebContents(e.sender));

  function notifyWidgets() {
    const list = [...detached].map(([id, d]) => ({ id, pinned: d.info.pinned }));
    for (const wc of remoteContents()) wc.send('rm:widgets:changed', list);
  }

  // 리모컨 화면은 리모컨 주소 안에서만 움직이고, 밖으로 가는 링크는 기본 브라우저로
  function guard(wc) {
    wc.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    wc.on('will-navigate', (e, url) => {
      if (isRemoteUrl(url)) return;
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    });
  }

  function createDetached(id, info) {
    const url = widgetUrl(id);
    if (!url) return;
    if (detached.has(id)) {
      detached.get(id).win.focus();
      return;
    }
    const win = new BrowserWindow({
      ...info.bounds,
      minWidth: WIDGET_MIN.width,
      minHeight: WIDGET_MIN.height,
      frame: false,
      title: info.title,
      icon,
      backgroundColor: '#ffffff',
      webPreferences: { preload, partition: REMOTE_PARTITION, contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    guard(win.webContents);
    win.loadURL(url);
    if (info.pinned) win.setAlwaysOnTop(true, 'floating');
    const entry = { win, info, keepInState: false };
    detached.set(id, entry);
    state.detached[id] = info;
    saveState();
    const remember = () => {
      if (win.isDestroyed()) return;
      entry.info.bounds = win.getBounds();
      saveState();
    };
    win.on('moved', remember);
    win.on('resized', remember);
    win.on('closed', () => {
      detached.delete(id);
      if (!entry.keepInState) delete state.detached[id];
      saveState();
      notifyWidgets();
    });
    notifyWidgets();
  }

  /** 메인 창을 닫으면 위젯 창도 닫되, 다음에 리모컨을 열 때 되살린다 */
  function closeAllDetached() {
    for (const d of [...detached.values()]) {
      d.keepInState = true;
      if (!d.win.isDestroyed()) d.win.close();
    }
  }

  // ------------------------------------------------------------ leader (메인 창 안 webview)

  function attachLeader(wc) {
    leader = wc;
    guard(wc);
    wc.on('dom-ready', () => wc.insertCSS(EMBED_CSS).catch(() => {}));
    wc.on('did-finish-load', () => {
      if (restored) return;
      restored = true;
      for (const [id, info] of Object.entries(state.detached)) createDetached(id, info);
    });
    wc.once('destroyed', () => {
      if (leader !== wc) return;
      leader = null;
      restored = false;
      closeAllDetached();
    });
  }

  /** 메인 창을 옮기면 붙어 있는 위젯 창도 함께 이동 */
  function trackMain(win) {
    let last = win.getBounds();
    win.on('move', () => {
      if (win.isDestroyed() || win.isMaximized() || win.isMinimized()) return;
      const now = win.getBounds();
      const dx = now.x - last.x;
      const dy = now.y - last.y;
      if (dx || dy) {
        const boxes = new Map([...detached].map(([id, d]) => [id, d.win.getBounds()]));
        for (const id of attachedGroup(last, boxes)) {
          const w = detached.get(id).win;
          const b = w.getBounds();
          w.setPosition(b.x + dx, b.y + dy);
          detached.get(id).info.bounds = w.getBounds();
        }
        if (detached.size) saveState();
      }
      last = now;
    });
    win.on('resize', () => {
      if (!win.isDestroyed()) last = win.getBounds();
    });
  }

  // ------------------------------------------------------------ IPC

  const onRemote = (channel, fn) => ipcMain.on(channel, (e, ...args) => isRemoteSender(e) && fn(e, ...args));
  const handleRemote = (channel, fn) =>
    ipcMain.handle(channel, (e, ...args) => {
      if (!isRemoteSender(e)) throw new Error('FORBIDDEN');
      return fn(e, ...args);
    });

  onRemote('rm:window:minimize', (e) => windowOf(e)?.minimize());
  onRemote('rm:window:toggleMaximize', (e) => {
    const w = windowOf(e);
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
  });
  onRemote('rm:window:close', (e) => {
    if (e.sender !== leader) windowOf(e)?.close(); // 메인 리모컨은 우리 창 안이라 닫지 않는다
  });
  onRemote('rm:window:setPinned', (e, pinned) => {
    const w = windowOf(e);
    if (!w) return;
    w.setAlwaysOnTop(!!pinned, 'floating');
    if (pinned) w.moveTop();
  });

  onRemote('rm:widgets:detach', (_e, id, o) => {
    const bounds = detachBounds(o);
    if (bounds) createDetached(String(id), { bounds, pinned: false, title: String((o && o.title) || '').slice(0, 60) });
  });
  onRemote('rm:widgets:close', (_e, id) => detached.get(id)?.win.close());
  onRemote('rm:widgets:reattach', (_e, id) => detached.get(id)?.win.close());
  onRemote('rm:widgets:setPinned', (_e, id, pinned) => {
    const d = detached.get(id);
    if (!d) return;
    // 압정 on: 다른 창보다 항상 위. 여러 개면 최근에 켠 창이 가장 위
    d.win.setAlwaysOnTop(!!pinned, 'floating');
    if (pinned) d.win.moveTop();
    d.info.pinned = !!pinned;
    saveState();
    notifyWidgets();
  });
  handleRemote('rm:widgets:list', () => [...detached].map(([id, d]) => ({ id, pinned: d.info.pinned })));

  // 위젯 창 헤더 드래그: 창 이동 + 자석 + 메인 리모컨 위로 끌어오기(드레그 인)
  let drag = null;
  function leaderPoint(sx, sy) {
    const main = getMain();
    if (!drag || !drag.rect || !main || main.isDestroyed() || main.isMinimized() || !main.isVisible()) return null;
    const c = main.getContentBounds();
    const [l, t, w, h] = drag.rect;
    const x = sx - (c.x + l);
    const y = sy - (c.y + t);
    return x >= 0 && y >= 0 && x <= w && y <= h ? { clientX: x, clientY: y } : null;
  }
  onRemote('rm:widgets:dragStart', (e, sx, sy) => {
    const id = detachedIdOf(e);
    if (!id) return;
    const b = detached.get(id).win.getBounds();
    const cur = { id, offX: sx - b.x, offY: sy - b.y, overMain: false, rect: null };
    drag = cur;
    const main = getMain();
    if (main && !main.isDestroyed())
      main.webContents
        .executeJavaScript(LEADER_RECT_JS)
        .then((r) => {
          if (drag === cur) cur.rect = r;
        })
        .catch(() => {});
  });
  onRemote('rm:widgets:dragMove', (e, sx, sy) => {
    if (!drag || detachedIdOf(e) !== drag.id) return;
    const d = detached.get(drag.id);
    const b = d.win.getBounds();
    const main = getMain();
    const others = [main && !main.isDestroyed() && main.isVisible() && !main.isMinimized() ? main.getBounds() : null, ...[...detached].filter(([k]) => k !== drag.id).map(([, x]) => x.win.getBounds())].filter(Boolean);
    const next = snap({ x: Math.round(sx - drag.offX), y: Math.round(sy - drag.offY), width: b.width, height: b.height }, others);
    d.win.setPosition(next.x, next.y);
    const p = leaderPoint(sx, sy);
    if (p) {
      toLeader('rm:widgets:dragOver', { id: drag.id, ...p });
      drag.overMain = true;
    } else if (drag.overMain) {
      toLeader('rm:widgets:dragOver', null);
      drag.overMain = false;
    }
  });
  onRemote('rm:widgets:dragEnd', (e, sx, sy) => {
    if (!drag || detachedIdOf(e) !== drag.id) return;
    const p = leaderPoint(sx, sy);
    if (p) toLeader('rm:widgets:drop', { id: drag.id, ...p });
    else if (drag.overMain) toLeader('rm:widgets:dragOver', null);
    const d = detached.get(drag.id);
    if (d) {
      d.info.bounds = d.win.getBounds();
      saveState();
    }
    drag = null;
  });

  // 창 간 상태 동기화: 받은 메시지를 다른 리모컨 화면 모두에 전달
  onRemote('rm:sync:post', (e, msg) => {
    for (const wc of remoteContents()) if (wc !== e.sender) wc.send('rm:sync:msg', msg);
  });

  // 전역 단축키: 다른 프로그램보다 우선. 등록 실패(충돌)는 결과로 알려 준다. 우리가 등록한 것만 지운다
  let registered = [];
  const clearShortcuts = () => {
    for (const a of registered) {
      try {
        globalShortcut.unregister(a);
      } catch {
        /* 이미 해제 */
      }
    }
    registered = [];
  };
  handleRemote('rm:shortcuts:set', (_e, list) => {
    clearShortcuts();
    return (Array.isArray(list) ? list.slice(0, 50) : []).map((s) => {
      const id = String((s && s.id) || '');
      if (!s || !s.action || !s.accelerator) return { id, ok: true };
      try {
        const action = String(s.action);
        const ok = globalShortcut.register(String(s.accelerator), () => toLeader('rm:shortcut', action));
        if (ok) registered.push(String(s.accelerator));
        return { id, ok };
      } catch {
        return { id, ok: false };
      }
    });
  });

  // 투네이션 실시간 후원. 받은 원본 메시지 20개는 필드 확인(진단)용으로 보관한다
  const rawMessages = [];
  const feed = new ToonationFeed({
    onStatus: (s) => toLeader('rm:toonation:status', s),
    onDonation: (d) => toLeader('rm:toonation:donation', d),
    onRaw: (raw) => {
      rawMessages.unshift(raw);
      rawMessages.length = Math.min(rawMessages.length, 20);
    },
    fetch: fetchImpl,
    WebSocket: WebSocketImpl,
  });
  handleRemote('rm:toonation:connect', (_e, input) => feed.connect(String(input || '')));
  handleRemote('rm:toonation:disconnect', () => feed.disconnect());
  handleRemote('rm:toonation:rawMessages', () => rawMessages);

  onRemote('rm:app:openExternal', (_e, url) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });

  function dispose() {
    clearShortcuts();
    feed.disconnect();
  }

  return { attachLeader, trackMain, closeAllDetached, dispose, isLeader: (wc) => wc === leader, windows: () => [...detached].map(([id, d]) => ({ id, win: d.win })) };
}

module.exports = { createRemoteHost, LEADER_RECT_JS };
