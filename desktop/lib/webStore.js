'use strict';
// 웹 화면 저장값(localStorage의 mv.* — 설정·즐겨찾기·화면 구성 등) 사본을 앱 데이터 폴더에 둔다.
// localStorage는 주소(포트 포함)별이라, 고정 포트(47230)를 다른 프로그램이 쓰고 있어 다른 포트로 열리면
// 저장값이 비어 보인다. 사본이 있으면 웹 화면이 시작할 때 더 최신인 쪽으로 되살린다 (src/storage/webStoreSync.ts).
const fs = require('fs');

const MAX_BYTES = 5_000_000;

function clean(snap) {
  if (!snap || typeof snap !== 'object' || !Number.isFinite(snap.savedAt) || !snap.data || typeof snap.data !== 'object' || Array.isArray(snap.data)) return null;
  const data = {};
  let size = 0;
  for (const [k, v] of Object.entries(snap.data)) {
    if (!k.startsWith('mv.') || k === '__proto__' || typeof v !== 'string') continue;
    size += k.length + v.length;
    data[k] = v;
  }
  return size > MAX_BYTES ? null : { savedAt: snap.savedAt, data };
}

function createWebStore(file) {
  return {
    load() {
      try {
        return clean(JSON.parse(fs.readFileSync(file, 'utf8')));
      } catch {
        return null;
      }
    },
    /** 바로 쓴다 (웹 화면이 바뀐 것만 몇 초에 한 번 보낸다). 임시 파일에 쓴 뒤 바꿔 끼워 반쯤 쓴 파일이 남지 않게 */
    save(snap) {
      const c = clean(snap);
      if (!c) return false;
      try {
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(c));
        fs.renameSync(tmp, file);
        return true;
      } catch {
        return false;
      }
    },
  };
}

module.exports = { createWebStore };
