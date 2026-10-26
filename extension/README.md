# 멀티뷰 후원 연동 확장

멀티뷰 후원 브라우저(`http://localhost:5230`)에서 투네이션 로그인과 즐겨찾기 목록을 불러오는 크롬 확장입니다.

## 설치 (개발용)
1. 크롬에서 `chrome://extensions` 열기
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** → 이 `extension` 폴더 선택

## 동작
- 멀티뷰의 "불러오기" 창 → **투네이션 로그인** → 공식 로그인 창(`toon.at/donator/login`)에서 로그인
- 로그인이 감지되면 즐겨찾기 목록이 나타나고, 하나를 고르면 그 칸에 방송이 들어갑니다.
- 비밀번호는 다루지 않습니다. toon.at 쿠키 세션으로 `/dapi/donator/common`, `/dapi/donator/favorites`만 호출합니다.

## 구성
- `background.js` — status / login / favorites 처리
- `content/bridge.js` — 멀티뷰 페이지와 확장 사이 postMessage 중계 (manifest `matches`의 주소에서만)
- `lib/` — `toon-live-alert/lib`에서 복사한 투네이션 클라이언트·쿠키 처리 (수정하지 말고 원본에서 다시 복사)

배포 도메인이 생기면 `manifest.json`의 `content_scripts.matches`에 추가하세요.

## 테스트
`npm run test:ext` (상위 multiview 폴더에서)
