import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { desktopSoloLink, webSoloLink } from './detach/channel';
import { decodeSolo } from './detach/soloLink';
import { SoloView } from './detach/SoloView';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { Splash } from './ui/Splash';
import { getDesktopApi } from './desktop/desktopApi';
import { restoreIfNewer, startMirror } from './storage/webStoreSync';
import './ui/app.css';

// #solo=… 로 열리면 칸 하나만 보여 주는 분리 창
const solo = decodeSolo(window.location.hash);
const desktop = getDesktopApi(window);
const root = createRoot(document.getElementById('root')!);

async function start() {
  if (solo) {
    root.render(
      <ErrorBoundary>
        <SoloView payload={solo} link={desktop ? desktopSoloLink(desktop) : webSoloLink(window)} desktop={desktop} />
      </ErrorBoundary>,
    );
    return;
  }
  // 설치형: 포트가 바뀌어 이 주소의 저장값이 비었거나 오래됐으면 앱 데이터 폴더의 사본으로 되살린 뒤 시작하고,
  // 실행 중에는 바뀐 저장값을 사본으로 보낸다
  if (desktop?.webStoreLoad && desktop.webStoreSave) {
    try {
      restoreIfNewer(window.localStorage, await desktop.webStoreLoad());
      const save = desktop.webStoreSave.bind(desktop);
      startMirror(window.localStorage, save);
    } catch {
      // 사본 없이 시작
    }
  }
  root.render(
    <ErrorBoundary>
      <App />
      <Splash />
    </ErrorBoundary>,
  );
}

start();
