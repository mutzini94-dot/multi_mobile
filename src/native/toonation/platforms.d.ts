// 설치형에서 옮긴 platforms.js의 타입 (필요한 것만)
export function youtubeChannelId(key: string): Promise<{ channelId?: string }>;
export function checkLive(refs: { platform: string; key: string }[]): Promise<Map<string, unknown>>;
