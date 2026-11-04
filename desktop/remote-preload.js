'use strict';
// 크리에이터 리모컨(caprisontoon/remote01 웹 리모컨) 화면에 설치형 전용 API(window.toona)를 넣는다.
// remote01 의 electron/preload.ts 와 같은 모양이라 리모컨이 스스로 설치형 기능(실시간 후원·위젯 분리·압정·자석·단축키)을 켠다.
// main.js 가 리모컨 주소·세션(lib/remotePolicy.js)의 화면에만 이 preload를 붙인다.
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, cb) => {
  const h = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('toona', {
  platform: process.platform,
  window: {
    minimize: () => ipcRenderer.send('rm:window:minimize'),
    toggleMaximize: () => ipcRenderer.send('rm:window:toggleMaximize'),
    close: () => ipcRenderer.send('rm:window:close'),
    setPinned: (pinned) => ipcRenderer.send('rm:window:setPinned', !!pinned),
  },
  widgets: {
    detach: (id, opts) => ipcRenderer.send('rm:widgets:detach', String(id), opts),
    close: (id) => ipcRenderer.send('rm:widgets:close', String(id)),
    reattach: (id) => ipcRenderer.send('rm:widgets:reattach', String(id)),
    setPinned: (id, pinned) => ipcRenderer.send('rm:widgets:setPinned', String(id), !!pinned),
    list: () => ipcRenderer.invoke('rm:widgets:list'),
    onChanged: (cb) => on('rm:widgets:changed', cb),
    dragStart: (x, y) => ipcRenderer.send('rm:widgets:dragStart', x, y),
    dragMove: (x, y) => ipcRenderer.send('rm:widgets:dragMove', x, y),
    dragEnd: (x, y) => ipcRenderer.send('rm:widgets:dragEnd', x, y),
    onDragOver: (cb) => on('rm:widgets:dragOver', cb),
    onDrop: (cb) => on('rm:widgets:drop', cb),
  },
  sync: {
    post: (msg) => ipcRenderer.send('rm:sync:post', msg),
    on: (cb) => on('rm:sync:msg', cb),
  },
  setShortcuts: (list) => ipcRenderer.invoke('rm:shortcuts:set', list),
  onShortcut: (cb) => on('rm:shortcut', cb),
  toonation: {
    connect: (input) => ipcRenderer.invoke('rm:toonation:connect', String(input || '')),
    disconnect: () => ipcRenderer.invoke('rm:toonation:disconnect'),
    rawMessages: () => ipcRenderer.invoke('rm:toonation:rawMessages'),
    onStatus: (cb) => on('rm:toonation:status', cb),
    onDonation: (cb) => on('rm:toonation:donation', cb),
  },
  openExternal: (url) => ipcRenderer.send('rm:app:openExternal', String(url || '')),
  // 리모컨의 '종료'는 이 앱 전체를 끄지 않고 후원 리모컨으로 돌아가지도 않는다: 창만 닫는다
  quit: () => ipcRenderer.send('rm:window:close'),
});
