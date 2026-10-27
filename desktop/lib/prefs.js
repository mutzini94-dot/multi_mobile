'use strict';
// 설치형 전용 설정 (userData/prefs.json): 화면 포트, 창 위치·크기, PIP 위치·크기, 항상 위 등.
// 웹 화면의 설정(src/settings)은 localStorage에 있고, 창처럼 메인 프로세스가 다루는 것만 여기에 둔다.
const fs = require('fs');

function createPrefs(file, defaults) {
  let data = { ...defaults };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) data = { ...defaults, ...raw };
  } catch {
    // 처음 실행이거나 깨진 파일: 기본값
  }
  let timer = null;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch {
      // 저장 실패는 다음 기회에
    }
  };
  return {
    get: (key) => data[key],
    all: () => ({ ...data }),
    set(key, value) {
      data[key] = value;
      clearTimeout(timer);
      timer = setTimeout(flush, 300); // 창 이동처럼 자주 바뀌는 값은 모아서 저장
    },
    flush,
  };
}

module.exports = { createPrefs };
