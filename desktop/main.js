'use strict';
// 멀티뷰 후원 — 설치형(Electron). toon-widget(투네이션 후원 위젯)과 같은 방식:
//   - 전용 세션(persist:toonation)에서 공식 로그인 창을 띄우고, 같은 세션으로 계정·즐겨찾기를 가져온다
//     (비밀번호는 다루지 않는다)
//   - 후원은 창 오른쪽을 넓혀 붙이는 패널(WebContentsView, 같은 로그인 세션)로 연다
//   - 멀티뷰 화면은 웹 빌드(desktop/web)를 http://localhost:<port>로 띄운다 (트위치 임베드의 parent 제약)
// 개발: `npm run dev` 는 vite 개발 서버(http://localhost:5230)를 띄운 상태에서 실행한다.
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, WebContentsView, ipcMain, screen, session, shell } = require('electron');
const { ToonationClient, ORIGIN } = require('./lib/toonation');
const { youtubeChannelId } = require('./lib/platforms');
const { startStaticServer } = require('./lib/staticServer');
const { widenForPanel, restoreFromPanel } = require('./lib/windowMath');
const { createHandlers } = require('./lib/handlers');

const APP_NAME = '멀티뷰 후원';
const PARTITION = 'persist:toonation';
const PANEL_W = 448; // 웹의 .donate-panel 폭(440) + 간격(8)
const DEV = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5230/';
const ICON = path.join(__dirname, 'build', 'icon.png');
const DONATE_TAG_RE = /^[A-Za-z0-9_-]{1,64}$/;

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.setAppUserModelId('at.toon.donator.multiview');
// 방송은 사용자가 고르는 즉시 재생된다
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;
let ses = null;
let client = null;
let loginWin = null;
let server = null;
let donate = null; // { view, shift, tag }

const send = (channel, payload) => win && !win.isDestroyed() && win.webContents.send(channel, payload);

// ---------------------------------------------------------------- toon.at 창 (toon-widget과 동일)

const WEBKIT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)';
const CHROME_UA = `${WEBKIT_UA} Chrome/${process.versions.chrome} Safari/537.36`;

// 구글 로그인은 내장 브라우저를 거부하므로 구글 계정 페이지로 가는 창만 일반 크롬 UA로 바꾼다.
function useGoogleUa(wc) {
  const onNav = (e, url) => {
    if (/^https:\/\/accounts\.google\.com\//.test(url) && wc.getUserAgent() !== CHROME_UA) {
      e.preventDefault();
      wc.setUserAgent(CHROME_UA);
      wc.loadURL(url);
    }
  };
  wc.on('will-navigate', onNav);
  wc.on('will-redirect', onNav);
  wc.on('did-create-window', (child) => useGoogleUa(child.webContents));
}

// 결제·소셜 로그인 팝업은 같은 로그인 세션에서 연다.
function allowPopups(wc) {
  wc.setWindowOpenHandler(({ url }) =>
    /^https?:/.test(url)
      ? { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: ICON, webPreferences: { partition: PARTITION } } }
      : { action: 'deny' },
  );
}

function webWindow({ url, width = 520, height = 860, title }) {
  const w = new BrowserWindow({
    width,
    height,
    title: title || APP_NAME,
    icon: ICON,
    autoHideMenuBar: true,
    parent: win || undefined,
    webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true },
  });
  allowPopups(w.webContents);
  useGoogleUa(w.webContents);
  w.loadURL(url);
  return w;
}

function openLogin() {
  if (loginWin && !loginWin.isDestroyed()) {
    loginWin.focus();
    return;
  }
  loginWin = webWindow({ url: `${ORIGIN}/donator/login?callback=/donator`, width: 520, height: 820, title: '투네이션 도네이터 로그인' });
  let checking = false;
  const check = async () => {
    if (checking || !loginWin || loginWin.isDestroyed()) return;
    checking = true;
    try {
      if (await client.getAccount()) loginWin.close(); // 웹은 상태 확인으로 로그인을 감지해 목록을 불러온다
    } catch {
      /* 아직 로그인 전 */
    } finally {
      checking = false;
    }
  };
  loginWin.webContents.on('did-navigate', check);
  loginWin.webContents.on('did-navigate-in-page', check);
  const poll = setInterval(check, 2500);
  loginWin.on('closed', () => {
    clearInterval(poll);
    loginWin = null;
  });
}

// ---------------------------------------------------------------- 후원 패널

// toon.at/donate/{tag}에서 후원 영역만 남긴다 (toon-widget의 DONATE_ONLY_CSS)
const DONATE_ONLY_CSS = `
  [class*="_PreviewGuide_"],
  .ScreenTitle:has(+ .ScreenContent #baselayout),
  [class*="_StreamerTopBanner"],
  #baselayout [class*="_content_"] > footer,
  [class*="_FloatingMenu_"],
  [class*="_DonatorNoticePopup_"] { display: none !important; }
  .ScreenContent:has(#baselayout) { margin-top: 0 !important; }
`;

function openDonate(tag) {
  if (!win || !DONATE_TAG_RE.test(tag)) return;
  if (!donate) {
    const view = new WebContentsView({ webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true } });
    view.setBackgroundColor('#ffffff');
    if (typeof view.setBorderRadius === 'function') view.setBorderRadius(6);
    allowPopups(view.webContents);
    useGoogleUa(view.webContents);
    view.webContents.on('dom-ready', () => {
      if (/^https:\/\/toon\.at\/donate\//.test(view.webContents.getURL())) view.webContents.insertCSS(DONATE_ONLY_CSS).catch(() => {});
    });
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 }); // 웹이 패널 자리를 알려주면 놓는다
    win.contentView.addChildView(view);
    let shift = { x: 0, width: 0 };
    if (!win.isMaximized() && !win.isFullScreen()) {
      const b = win.getBounds();
      const next = widenForPanel(b, screen.getDisplayMatching(b).workArea, PANEL_W);
      shift = next.shift;
      win.setBounds(next.bounds);
    }
    donate = { view, shift };
  }
  donate.tag = tag;
  donate.view.webContents.loadURL(client.donateUrl(tag));
}

function setDonateBounds(r) {
  if (!donate || !r) return;
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  donate.view.setBounds({ x: n(r.x), y: n(r.y), width: n(r.width), height: n(r.height) });
}

function closeDonate({ notify = true } = {}) {
  if (!donate) return;
  const d = donate;
  donate = null;
  win.contentView.removeChildView(d.view);
  if (typeof d.view.webContents.close === 'function') d.view.webContents.close();
  if (d.shift.width && !win.isMaximized() && !win.isFullScreen()) win.setBounds(restoreFromPanel(win.getBounds(), d.shift));
  if (notify) send('mv:donate:closed');
}

// ---------------------------------------------------------------- 메인 창

function createWindow(url) {
  win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    title: APP_NAME,
    icon: ICON,
    backgroundColor: '#121318',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  // 멀티뷰 화면 밖으로 나가는 링크·새 창은 기본 브라우저로
  const appOrigin = new URL(url).origin;
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:/.test(u)) shell.openExternal(u);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, u) => {
    if (new URL(u).origin !== appOrigin) {
      e.preventDefault();
      if (/^https?:/.test(u)) shell.openExternal(u);
    }
  });
  win.webContents.on('did-start-navigation', (_e, _u, inPage, isMain) => {
    if (isMain && !inPage) closeDonate({ notify: false }); // 화면을 새로 읽으면 패널 상태도 처음부터
  });
  win.on('closed', () => {
    win = null;
    donate = null;
  });
  win.loadURL(url);
  if (process.env.MV_SMOKE_OUT) runSmoke(process.env.MV_SMOKE_OUT);
}

// 웹(preload의 window.multiviewDesktop)에서 오는 요청은 메인 창에서 온 것만 받는다
function wireIpc() {
  const handlers = createHandlers({
    client,
    openLogin,
    resolveYouTube: (key) => youtubeChannelId(key).then((r) => r.channelId || ''),
  });
  const fromWin = (e) => win && e.sender === win.webContents;
  for (const name of ['status', 'login', 'favorites']) {
    ipcMain.handle(`mv:${name}`, (e) => (fromWin(e) ? handlers[name]() : { ok: false, error: 'FORBIDDEN' }));
  }
  ipcMain.on('mv:donate:open', (e, t) => fromWin(e) && t && openDonate(String(t.tag)));
  ipcMain.on('mv:donate:close', (e) => fromWin(e) && closeDonate({ notify: false }));
  ipcMain.on('mv:donate:bounds', (e, r) => fromWin(e) && setDonateBounds(r));
}

// MV_SMOKE_OUT=<폴더>: 화면이 뜬 뒤 상태와 스크린샷을 남기고 종료 (자동 점검용)
// MV_SMOKE_SCRIPT=<js 파일>: 스크린샷 전에 페이지에서 실행할 시나리오 (MV_SMOKE_WAIT ms 기다림)
function runSmoke(outDir) {
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      if (process.env.MV_SMOKE_SCRIPT) {
        await win.webContents.executeJavaScript(fs.readFileSync(process.env.MV_SMOKE_SCRIPT, 'utf8')).catch((e) => console.error('[smoke]', e));
        await new Promise((r) => setTimeout(r, Number(process.env.MV_SMOKE_WAIT) || 8000));
      }
      const result = await win.webContents
        .executeJavaScript(
          `(async () => ({ desktop: typeof window.multiviewDesktop, api: Object.keys(window.multiviewDesktop || {}).sort(),
              title: document.title, tiles: document.querySelectorAll('.tile').length, href: location.href,
              status: await window.multiviewDesktop.status() }))()`,
        )
        .catch((e) => ({ error: String(e) }));
      const img = await win.webContents.capturePage();
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'smoke.png'), img.toPNG());
      if (donate) {
        result.donate = { url: donate.view.webContents.getURL(), bounds: donate.view.getBounds(), window: win.getBounds() };
        fs.writeFileSync(path.join(outDir, 'donate.png'), (await donate.view.webContents.capturePage()).toPNG());
      }
      fs.writeFileSync(path.join(outDir, 'smoke.json'), JSON.stringify(result, null, 2));
      app.quit();
    }, 2500);
  });
}

app.whenReady().then(async () => {
  ses = session.fromPartition(PARTITION);
  // toon-widget과 같은 정직한 Electron UA (Cloudflare Turnstile이 UA와 client hints를 비교한다).
  const ua = `${WEBKIT_UA} MultiviewDonate/${app.getVersion()} Chrome/${process.versions.chrome} Electron/${process.versions.electron} Safari/537.36`;
  app.userAgentFallback = ua;
  ses.setUserAgent(ua);
  client = new ToonationClient(ses);
  wireIpc();

  let url = DEV_URL;
  if (!DEV) {
    server = await startStaticServer(path.join(__dirname, 'web'));
    url = `http://localhost:${server.port}/`;
  }
  createWindow(url);
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => server && server.close());
