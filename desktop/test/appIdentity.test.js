'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { APP_NAME, appUserModelId, userDataDir } = require('../lib/appIdentity');

test('앱 이름은 투네이션 후원 브라우저', () => {
  assert.strictEqual(APP_NAME, '투네이션 후원 브라우저');
});

test('작업 표시줄 앱 ID: 설치된 앱만 정식 ID, 개발 실행(electron.exe)은 따로 (아이콘이 섞이지 않게)', () => {
  assert.strictEqual(appUserModelId(true), 'at.toon.donator.multiview');
  assert.strictEqual(appUserModelId(false), 'at.toon.donator.multiview.dev');
});

test('설정·로그인 폴더는 이름을 바꾸기 전 폴더 그대로', () => {
  assert.strictEqual(userDataDir('/appdata'), path.join('/appdata', '멀티뷰 후원'));
});
