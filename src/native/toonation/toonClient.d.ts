// 설치형에서 옮긴 toonClient.js의 타입 (필요한 것만)
export class ToonationClient {
  constructor(ses: { fetch(url: string, opts?: never): Promise<unknown>; cookies?: { get(q: { url: string }): Promise<{ name: string; value: string }[]> } });
}
export class NotLoggedInError extends Error {}
