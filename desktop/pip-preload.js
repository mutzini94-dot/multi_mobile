'use strict';
// PIP 후원창 머리줄(pip.html)의 버튼: 빠른 후원 금액 · 모달로 돌아가기 · 닫기
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mvPip', {
  toModal: () => ipcRenderer.send('mv:donate:mode', 'modal'),
  close: () => ipcRenderer.send('mv:pip:close'),
  onTitle: (cb) => ipcRenderer.on('mv:pip:title', (_e, t) => cb(String(t || ''))),
  fill: (amount) => ipcRenderer.send('mv:donate:fill', Number(amount)),
  fillMessage: (message) => ipcRenderer.send('mv:donate:fillMessage', String(message)),
  onMessages: (cb) => ipcRenderer.on('mv:pip:messages', (_e, a) => cb(Array.isArray(a) ? a.map(String) : [])),
  onAmounts: (cb) => ipcRenderer.on('mv:pip:amounts', (_e, a) => cb(Array.isArray(a) ? a.map(Number) : [])),
});
