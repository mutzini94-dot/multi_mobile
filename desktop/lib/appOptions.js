'use strict';
// 설치형 앱 옵션 (prefs.json): Windows 시작 시 실행 · 닫으면 트레이로 · 자동 업데이트.
// 메인 프로세스가 시작할 때부터 써야 해서 웹 설정(localStorage)이 아니라 여기에 둔다.

const APP_OPTION_DEFAULTS = { autoLaunch: false, closeToTray: true, autoUpdate: true };

function createAppOptions({ prefs, setLoginItem, packaged }) {
  const all = () => Object.fromEntries(Object.keys(APP_OPTION_DEFAULTS).map((k) => [k, prefs.get(k) ?? APP_OPTION_DEFAULTS[k]]));
  // Windows 시작 시 실행: 트레이로 숨긴 채 시작 (--hidden). 개발 실행(electron .)은 등록하지 않는다
  const applyLoginItem = () => {
    if (packaged) setLoginItem({ openAtLogin: !!all().autoLaunch, args: ['--hidden'] });
  };
  return {
    all,
    get: (key) => all()[key],
    applyLoginItem,
    /** 옵션을 바꾼다. 모르는 옵션이나 불린이 아닌 값이면 false */
    set(key, value) {
      if (!Object.prototype.hasOwnProperty.call(APP_OPTION_DEFAULTS, key) || typeof value !== 'boolean') return false;
      prefs.set(key, value);
      if (key === 'autoLaunch') applyLoginItem();
      return true;
    },
  };
}

module.exports = { createAppOptions, APP_OPTION_DEFAULTS };
