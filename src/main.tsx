import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { desktopSoloLink, webSoloLink } from './detach/channel';
import { decodeSolo } from './detach/soloLink';
import { SoloView } from './detach/SoloView';
import { getDesktopApi } from './desktop/desktopApi';
import './ui/app.css';

// #solo=… 로 열리면 칸 하나만 보여 주는 분리 창
const solo = decodeSolo(window.location.hash);
const desktop = getDesktopApi(window);
createRoot(document.getElementById('root')!).render(
  solo ? <SoloView payload={solo} link={desktop ? desktopSoloLink(desktop) : webSoloLink(window)} desktop={desktop} /> : <App />,
);
