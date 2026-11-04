'use strict';
// 투네이션 후원 브라우저(멀티뷰) — 설치형(Electron). toon-widget(투네이션 후원 위젯)과 같은 방식:
//   - 전용 세션(persist:toonation)에서 공식 로그인 창을 띄우고, 같은 세션으로 계정·즐겨찾기를 가져온다
//     (비밀번호는 다루지 않는다)
//   - 후원창(WebContentsView, 같은 로그인 세션)은 메인 창 가운데 모달 또는 항상 위 PIP 창으로 띄운다
//   - 멀티뷰 화면은 웹 빌드(desktop/web)를 http://localhost:<port>로 띄운다 (트위치 임베드의 parent 제약)
// 개발: `npm run dev` 는 vite 개발 서버(http://localhost:5230)를 띄운 상태에서 실행한다.
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, WebContentsView, ipcMain, screen, session, shell, Tray, Menu, nativeImage, Notification } = require('electron');
const { ToonationClient, ORIGIN } = require('./lib/toonation');
const { youtubeChannelId, checkLive } = require('./lib/platforms');
const { startStaticServer } = require('./lib/staticServer');
const { createWebStore } = require('./lib/webStore');
const { createDonateController } = require('./lib/donateController');
const { createPrefs } = require('./lib/prefs');
const { restoreBounds } = require('./lib/windowBounds');
const { createAppOptions, APP_OPTION_DEFAULTS } = require('./lib/appOptions');
const { Updater } = require('./lib/updater');
const { allowWebview, hardenWebPreferences, isWebUrl, isDonateUrl, WEB_PARTITION } = require('./lib/webviewPolicy');
const { fillAmountScript, fillMessageScript, selectSignature } = require('./lib/donateFill');
const { useMobileDonatePage } = require('./lib/mobileDonate');
const { createHandlers } = require('./lib/handlers');
const { APP_NAME, appUserModelId, userDataDir } = require('./lib/appIdentity');

const PARTITION = 'persist:toonation';
const DEV = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5230/';
const ICON = path.join(__dirname, 'assets', 'icon.ico'); // 창·작업 표시줄 아이콘 (build/는 설치 파일에 들어가지 않는다)
const LOGO_ICON = path.join(__dirname, 'assets', 'logo-square.png'); // 알림 아이콘 (build/는 설치 파일에 들어가지 않는다)
const TRAY_ICON = path.join(__dirname, 'assets', 'tray.png'); // 로고 (+OO), tray@2x.png는 고해상도 화면에서 자동으로 쓴다
const DONATE_TAG_RE = /^[A-Za-z0-9_-]{1,64}$/;

app.setPath('userData', userDataDir(app.getPath('appData')));
// 별도 프로필(설정·로그인)로 설치된 앱 옆에서 한 벌 더 실행: `--profile=<폴더>` (toon-widget과 같음)
const profileArg = process.argv.find((a) => a.startsWith('--profile='));
if (profileArg) app.setPath('userData', path.resolve(profileArg.slice('--profile='.length)));

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.setAppUserModelId(appUserModelId(app.isPackaged));
// 방송은 사용자가 고르는 즉시 재생된다
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;
let ses = null;
let client = null;
let loginWin = null;
let server = null;
let prefs = null; // 설치형 전용 설정 (lib/prefs.js)
let donate = null; // 후원창 컨트롤러 (lib/donateController.js)
let appOrigin = null; // 멀티뷰 화면 주소의 origin (분리 창은 이 주소만 연다)
let appOptions = null; // Windows 시작 시 실행 · 닫으면 트레이로 · 자동 업데이트 (lib/appOptions.js)
let updater = null; // 자동 업데이트 (lib/updater.js)
let tray = null;
let miniBefore = null; // 미니 모드 전 창 상태 (미니 모드 동안은 창 위치·크기를 기억하지 않는다)
let quitting = false; // 트레이 '종료'·업데이트 설치 등 진짜 종료 (창 닫기는 트레이로 숨김)
const START_HIDDEN = process.argv.includes('--hidden'); // Windows 시작 시 실행: 트레이로만 시작
const soloWins = new Map(); // 분리 창 id → BrowserWindow

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

// 칸 안의 webview: 후원 페이지 칸은 투네이션 창과 같이(결제·로그인 팝업 허용, 후원 부분만 보이게),
// 웹페이지 칸은 새 창 요청을 그 칸에서 연다.
function setupTileWebview(wc) {
  const donateTile = wc.session === ses;
  if (donateTile) {
    allowPopups(wc);
    useGoogleUa(wc);
    useMobileDonatePage(wc, process.versions.chrome); // 후원 페이지는 모바일판
    wc.on('dom-ready', () => {
      if (isDonateUrl(wc.getURL())) wc.insertCSS(DONATE_ONLY_CSS).catch(() => {});
    });
  } else {
    wc.setWindowOpenHandler(({ url }) => {
      if (isWebUrl(url)) wc.loadURL(url);
      return { action: 'deny' };
    });
  }
  // http(s) 밖(파일·앱 실행 링크 등)으로는 이동하지 않는다
  wc.on('will-navigate', (e, url) => {
    if (!isWebUrl(url)) e.preventDefault();
  });
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

function createDonateView() {
  const view = new WebContentsView({ webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true } });
  view.setBackgroundColor('#ffffff');
  if (typeof view.setBorderRadius === 'function') view.setBorderRadius(8);
  allowPopups(view.webContents);
  useGoogleUa(view.webContents);
  useMobileDonatePage(view.webContents, process.versions.chrome); // 후원 페이지는 모바일판
  view.webContents.on('dom-ready', () => {
    if (/^https:\/\/toon\.at\/donate\//.test(view.webContents.getURL())) view.webContents.insertCSS(DONATE_ONLY_CSS).catch(() => {});
  });
  return view;
}

// PIP: 테두리 없는 작은 창, 항상 위. 얇은 머리줄(pip.html: 끌어서 옮기기 · 모달로 · 닫기) 아래에 후원 페이지를 붙인다.
let pipWin = null;
let quickAmounts = []; // 빠른 후원 금액 (웹의 설정 → PIP 머리줄)
let quickMessages = []; // 자주 쓰는 후원 메시지 (웹의 설정 → PIP 머리줄)
function createPipWindow({ title, onClosed, onResize }) {
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  const width = 420;
  const height = Math.min(760, area.height - 48);
  // 지난번 PIP 위치·크기 (지금 연결된 화면 안일 때만)
  const b = restoreBounds(
    prefs.get('pipBounds'),
    screen.getAllDisplays().map((d) => d.workArea),
    { x: area.x + area.width - width - 24, y: area.y + area.height - height - 24, width, height },
    { width: 340, height: 420 },
  );
  const w = new BrowserWindow({
    ...b,
    minWidth: 340,
    minHeight: 420,
    frame: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    title,
    icon: ICON,
    backgroundColor: '#ffffff',
    webPreferences: { preload: path.join(__dirname, 'pip-preload.js'), contextIsolation: true, sandbox: true },
  });
  w.setAlwaysOnTop(true, 'floating');
  w.loadFile(path.join(__dirname, 'pip.html'), { query: { title, amounts: quickAmounts.join(','), messages: JSON.stringify(quickMessages) } });
  w.on('resize', onResize);
  const remember = () => !w.isDestroyed() && prefs.set('pipBounds', w.getBounds());
  w.on('moved', remember);
  w.on('resized', remember);
  w.on('closed', () => {
    if (pipWin === w) pipWin = null;
    onClosed();
  });
  const setTitle = w.setTitle.bind(w);
  w.setTitle = (t) => {
    setTitle(t);
    if (!w.isDestroyed()) w.webContents.send('mv:pip:title', t);
  };
  pipWin = w;
  return w;
}

// ---------------------------------------------------------------- 메인 창

// 멀티뷰 화면(메인 창·분리 창) 공통: 칸 webview 검사, 화면 밖 링크·새 창은 기본 브라우저로, 다른 주소로 이동 금지
function guardAppContents(wc) {
  wc.on('will-attach-webview', (e, webPreferences, params) => {
    hardenWebPreferences(webPreferences);
    if (!allowWebview(params)) e.preventDefault();
  });
  wc.on('did-attach-webview', (_e, child) => setupTileWebview(child));
  wc.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:/.test(u)) shell.openExternal(u);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, u) => {
    if (new URL(u).origin !== appOrigin) {
      e.preventDefault();
      if (/^https?:/.test(u)) shell.openExternal(u);
    }
  });
}

// ---------------------------------------------------------------- 칸 분리 창

const SOLO_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** 칸 하나를 새 창으로 (웹의 #solo= 화면). 지난번 분리 창 크기·위치를 쓰고, 여러 개면 조금씩 비켜 놓는다 */
function createSoloWindow({ id, url, title }) {
  if (!SOLO_ID_RE.test(id) || soloWins.has(id)) return;
  let u;
  try {
    u = new URL(url);
  } catch {
    return;
  }
  if (u.origin !== appOrigin || !u.hash.startsWith('#solo=')) return;
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  const fallback = { width: 720, height: 444, x: area.x + area.width - 720 - 40, y: area.y + 60 };
  const b = restoreBounds(prefs.get('soloBounds'), screen.getAllDisplays().map((d) => d.workArea), fallback, { width: 360, height: 240 });
  const shift = 28 * soloWins.size;
  const w = new BrowserWindow({
    ...b,
    x: b.x + shift,
    y: b.y + shift,
    minWidth: 360,
    minHeight: 240,
    title: `${String(title || '').slice(0, 40)} · ${APP_NAME}`,
    icon: ICON,
    backgroundColor: '#121318',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, webviewTag: true },
  });
  guardAppContents(w.webContents);
  const remember = () => !w.isDestroyed() && !w.isMaximized() && !w.isFullScreen() && prefs.set('soloBounds', w.getBounds());
  w.on('moved', remember);
  w.on('resized', remember);
  w.on('closed', () => {
    soloWins.delete(id);
    send('mv:detach:closed', id); // 메인 화면이 칸으로 되돌린다 (이미 되돌렸으면 무시)
  });
  soloWins.set(id, w);
  w.loadURL(u.href);
}

function closeAllSolos() {
  for (const w of [...soloWins.values()]) if (!w.isDestroyed()) w.close();
}

// 분리 창 ↔ 메인 화면 메시지: 직렬화할 수 있는 작은 값만 넘긴다
function plainMessage(msg) {
  try {
    const text = JSON.stringify(msg);
    return text && text.length < 4000 ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- 트레이 · 앱 옵션 · 업데이트

function showMain() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function quitApp() {
  quitting = true;
  app.quit();
}

function buildTrayMenu() {
  const o = appOptions.all();
  const u = updater ? updater.state : { status: 'disabled' };
  return Menu.buildFromTemplate([
    { label: '열기', click: showMain },
    { type: 'separator' },
    { label: 'Windows 시작 시 실행', type: 'checkbox', checked: o.autoLaunch, click: (i) => setAppOption('autoLaunch', i.checked) },
    { label: '창을 닫으면 트레이로', type: 'checkbox', checked: o.closeToTray, click: (i) => setAppOption('closeToTray', i.checked) },
    u.status === 'downloaded'
      ? { label: `업데이트 설치 (v${u.version}) 후 다시 시작`, click: () => updater.installNow() }
      : { label: '업데이트 확인', enabled: !!(updater && updater.au), click: () => updater.check(true) },
    { type: 'separator' },
    { label: '종료', click: quitApp },
  ]);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  tray.setToolTip(APP_NAME);
  tray.on('click', showMain);
  tray.on('right-click', () => tray.popUpContextMenu(buildTrayMenu()));
}

function appInfo() {
  return { version: app.getVersion(), options: appOptions.all(), update: updater ? updater.state : { status: 'disabled' } };
}

function setAppOption(key, value) {
  if (!appOptions.set(key, value)) return false;
  if (key === 'autoUpdate' && value) updater && updater.check();
  send('mv:app:info', appInfo());
  return true;
}

function createWindow(url) {
  const primary = screen.getPrimaryDisplay().workArea;
  const fallback = {
    width: Math.min(1400, primary.width),
    height: Math.min(860, primary.height),
    x: primary.x + Math.max(0, Math.round((primary.width - 1400) / 2)),
    y: primary.y + Math.max(0, Math.round((primary.height - 860) / 2)),
  };
  const bounds = restoreBounds(prefs.get('windowBounds'), screen.getAllDisplays().map((d) => d.workArea), fallback, { width: 720, height: 480 });
  win = new BrowserWindow({
    ...bounds,
    show: !START_HIDDEN || !!process.env.MV_SMOKE_OUT,
    minWidth: 720,
    minHeight: 480,
    title: APP_NAME,
    icon: ICON,
    backgroundColor: '#121318',
    autoHideMenuBar: true,
    // webviewTag: 후원 페이지·웹페이지 칸 (붙기 전에 lib/webviewPolicy.js로 검사)
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, webviewTag: true },
  });
  appOrigin = new URL(url).origin;
  guardAppContents(win.webContents);
  win.webContents.on('did-start-navigation', (_e, _u, inPage, isMain) => {
    if (!isMain || inPage) return;
    // 화면을 새로 읽으면 후원창·분리 창도 처음부터 (메인 화면이 분리 상태를 잊는다)
    if (donate) donate.close({ notify: false });
    closeAllSolos();
  });
  if (prefs.get('windowMaximized')) win.maximize();
  if (prefs.get('alwaysOnTop')) win.setAlwaysOnTop(true); // 웹의 설정이 읽히기 전에도 지난 상태로
  // 창 위치·크기 기억 (최대화·전체 화면일 때는 그 전 크기를 남긴다)
  const remember = () => {
    if (!win || win.isDestroyed() || miniBefore) return;
    prefs.set('windowMaximized', win.isMaximized());
    if (!win.isMaximized() && !win.isFullScreen() && !win.isMinimized()) prefs.set('windowBounds', win.getBounds());
  };
  for (const ev of ['moved', 'resized', 'maximize', 'unmaximize']) win.on(ev, remember);
  // 창을 닫으면 트레이로 숨긴다 (설정). 처음 한 번은 트레이에 있다고 알려 준다
  win.on('close', (e) => {
    if (quitting || !appOptions.get('closeToTray') || !tray) return;
    e.preventDefault();
    win.hide();
    if (!prefs.get('trayNoticeShown') && Notification.isSupported()) {
      prefs.set('trayNoticeShown', true);
      const n = new Notification({ title: APP_NAME, body: '트레이에서 계속 실행 중입니다. 완전히 끄려면 트레이 아이콘 메뉴에서 종료를 누르세요.', icon: LOGO_ICON });
      n.on('click', showMain);
      n.show();
    }
  });
  win.on('closed', () => {
    if (donate) donate.dispose(); // PIP 창도 함께 닫는다
    closeAllSolos();
    win = null;
  });
  donate = createDonateController({
    main: win,
    createView: createDonateView,
    createPipWindow,
    donateUrl: (tag) => client.donateUrl(tag),
    send,
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
    checkLive,
    // 투네이션 로그아웃: toon-widget과 같이 로그아웃 요청 후 이 세션의 저장값(쿠키 등)을 지운다
    logout: async () => {
      await ses.fetch(`${ORIGIN}/dapi/logout/1`, { credentials: 'include' }).catch(() => {});
      await ses.clearStorageData();
    },
  });
  const fromWin = (e) => win && e.sender === win.webContents;
  for (const name of ['status', 'login', 'logout', 'favorites', 'history']) {
    ipcMain.handle(`mv:${name}`, (e) => (fromWin(e) ? handlers[name]() : { ok: false, error: 'FORBIDDEN' }));
  }
  // 웹 화면 저장값 사본 (lib/webStore.js): 메인 창만
  const webStore = createWebStore(path.join(app.getPath('userData'), 'webstore.json'));
  ipcMain.handle('mv:webstore:load', (e) => (fromWin(e) ? webStore.load() : null));
  ipcMain.on('mv:webstore:save', (e, snap) => fromWin(e) && webStore.save(snap));
  // 검색어·즐겨찾기 값을 받는 요청 (값 확인은 handlers)
  ipcMain.handle('mv:search', (e, q) => (fromWin(e) ? handlers.search(q) : { ok: false, error: 'FORBIDDEN' }));
  ipcMain.handle('mv:bookmark', (e, p) => (fromWin(e) ? handlers.bookmark(p) : { ok: false, error: 'FORBIDDEN' }));
  ipcMain.handle('mv:signatures', (e, tag) => (fromWin(e) ? handlers.signatures(tag) : { ok: false, error: 'FORBIDDEN' }));
  const fromPip = (e) => pipWin && !pipWin.isDestroyed() && e.sender === pipWin.webContents;
  ipcMain.on('mv:donate:open', (e, t) => {
    if (!fromWin(e) || !t || !DONATE_TAG_RE.test(String(t.tag))) return;
    if (Array.isArray(t.amounts)) {
      quickAmounts = t.amounts.filter((n) => Number.isInteger(n) && n >= 1 && n <= 10_000_000).slice(0, 6);
      if (pipWin && !pipWin.isDestroyed()) pipWin.webContents.send('mv:pip:amounts', quickAmounts);
    }
    if (Array.isArray(t.messages)) {
      quickMessages = t.messages.filter((m) => typeof m === 'string' && m.trim() && m.length <= 300).slice(0, 5);
      if (pipWin && !pipWin.isDestroyed()) pipWin.webContents.send('mv:pip:messages', quickMessages);
    }
    // 설정의 후원창 기본 모드 ('modal' | 'pip'), 없으면 마지막 모드
    donate.open(String(t.tag), String(t.name || '').slice(0, 30), t.mode === 'modal' || t.mode === 'pip' ? t.mode : undefined);
  });
  // 빠른 후원: 후원 페이지의 금액 칸만 채운다 (메인 창의 모달 머리줄 또는 PIP 머리줄에서)
  // 자주 쓰는 후원 메시지: 후원 페이지의 메시지 칸만 채운다
  ipcMain.on('mv:donate:fillMessage', (e, message) => {
    if (!(fromWin(e) || fromPip(e))) return;
    const v = donate.view();
    if (!v) return;
    let code;
    try {
      code = fillMessageScript(String(message));
    } catch {
      return;
    }
    v.webContents.executeJavaScript(code).catch(() => {});
  });
  // 시그니처로 후원: 막 연 후원창의 시그니처 탭에서 그 시그니처를 고른다 (페이지가 그려질 때까지 되풀이, 후원 버튼은 사용자가)
  ipcMain.handle('mv:donate:signature', (e, p) => {
    if (!fromWin(e) || !p) return 'forbidden';
    return selectSignature(() => donate.view(), String(p.name), String(p.tag), Number(p.cash)).catch(() => 'error');
  });
  ipcMain.on('mv:donate:fill', (e, amount) => {
    if (!(fromWin(e) || fromPip(e))) return;
    const v = donate.view();
    if (!v) return;
    let code;
    try {
      code = fillAmountScript(Number(amount));
    } catch {
      return;
    }
    v.webContents.executeJavaScript(code).catch(() => {});
  });
  // 칸 분리 창: 여닫기·메시지는 메인 창에서, 분리 창의 메시지·항상 위는 그 분리 창에서 온 것만
  const soloIdOf = (e) => [...soloWins].find(([, w]) => !w.isDestroyed() && w.webContents === e.sender)?.[0];
  ipcMain.on('mv:detach:open', (e, p) => fromWin(e) && p && createSoloWindow({ id: String(p.id), url: String(p.url), title: String(p.title || '') }));
  ipcMain.on('mv:detach:close', (e, id) => {
    const w = fromWin(e) && soloWins.get(String(id));
    if (w && !w.isDestroyed()) w.close();
  });
  ipcMain.on('mv:detach:post', (e, id, msg) => {
    const w = fromWin(e) && soloWins.get(String(id));
    const m = plainMessage(msg);
    if (w && !w.isDestroyed() && m) w.webContents.send('mv:solo:message', m);
  });
  ipcMain.on('mv:solo:post', (e, msg) => {
    const id = soloIdOf(e);
    const m = plainMessage(msg);
    if (id && m) send('mv:detach:message', { id, msg: m });
  });
  ipcMain.on('mv:solo:alwaysOnTop', (e, on) => {
    const id = soloIdOf(e);
    if (id) soloWins.get(id).setAlwaysOnTop(!!on, 'floating');
  });
  // 앱 옵션 · 업데이트 (메인 창의 설정 화면에서)
  ipcMain.handle('mv:app:info', (e) => (fromWin(e) ? appInfo() : null));
  ipcMain.handle('mv:app:set', (e, key, value) => fromWin(e) && setAppOption(String(key), value));
  ipcMain.on('mv:app:checkUpdate', (e) => fromWin(e) && updater && updater.check(true));
  ipcMain.on('mv:app:installUpdate', (e) => fromWin(e) && updater && updater.installNow());
  // 미니 모드: 창을 작게(지금 화면 오른쪽 아래)·항상 위로, 끄면 원래 크기·위치·항상 위로 되돌린다
  ipcMain.on('mv:window:mini', (e, on) => {
    if (!fromWin(e)) return;
    if (on && !miniBefore) {
      if (win.isFullScreen()) win.setFullScreen(false);
      miniBefore = { bounds: win.getBounds(), maximized: win.isMaximized(), onTop: win.isAlwaysOnTop() };
      if (miniBefore.maximized) win.unmaximize();
      const area = screen.getDisplayMatching(win.getBounds()).workArea;
      win.setMinimumSize(320, 180);
      win.setBounds({ width: 480, height: 270, x: area.x + area.width - 480 - 24, y: area.y + area.height - 270 - 24 });
      win.setAlwaysOnTop(true, 'floating');
    } else if (!on && miniBefore) {
      const b = miniBefore;
      miniBefore = null;
      win.setMinimumSize(720, 480);
      win.setBounds(b.bounds);
      if (b.maximized) win.maximize();
      win.setAlwaysOnTop(b.onTop);
    }
  });
  ipcMain.on('mv:window:alwaysOnTop', (e, on) => {
    if (!fromWin(e)) return;
    win.setAlwaysOnTop(!!on);
    prefs.set('alwaysOnTop', !!on);
  });
  ipcMain.on('mv:donate:close', (e) => fromWin(e) && donate.close({ notify: false }));
  ipcMain.on('mv:donate:bounds', (e, r) => fromWin(e) && donate.setModalBounds(r));
  ipcMain.on('mv:donate:mode', (e, m) => (fromWin(e) || fromPip(e)) && donate.setMode(m));
  ipcMain.on('mv:pip:close', (e) => fromPip(e) && donate.close());
}

// MV_SMOKE_OUT=<폴더>: 화면이 뜬 뒤 상태와 스크린샷을 남기고 종료 (자동 점검용)
// MV_SMOKE_SCRIPT=<js 파일>: 스크린샷 전에 페이지에서 실행할 시나리오 (MV_SMOKE_WAIT ms 기다림)
function runSmoke(outDir) {
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      if (process.env.MV_SMOKE_SCRIPT) {
        await win.webContents.executeJavaScript(fs.readFileSync(process.env.MV_SMOKE_SCRIPT, 'utf8'), true).catch((e) => console.error('[smoke]', e));
        await new Promise((r) => setTimeout(r, Number(process.env.MV_SMOKE_WAIT) || 8000));
        // 시나리오가 window.__mvInput에 남긴 실제 입력(마우스)을 보낸다: [{ type, x, y }, ...]
        const input = await win.webContents.executeJavaScript('window.__mvInput || []').catch(() => []);
        // MV_SMOKE_CDP_INPUT=1: 브라우저 입력 경로(CDP Input)로 보낸다 — 칸 webview 안까지 닿는다 (sendInputEvent는 앱 화면에만)
        const cdp = !!process.env.MV_SMOKE_CDP_INPUT && input.length > 0;
        if (cdp) win.webContents.debugger.attach('1.3');
        for (const ev of input) {
          if (cdp) await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: ev.type === 'mouseDown' ? 'mousePressed' : ev.type === 'mouseUp' ? 'mouseReleased' : 'mouseMoved', x: ev.x, y: ev.y, button: 'left', clickCount: 1 });
          else win.webContents.sendInputEvent({ button: 'left', clickCount: 1, ...ev });
          await new Promise((r) => setTimeout(r, 40));
        }
        if (input.length) await new Promise((r) => setTimeout(r, 1000));
        // MV_SMOKE_SOLO_CLICK=<버튼 이름>: 첫 분리 창에서 그 버튼을 누른다 (분리 창 → 메인 화면 메시지 확인)
        const soloClick = process.env.MV_SMOKE_SOLO_CLICK;
        const firstSolo = [...soloWins.values()][0];
        if (soloClick && firstSolo) {
          const sel = JSON.stringify(`[aria-label="${soloClick}"], button`);
          await firstSolo.webContents
            .executeJavaScript(`[...document.querySelectorAll(${sel})].find((b) => b.getAttribute('aria-label') === ${JSON.stringify(soloClick)} || b.textContent.trim() === ${JSON.stringify(soloClick)})?.click()`)
            .catch((e) => console.error('[smoke]', e));
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      const result = await win.webContents
        .executeJavaScript(
          `(async () => ({ desktop: typeof window.multiviewDesktop, api: Object.keys(window.multiviewDesktop || {}).sort(),
              title: document.title, tiles: document.querySelectorAll('.tile').length, href: location.href,
              names: [...document.querySelectorAll('.tile')].map((t) => t.querySelector('.tile__name')?.textContent || '-'),
              events: (window.__ev || []).slice(0, 40), plan: window.__plan || null,
              jitter: (window.__jitter || []).slice(-60), jitterCount: (window.__jitter || []).length, sizes: window.__sizes || [], snap: window.__snap || [], over: window.__over || [], marks: [...document.querySelectorAll('.player-layer iframe')].map((f) => f.__mark || 'NEW'), floating: (() => { const el = document.querySelector('.player-layer__item--floating'); return el ? [el.style.left, el.style.top, el.style.width, el.style.height] : null; })(),
              selected: [...document.querySelectorAll('.tile')].findIndex((x) => x.classList.contains('tile--selected')),
              status: await window.multiviewDesktop.status() }))()`,
        )
        .catch((e) => ({ error: String(e) }));
      // 캡처 실패(UnknownVizError 등)로 점검 결과까지 잃지 않도록
      const shot = async (wc, file) => {
        try {
          fs.writeFileSync(path.join(outDir, file), (await wc.capturePage()).toPNG());
        } catch (e) {
          result[`${file}Error`] = String(e);
        }
      };
      fs.mkdirSync(outDir, { recursive: true });
      result.windowFullScreen = win.isFullScreen();
      result.windowAlwaysOnTop = win.isAlwaysOnTop();
      result.windowBounds = win.getBounds();
      result.pageInfo = await win.webContents
        .executeJavaScript(`({ webviews: [...document.querySelectorAll('webview')].map((w) => [w.getAttribute('partition'), w.getAttribute('src')]), notices: [...document.querySelectorAll('.ended-notice')].map((n) => n.textContent), tileLabels: [...document.querySelectorAll('.tile .tile__name')].map((n) => n.textContent) })`)
        .catch(() => null);
      result.solos = [...soloWins].map(([id, w]) => ({ id, title: w.getTitle(), url: w.webContents.getURL().slice(0, 60), bounds: w.getBounds(), alwaysOnTop: w.isAlwaysOnTop() }));
      for (const [id, w] of soloWins) await shot(w.webContents, `solo-${id}.png`);
      result.theme = await win.webContents.executeJavaScript('document.documentElement.dataset.theme || null').catch(() => null);
      await shot(win.webContents, 'smoke.png');
      result.donate = donate.state();
      const dv = donate.view();
      if (dv) {
        result.donate.bounds = dv.getBounds();
        result.donate.url = dv.webContents.getURL();
        result.donate.inputs = await dv.webContents.executeJavaScript("[...document.querySelectorAll('input[type=text]')].map((i) => i.value)").catch(() => null);
        result.donate.textareas = await dv.webContents.executeJavaScript("[...document.querySelectorAll('textarea')].map((i) => i.value)").catch(() => null);
        // MV_SMOKE_DONATE_SCRIPT=<js 파일>: 후원창 페이지에서 실행해 결과를 남긴다 (점검용)
        if (process.env.MV_SMOKE_DONATE_SCRIPT) result.donate.probe = await dv.webContents.executeJavaScript(fs.readFileSync(process.env.MV_SMOKE_DONATE_SCRIPT, 'utf8'), true).catch((e) => String(e));
        await shot(dv.webContents, 'donate.png');
      }
      if (pipWin && !pipWin.isDestroyed()) {
        result.pip = { bounds: pipWin.getBounds(), alwaysOnTop: pipWin.isAlwaysOnTop(), chips: await pipWin.webContents.executeJavaScript("[...document.querySelectorAll('#amounts button')].map((b) => b.textContent)").catch(() => null), messages: await pipWin.webContents.executeJavaScript("[...document.querySelectorAll('#messages option')].map((o) => o.textContent)").catch(() => null) };
        await shot(pipWin.webContents, 'pip.png');
      }
      // MV_SMOKE_TRAY=1: 창을 닫으면 트레이로 숨는지 (닫히지 않고 숨김)
      if (process.env.MV_SMOKE_TRAY && tray) {
        result.tray = { options: appOptions.all(), iconLoaded: !nativeImage.createFromPath(TRAY_ICON).isEmpty(), iconSize: nativeImage.createFromPath(TRAY_ICON).getSize() };
        win.close();
        await new Promise((r) => setTimeout(r, 500));
        result.tray.afterClose = { destroyed: win.isDestroyed(), visible: !win.isDestroyed() && win.isVisible() };
        showMain();
        result.tray.afterShow = { visible: win.isVisible() };
      }
      fs.writeFileSync(path.join(outDir, 'smoke.json'), JSON.stringify(result, null, 2));
      app.quit();
    }, 2500);
  });
}

app.whenReady().then(async () => {
  prefs = createPrefs(path.join(app.getPath('userData'), 'prefs.json'), {
    port: 47230,
    alwaysOnTop: false,
    windowBounds: null,
    pipBounds: null,
    windowMaximized: false,
    soloBounds: null,
    trayNoticeShown: false,
    ...APP_OPTION_DEFAULTS,
  });
  appOptions = createAppOptions({ prefs, setLoginItem: (s) => app.setLoginItemSettings(s), packaged: app.isPackaged });
  appOptions.applyLoginItem();
  ses = session.fromPartition(PARTITION);
  // toon-widget과 같은 정직한 Electron UA (Cloudflare Turnstile이 UA와 client hints를 비교한다).
  const ua = `${WEBKIT_UA} MultiviewDonate/${app.getVersion()} Chrome/${process.versions.chrome} Electron/${process.versions.electron} Safari/537.36`;
  app.userAgentFallback = ua;
  ses.setUserAgent(ua);
  client = new ToonationClient(ses);
  // 웹페이지 칸 세션: 카메라·마이크·위치·알림 등 권한은 주지 않는다 (전체 화면·클립보드 쓰기만)
  const webSes = session.fromPartition(WEB_PARTITION);
  webSes.setUserAgent(ua);
  webSes.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'fullscreen' || permission === 'clipboard-sanitized-write'));
  wireIpc();

  let url = DEV_URL;
  if (!DEV) {
    // 고정 포트: localStorage(즐겨찾기·내 방송 정보·설정)는 포트까지 포함한 주소별이라 실행마다 같은 포트여야 유지된다
    // 다른 프로그램이 포트를 쓰고 있으면 잠깐 다시 시도하고, 그래도 안 되면 이번 실행만 빈 포트로 연다.
    // 대체 포트는 저장하지 않는다 (저장하면 다음 실행부터 저장값이 계속 비어 보인다). 저장값은 webStore 사본으로 되살린다
    server = await startStaticServer(path.join(__dirname, 'web'), { port: prefs.get('port'), retries: 5, retryDelayMs: 400 });
    url = `http://localhost:${server.port}/`;
  }
  createWindow(url);
  if (!process.env.MV_SMOKE_OUT || process.env.MV_SMOKE_TRAY) createTray();
  updater = new Updater(prefs);
  updater.on('state', () => send('mv:app:info', appInfo()));
  updater.on('downloaded', (i) => {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: APP_NAME, body: `새 버전 ${i.version}을 받았습니다. 종료하면 설치되고, 설정에서 바로 설치할 수도 있습니다.`, icon: LOGO_ICON });
    n.on('click', showMain);
    n.show();
  });
  updater.start();
});

app.on('before-quit', () => {
  quitting = true; // 업데이트 설치·OS 종료 등: 트레이로 숨기지 않고 닫는다
});

app.on('second-instance', showMain);

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  if (prefs) prefs.flush();
  if (server) server.close();
});
