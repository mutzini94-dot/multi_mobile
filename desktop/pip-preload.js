'use strict';
// PIP 후원창 머리줄(pip.html)의 버튼: 모달로 돌아가기 · 닫기
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mvPip', {
  toModal: () => ipcRenderer.send('mv:donate:mode', 'modal'),
  close: () => ipcRenderer.send('mv:pip:close'),
  onTitle: (cb) => ipcRenderer.on('mv:pip:title', (_e, t) => cb(String(t || ''))),
});
