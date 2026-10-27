'use strict';
// 멀티뷰 웹 앱에 설치형 기능을 노출한다 (src/desktop/desktopApi.ts의 DesktopApi).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('multiviewDesktop', {
  status: () => ipcRenderer.invoke('mv:status'),
  login: () => ipcRenderer.invoke('mv:login'),
  logout: () => ipcRenderer.invoke('mv:logout'),
  favorites: () => ipcRenderer.invoke('mv:favorites'),
  openDonate: (t) =>
    ipcRenderer.send('mv:donate:open', {
      tag: String(t && t.tag),
      name: String(t && t.name),
      mode: t && (t.mode === 'pip' || t.mode === 'modal') ? t.mode : undefined,
      amounts: t && Array.isArray(t.amounts) ? t.amounts.map(Number) : undefined,
    }),
  fillDonate: (amount) => ipcRenderer.send('mv:donate:fill', Number(amount)),
  setAlwaysOnTop: (on) => ipcRenderer.send('mv:window:alwaysOnTop', !!on),
  closeDonate: () => ipcRenderer.send('mv:donate:close'),
  setDonateBounds: (r) => ipcRenderer.send('mv:donate:bounds', { x: +r.x, y: +r.y, width: +r.width, height: +r.height }),
  setDonateMode: (mode) => ipcRenderer.send('mv:donate:mode', mode === 'pip' ? 'pip' : 'modal'),
  onDonateClosed: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('mv:donate:closed', fn);
    return () => ipcRenderer.removeListener('mv:donate:closed', fn);
  },
  onDonateMode: (cb) => {
    const fn = (_e, mode) => cb(mode === 'pip' ? 'pip' : 'modal');
    ipcRenderer.on('mv:donate:mode', fn);
    return () => ipcRenderer.removeListener('mv:donate:mode', fn);
  },
});
