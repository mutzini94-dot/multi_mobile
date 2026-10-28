'use strict';
// 칸 안의 <webview>(후원 페이지·웹페이지 칸) 검사. 앱 화면(main.js의 will-attach-webview)에서 붙기 전에 확인한다.
// 웹 화면이 어떤 값을 보내든 http(s) 주소와 정해진 세션만, preload·node 없이 격리해서 띄운다.

const DONATE_PARTITION = 'persist:toonation'; // 투네이션 로그인 세션 (후원 페이지 칸만)
const WEB_PARTITION = 'persist:mvweb'; // 그 밖의 웹페이지 칸

const isWebUrl = (u) => /^https?:\/\//i.test(String(u || ''));
const isDonateUrl = (u) => /^https:\/\/toon\.at\/donate\//.test(String(u || ''));

function allowWebview(params) {
  if (!params || !isWebUrl(params.src)) return false;
  if (params.partition === WEB_PARTITION) return true;
  return params.partition === DONATE_PARTITION && isDonateUrl(params.src);
}

function hardenWebPreferences(prefs) {
  delete prefs.preload;
  delete prefs.preloadURL;
  prefs.nodeIntegration = false;
  prefs.nodeIntegrationInSubFrames = false;
  prefs.contextIsolation = true;
  prefs.sandbox = true;
  prefs.webSecurity = true;
  return prefs;
}

module.exports = { allowWebview, hardenWebPreferences, isWebUrl, isDonateUrl, DONATE_PARTITION, WEB_PARTITION };
