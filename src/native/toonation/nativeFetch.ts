import { registerPlugin } from '@capacitor/core';

/**
 * 안드로이드 앱의 투네이션 연동 (android/.../ToonationPlugin.java)
 * - fetch: 앱(안드로이드 코드)이 대신 요청한다. 브라우저 CORS 제한이 없고, 앱의 로그인 쿠키(toon.at)를 실어 보낸다.
 *   허용한 주소(toon.at·유튜브·트위치 등)만 보낼 수 있다.
 * - login: toon.at 공식 로그인 화면을 앱 안 별도 화면으로 연다 (비밀번호는 앱이 다루지 않는다)
 * - logout: 앱에 저장된 toon.at 로그인 쿠키를 지운다
 */
export interface ToonationNativePlugin {
  fetch(o: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; url: string; body: string }>;
  cookies(o: { url: string }): Promise<{ cookies: { name: string; value: string }[] }>; // 앱에 저장된 그 주소의 쿠키 (프로필 사진용 로그인 토큰)
  login(): Promise<void>;
  logout(): Promise<void>;
}

export const ToonationNative = registerPlugin<ToonationNativePlugin>('Toonation');

/** 설치형 코드가 쓰던 fetch(Response 일부)와 같은 모양으로 */
export async function nativeFetch(url: string, opts: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {}) {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.headers ?? {})) headers[k] = String(v);
  const r = await ToonationNative.fetch({ url, method: opts.method ?? 'GET', headers, ...(typeof opts.body === 'string' ? { body: opts.body } : {}) });
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    url: r.url,
    text: async () => r.body,
    json: async () => JSON.parse(r.body) as unknown,
  };
}
