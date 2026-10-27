# 멀티뷰 후원 — 설치형 (Electron)

유튜브·트위치 방송을 여러 개 동시에 보면서 투네이션으로 후원하는 Windows 앱입니다.
투네이션 후원 위젯(`toon-widget`)과 같은 방식으로 동작합니다.

- **투네이션 로그인**: 불러오기 창의 **투네이션 로그인** → 앱이 공식 로그인 창(`toon.at/donator/login`)을 직접 띄웁니다. 로그인하면 창이 닫히고 즐겨찾기 목록이 나타납니다. 비밀번호는 다루지 않습니다(전용 세션 `persist:toonation`의 쿠키 세션 사용).
- **즐겨찾기 → 칸**: 목록에서 크리에이터(채널)를 고르면 그 칸에 방송이 들어가고, 후원 대상은 투네이션 tag로 정해집니다.
- **후원**: **후원하기** → 앱 가운데 **모달** 후원창이 뜹니다. **PIP 모드**를 누르면 항상 위에 떠 있는 작은 창으로 옮겨져 방송을 보면서 후원할 수 있습니다(머리줄을 끌어 이동, "모달로"로 되돌리기). 모드를 바꿔도 입력 중인 내용은 유지되고, 로그인한 계정으로 바로 후원합니다.

## 실행

```bash
npm install          # 처음 한 번 (electron 바이너리가 없으면: node node_modules/electron/install.js)
npm start            # 웹 빌드(../ → desktop/web) 후 앱 실행
npm run dev          # 개발: 상위 폴더에서 vite 개발 서버(5230)를 띄운 상태에서 실행
```

## 설치 파일

```bash
npm run dist         # dist/MultiviewDonate-Setup-<버전>.exe
```

electron-builder의 7-Zip이 한글 경로를 다루지 못해 ASCII 임시 폴더에서 빌드한 뒤 `dist/`로 복사합니다. 임시 폴더는 `MV_BUILD_DIR`로 바꿀 수 있습니다.

## 구성

| 파일 | 역할 |
|---|---|
| `main.js` | 메인 프로세스: 로컬 서버로 웹 화면 띄우기, 로그인 창, 후원창(WebContentsView), IPC |
| `preload.js` | 웹에 `window.multiviewDesktop` 노출 (`src/desktop/desktopApi.ts`) |
| `lib/toonation.js`, `lib/platforms.js` | `toon-widget/src/main`에서 복사한 투네이션 클라이언트 (수정하지 말고 원본에서 다시 복사) |
| `lib/staticServer.js` | 웹 빌드를 `http://localhost:<port>`로 제공 (트위치 임베드는 일반 도메인이 필요해 file:// 불가) |
| `lib/donateController.js` | 후원창(모달·PIP) 자리 옮기기 |
| `pip.html`, `pip-preload.js` | PIP 후원창 머리줄 (끌기 · 모달로 · 닫기) |
| `lib/handlers.js` | status / login / favorites 처리 |

## 테스트·점검

```bash
npm test                                   # 모듈 테스트
MV_SMOKE_OUT=<폴더> electron .              # 앱을 띄워 상태(smoke.json)와 스크린샷(smoke.png)을 남기고 종료
MV_SMOKE_SCRIPT=<js> MV_SMOKE_WAIT=<ms>     # 스크린샷 전에 실행할 시나리오
```
