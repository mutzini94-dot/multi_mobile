// 설치형에서 옮긴 handlers.js의 타입 (필요한 것만)
type Result = { ok: true; data: unknown } | { ok: false; error: string };
export function createHandlers(deps: {
  client: unknown;
  openLogin(): void;
  resolveYouTube(key: string): Promise<string>;
  checkLive?(refs: { platform: string; key: string }[]): Promise<Map<string, unknown>>;
  logout?(): Promise<void>;
}): Record<string, ((payload?: unknown) => Promise<Result>) | undefined>;
