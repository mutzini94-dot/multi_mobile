import type { BridgeRequest, ToonationBridge } from '../../toonation/bridge';
import { createHandlers } from './handlers.js';
import { checkLive, youtubeChannelId } from './platforms.js';
import { ToonationClient } from './toonClient.js';
import { nativeFetch, ToonationNative } from './nativeFetch';

/**
 * 안드로이드 앱의 투네이션 연동: 설치형과 같은 처리(handlers)를 앱 안에서 돌린다.
 * 로그인은 공식 로그인 화면을 열기만 하고, 로그인 여부는 웹이 상태(status)를 다시 확인해 알아낸다 (useToonation).
 */
export function nativeToonationBridge(): ToonationBridge {
  const client = new ToonationClient({
    fetch: nativeFetch,
    cookies: { get: ({ url }: { url: string }) => ToonationNative.cookies({ url }).then((r) => r.cookies) },
  });
  const handlers = createHandlers({
    client,
    openLogin: () => {
      void ToonationNative.login();
    },
    resolveYouTube: (key) => youtubeChannelId(key).then((r) => r.channelId || ''),
    checkLive,
    logout: () => ToonationNative.logout(),
  });
  return {
    async request<T>(type: BridgeRequest, payload?: unknown): Promise<T> {
      const handle = handlers[type];
      if (!handle) throw new Error('NOT_SUPPORTED');
      const res = await handle(payload);
      if (!res.ok) throw new Error(res.error);
      return res.data as T;
    },
  };
}
