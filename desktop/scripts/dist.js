'use strict';
// Windows 설치 파일(NSIS)을 만든다. toon-widget의 scripts/dist.js와 같은 방식:
// electron-builder의 7-Zip이 한글 경로("C:\Users\권준호\...")를 잘못 다루므로 ASCII 임시 폴더에서 빌드한 뒤
// 결과물을 ./dist로 복사한다. MV_BUILD_DIR로 임시 폴더를 바꿀 수 있다.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const tmpOut = path.join(process.env.MV_BUILD_DIR || os.tmpdir(), 'multiview-desktop-build');
if (/[^\x00-\x7f]/.test(tmpOut)) {
  console.error(`빌드 폴더는 ASCII 경로여야 합니다: ${tmpOut}\nMV_BUILD_DIR을 ASCII 경로로 지정하세요. 예: C:\\build`);
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'web', 'index.html'))) {
  console.error('web/index.html이 없습니다. 먼저 npm run build:web 을 실행하세요.');
  process.exit(1);
}

fs.rmSync(tmpOut, { recursive: true, force: true });
const args = ['--win', 'nsis', '--x64', `--config.directories.output="${tmpOut.replace(/\\/g, '/')}"`, '--publish', 'never'];
// 자동 업데이트: MV_UPDATE_URL에 업데이트 파일(latest.yml·설치 파일)을 올릴 HTTP(S) 폴더 주소를 주면 앱에 넣는다
//   MV_UPDATE_URL=https://cdn.example.com/multiview/ npm run dist
const updateUrl = (process.env.MV_UPDATE_URL || '').trim();
if (updateUrl) {
  const url = updateUrl.endsWith('/') ? updateUrl : `${updateUrl}/`;
  args.push('--config.publish.provider=generic', `--config.publish.url="${url}"`, `--config.extraMetadata.multiview.updateUrl="${url}"`);
}
execSync(`npx electron-builder ${args.join(' ')}`, { cwd: root, stdio: 'inherit' });

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
for (const f of fs.readdirSync(tmpOut)) {
  if (/\.(exe|blockmap)$/.test(f) || f === 'latest.yml') {
    fs.copyFileSync(path.join(tmpOut, f), path.join(dist, f));
    console.log('→', path.join(dist, f));
  }
}
