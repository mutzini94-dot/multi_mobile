import { chatUrl } from '../../src/domain/pages';
import { mkCreator } from '../helpers/fixtures';

const UC = 'UC' + 'a'.repeat(22);
const tw = mkCreator(1, { channel: 'some_one' });
const yt = mkCreator(2, { platform: 'youtube', channel: UC, key: `youtube:${UC}` });

test('트위치: 설치형(webview)은 팝아웃 채팅(로그인하면 채팅 입력 가능), 웹(iframe)은 임베드 + parent', () => {
  expect(chatUrl(tw, null, 'webview', 'localhost')).toBe('https://www.twitch.tv/popout/some_one/chat');
  expect(chatUrl(tw, null, 'iframe', 'mv.example.com')).toBe('https://www.twitch.tv/embed/some_one/chat?parent=mv.example.com');
});

test('유튜브: 라이브 영상 ID가 있어야 채팅을 띄울 수 있다', () => {
  expect(chatUrl(yt, null, 'webview', 'localhost')).toBeNull();
  expect(chatUrl(yt, 'm8HaYP0qcRM', 'webview', 'localhost')).toBe('https://www.youtube.com/live_chat?is_popout=1&v=m8HaYP0qcRM');
  expect(chatUrl(yt, 'm8HaYP0qcRM', 'iframe', 'mv.example.com')).toBe('https://www.youtube.com/live_chat?v=m8HaYP0qcRM&embed_domain=mv.example.com');
  expect(chatUrl(yt, '<bad>', 'webview', 'localhost')).toBeNull();
});
