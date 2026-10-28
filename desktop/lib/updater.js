'use strict';
// 자동 업데이트 (toon-widget의 updater.js와 같은 방식): electron-updater의 generic 제공자.
// 업데이트 폴더(HTTP(S))에 `npm run dist`가 만든 latest.yml과 설치 파일을 올려 두면 된다.
// 폴더 주소: MV_UPDATE_URL 환경 변수 > prefs의 updateUrl > package.json "multiview.updateUrl"(빌드할 때 scripts/dist.js가 넣음)
const { EventEmitter } = require('events');
const { app } = require('electron');

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

class Updater extends EventEmitter {
  constructor(prefs) {
    super();
    this.prefs = prefs;
    this.state = { status: 'idle', version: null, percent: 0, error: null };
    this.timer = null;
    this.au = null;
  }

  feedUrl() {
    let pkgUrl = '';
    try {
      pkgUrl = (require('../package.json').multiview || {}).updateUrl || '';
    } catch {
      /* 없음 */
    }
    return (process.env.MV_UPDATE_URL || this.prefs.get('updateUrl') || pkgUrl || '').trim();
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  start() {
    const url = this.feedUrl();
    if (!app.isPackaged) return this.set({ status: 'disabled', error: '개발 실행에서는 업데이트를 확인하지 않습니다' });
    if (!url) return this.set({ status: 'disabled', error: '업데이트 서버가 설정되지 않았습니다' });

    const { autoUpdater } = require('electron-updater');
    this.au = autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;
    autoUpdater.setFeedURL({ provider: 'generic', url });
    autoUpdater.on('checking-for-update', () => this.set({ status: 'checking', error: null }));
    autoUpdater.on('update-available', (i) => this.set({ status: 'downloading', version: i.version, percent: 0 }));
    autoUpdater.on('update-not-available', () => this.set({ status: 'latest', checkedAt: Date.now() }));
    autoUpdater.on('download-progress', (p) => this.set({ status: 'downloading', percent: Math.round(p.percent || 0) }));
    autoUpdater.on('update-downloaded', (i) => {
      this.set({ status: 'downloaded', version: i.version, percent: 100 });
      this.emit('downloaded', i);
    });
    autoUpdater.on('error', (e) => this.set({ status: 'error', error: String((e && e.message) || e).split('\n')[0] }));

    this.set({ status: 'idle' });
    setTimeout(() => this.check(), 15 * 1000);
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS);
  }

  /** force: 자동 업데이트를 꺼 두었어도 (사용자가 직접 '업데이트 확인'을 누름) */
  check(force = false) {
    if (!this.au || (!force && this.prefs.get('autoUpdate') === false)) return;
    if (this.state.status === 'downloading' || this.state.status === 'downloaded') return;
    this.au.checkForUpdates().catch((e) => this.set({ status: 'error', error: String(e.message || e).split('\n')[0] }));
  }

  installNow() {
    if (this.au && this.state.status === 'downloaded') this.au.quitAndInstall(false, true);
  }
}

module.exports = { Updater };
