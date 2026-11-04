import type { KV } from '../storage/safeStorage';

/**
 * 상단 스위치: 후원 리모컨(이 멀티뷰) ↔ 크리에이터 리모컨.
 * 크리에이터 리모컨은 caprisontoon/remote01 (claude/trusting-wozniak-ghvzg2) 웹 리모컨을 그대로 띄운다.
 * 그 저장소는 이 브랜치에 올릴 때마다 GitHub Pages에 다시 배포한다 (.github/workflows/pages.yml).
 * 로그인은 아직 목업이라 바로 들어가게 autologin=1.
 */
export const CREATOR_REMOTE_URL = 'https://caprisontoon.github.io/remote01/?autologin=1';

export const MODE_KEY = 'mv.mode.v1';
export type RemoteMode = 'donor' | 'creator';

export function readMode(kv: KV): RemoteMode {
  return kv.get(MODE_KEY) === 'creator' ? 'creator' : 'donor';
}
