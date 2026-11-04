'use strict';
// 멀티뷰 웹 앱에 설치형 기능을 노출한다 (src/desktop/desktopApi.ts의 DesktopApi).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('multiviewDesktop', {
  status: () => ipcRenderer.invoke('mv:status'),
  login: () => ipcRenderer.invoke('mv:login'),
  logout: () => ipcRenderer.invoke('mv:logout'),
  favorites: () => ipcRenderer.invoke('mv:favorites'),
  history: () => ipcRenderer.invoke('mv:history'),
  // 웹 화면 저장값 사본 (포트가 바뀌어도 설정·즐겨찾기가 남도록)
  webStoreLoad: () => ipcRenderer.invoke('mv:webstore:load'),
  webStoreSave: (snap) => ipcRenderer.send('mv:webstore:save', snap),
  search: (q) => ipcRenderer.invoke('mv:search', String(q)),
  bookmark: (tag, on) => ipcRenderer.invoke('mv:bookmark', { tag: String(tag), on: !!on }),
  signatures: (tag) => ipcRenderer.invoke('mv:signatures', String(tag)),
  selectSignature: (name, tag) => ipcRenderer.invoke('mv:donate:signature', { name: String(name), tag: String(tag) }),
  openDonate: (t) =>
    ipcRenderer.send('mv:donate:open', {
      tag: String(t && t.tag),
      name: String(t && t.name),
      mode: t && (t.mode === 'pip' || t.mode === 'modal') ? t.mode : undefined,
      amounts: t && Array.isArray(t.amounts) ? t.amounts.map(Number) : undefined,
      messages: t && Array.isArray(t.messages) ? t.messages.map(String) : undefined,
    }),
  fillDonate: (amount) => ipcRenderer.send('mv:donate:fill', Number(amount)),
  fillDonateMessage: (message) => ipcRenderer.send('mv:donate:fillMessage', String(message)),
  setAlwaysOnTop: (on) => ipcRenderer.send('mv:window:alwaysOnTop', !!on),
  setMiniMode: (on) => ipcRenderer.send('mv:window:mini', !!on),
  // 앱 옵션(Windows 시작 시 실행·닫으면 트레이로·자동 업데이트)과 업데이트
  appInfo: () => ipcRenderer.invoke('mv:app:info'),
  setAppOption: (key, value) => ipcRenderer.invoke('mv:app:set', String(key), !!value),
  checkUpdate: () => ipcRenderer.send('mv:app:checkUpdate'),
  installUpdate: () => ipcRenderer.send('mv:app:installUpdate'),
  onAppInfo: (cb) => {
    const fn = (_e, info) => cb(info);
    ipcRenderer.on('mv:app:info', fn);
    return () => ipcRenderer.removeListener('mv:app:info', fn);
  },
  closeDonate: () => ipcRenderer.send('mv:donate:close'),
  setDonateBounds: (r) => ipcRenderer.send('mv:donate:bounds', { x: +r.x, y: +r.y, width: +r.width, height: +r.height }),
  setDonateMode: (mode) => ipcRenderer.send('mv:donate:mode', mode === 'pip' ? 'pip' : 'modal'),
  onDonateClosed: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('mv:donate:closed', fn);
    return () => ipcRenderer.removeListener('mv:donate:closed', fn);
  },
  // 칸 분리 창 (메인 화면 쪽)
  detachOpen: (p) => ipcRenderer.send('mv:detach:open', { id: String(p && p.id), url: String(p && p.url), title: String((p && p.title) || '') }),
  detachClose: (id) => ipcRenderer.send('mv:detach:close', String(id)),
  detachPost: (id, msg) => ipcRenderer.send('mv:detach:post', String(id), msg),
  onDetachMessage: (cb) => {
    const fn = (_e, d) => d && cb(String(d.id), d.msg);
    ipcRenderer.on('mv:detach:message', fn);
    return () => ipcRenderer.removeListener('mv:detach:message', fn);
  },
  onDetachClosed: (cb) => {
    const fn = (_e, id) => cb(String(id));
    ipcRenderer.on('mv:detach:closed', fn);
    return () => ipcRenderer.removeListener('mv:detach:closed', fn);
  },
  // 분리 창 쪽
  soloPost: (msg) => ipcRenderer.send('mv:solo:post', msg),
  onSoloMessage: (cb) => {
    const fn = (_e, msg) => cb(msg);
    ipcRenderer.on('mv:solo:message', fn);
    return () => ipcRenderer.removeListener('mv:solo:message', fn);
  },
  soloSetAlwaysOnTop: (on) => ipcRenderer.send('mv:solo:alwaysOnTop', !!on),
  onDonateMode: (cb) => {
    const fn = (_e, mode) => cb(mode === 'pip' ? 'pip' : 'modal');
    ipcRenderer.on('mv:donate:mode', fn);
    return () => ipcRenderer.removeListener('mv:donate:mode', fn);
  },
});
