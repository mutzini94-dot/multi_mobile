'use strict';
// 앱 이름과 Windows 식별값.
const path = require('path');

const APP_NAME = '투네이션 후원 브라우저';
const APP_USER_MODEL_ID = 'at.toon.donator.multiview';
// 이름을 바꾸기 전(멀티뷰 후원)의 설정·로그인 폴더를 계속 쓴다 (Electron은 기본으로 앱 이름 폴더를 쓴다)
const USER_DATA_FOLDER = '멀티뷰 후원';

/**
 * 작업 표시줄은 같은 앱 ID를 가진 바로가기의 아이콘을 쓴다. 개발 실행(electron.exe)이 알림을 띄우며 만든
 * 바로가기가 설치된 앱과 같은 ID면 설치된 앱에 Electron 아이콘이 뜨므로, 개발 실행은 ID를 따로 쓴다
 */
function appUserModelId(packaged) {
  return packaged ? APP_USER_MODEL_ID : `${APP_USER_MODEL_ID}.dev`;
}

function userDataDir(appDataDir) {
  return path.join(appDataDir, USER_DATA_FOLDER);
}

module.exports = { APP_NAME, appUserModelId, userDataDir };
