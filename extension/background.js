'use strict';
/* global Toonation, Platforms, Native */
// 멀티뷰 후원 연동 확장 — 서비스 워커.
// 멀티뷰 페이지(content/bridge.js가 중계)의 요청 세 가지만 처리한다:
//   status    → { account: { name, profile } | null }
//   login     → toon.at 공식 로그인 창을 연다 (비밀번호는 다루지 않는다)
//   favorites → [{ tag, name, profile, channels: [{ platform, key, ytId? }] }]
// toon.at 클라이언트와 쿠키 처리는 toon-live-alert의 lib/를 그대로 복사해 쓴다.

self.window = self; // lib/가 모듈을 window에 붙인다
importScripts('lib/native.js', 'lib/platforms.js', 'lib/toonation.js');

const { ToonationClient, NotLoggedInError, ORIGIN } = Toonation;
const { youtubeChannelId, checkLive } = Platforms;
const client = new ToonationClient(null);

// fetch로는 Referer·Cookie를 정할 수 없고 워커 요청에는 Origin: chrome-extension://…가 붙는다.
// toon.at 세션 쿠키는 Partitioned라 워커 요청에 실리지 않으므로, 요청 전마다 toon.at 파티션의 쿠키를 복사한다.
// initiatorDomains: 이 확장의 요청에만 적용해 다른 확장 요청에는 사용자 쿠키가 실리지 않게 한다.
async function ensureHeaderRules() {
  const cookie = await Native.getCookie(ORIGIN).catch(() => '');
  const toonHeaders = [{ header: 'referer', operation: 'set', value: `${ORIGIN}/donator` }, { header: 'origin', operation: 'remove' }];
  if (cookie) toonHeaders.push({ header: 'cookie', operation: 'set', value: cookie });
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1, 2],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders: toonHeaders },
        condition: { requestDomains: ['toon.at'], initiatorDomains: [chrome.runtime.id], tabIds: [-1], resourceTypes: ['xmlhttprequest', 'other'] },
      },
      {
        id: 2,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'remove' }] },
        condition: { requestDomains: ['www.youtube.com', 'gql.twitch.tv'], initiatorDomains: [chrome.runtime.id], tabIds: [-1], resourceTypes: ['xmlhttprequest', 'other'] },
      },
    ],
  });
}

// '@handle' 유튜브 채널을 UC 채널 ID로 바꾼다 (결과는 캐시)
async function resolveYouTubeHandles(favorites) {
  const { ytHandles = {} } = await chrome.storage.local.get('ytHandles');
  for (const f of favorites) {
    for (const c of f.channels) {
      if (c.platform !== 'youtube' || !c.key || c.key.startsWith('UC')) continue;
      if (!(c.key in ytHandles)) ytHandles[c.key] = await youtubeChannelId(c.key).then((r) => r.channelId || '', () => '');
      if (ytHandles[c.key]) c.ytId = ytHandles[c.key];
    }
  }
  await chrome.storage.local.set({ ytHandles });
}

const handlers = {
  async status() {
    await ensureHeaderRules();
    const a = await client.getAccount();
    return { account: a ? { name: a.name, profile: a.profile, cash: a.cash !== null && Number.isFinite(Number(a.cash)) ? Number(a.cash) : null } : null };
  },
  async login() {
    await chrome.tabs.create({ url: `${ORIGIN}/donator/login?callback=/donator` });
    return {};
  },
  /** 투네이션 로그아웃: toon.at 쿠키를 지운다 (세션·로그인 쿠키는 https://toon.at 파티션에 있다) */
  async logout() {
    const partitionKey = { topLevelSite: 'https://toon.at' };
    const [plain, partitioned] = await Promise.all([
      chrome.cookies.getAll({ domain: 'toon.at' }),
      chrome.cookies.getAll({ domain: 'toon.at', partitionKey }).catch(() => []),
    ]);
    const jobs = [...plain, ...partitioned].map((c) =>
      chrome.cookies.remove({
        url: `https://${c.domain.replace(/^\./, '')}${c.path || '/'}`,
        name: c.name,
        ...(c.partitionKey ? { partitionKey: c.partitionKey } : {}),
      }),
    );
    await Promise.all(jobs);
    return {};
  },
  /** 내 후원 내역: 최근 13개월치까지 여러 쪽에 걸쳐 모은다 (desktop/lib/handlers.js collectHistory와 같은 규칙) */
  async history() {
    await ensureHeaderRules();
    const now = Date.now();
    const out = [];
    for (let page = 1; page <= 20; page++) {
      const r = await client.getDonationHistory(page);
      let old = false;
      for (const i of r.items || []) {
        if (!(i.at > 0)) continue;
        if (now - i.at > 400 * 86400000) {
          old = true;
          continue;
        }
        out.push({ at: i.at, tag: String(i.tag || ''), creator: String(i.creator || ''), cash: Number(i.cash) || 0 });
      }
      if (old || page >= (r.pageCount || 1) || !(r.items || []).length) break;
    }
    return out;
  },
  async favorites() {
    await ensureHeaderRules();
    return toPageCreators(await client.getFavorites());
  },
  /** 투네이션 크리에이터 검색 (로그인 필요): 즐겨찾기와 같은 형식 */
  async search(q) {
    const query = typeof q === 'string' ? q.trim() : '';
    if (!query || query.length > 30) throw new Error('BAD_QUERY');
    await ensureHeaderRules();
    return toPageCreators(await client.search(query));
  },
  /** 투네이션 즐겨찾기 추가·해제 */
  async bookmark(p) {
    const tag = p && typeof p.tag === 'string' ? p.tag : '';
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(tag)) throw new Error('BAD_TAG');
    await ensureHeaderRules();
    await client.setFavorite(tag, !!(p && p.on));
    return {};
  },
};

/** 즐겨찾기·검색 결과를 페이지에 넘길 형식으로: 필요한 필드만, 유튜브 핸들은 UC로, 라이브 여부 */
async function toPageCreators(list) {
  await resolveYouTubeHandles(list);
  // 페이지에는 필요한 필드만 넘긴다
  const out = list.map((f) => ({
    tag: f.tag,
    name: f.name,
    profile: f.profile,
    channels: f.channels.map((c) => ({ platform: c.platform, key: c.key, ...(c.ytId ? { ytId: c.ytId } : {}) })),
  }));
  // 라이브 여부 (유튜브·트위치만). 조회가 실패해도 목록은 돌려준다
  const refs = out.flatMap((f) => f.channels).filter((c) => (c.platform === 'twitch' || c.platform === 'youtube') && c.key);
  const live = refs.length ? await checkLive(refs.map(({ platform, key }) => ({ platform, key }))).catch(() => new Map()) : new Map();
  for (const c of refs) {
    const s = live.get(`${c.platform}:${c.key}`);
    if (!s) continue;
    c.live = !!s.live;
    if (s.live) Object.assign(c, { title: s.title || '', viewers: Number(s.viewers) || 0 });
  }
  return out;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 이 확장의 content script(멀티뷰 페이지 탭)에서 온 요청만 받는다
  if (sender.id !== chrome.runtime.id || !sender.tab) return false;
  const handler = Object.prototype.hasOwnProperty.call(handlers, msg && msg.type) ? handlers[msg.type] : null;
  if (!handler) {
    sendResponse({ ok: false, error: 'UNKNOWN_REQUEST' });
    return false;
  }
  handler(msg.payload).then(
    (data) => sendResponse({ ok: true, data }),
    (e) => sendResponse({ ok: false, error: e instanceof NotLoggedInError ? 'NOT_LOGGED_IN' : String((e && e.message) || e) }),
  );
  return true;
});
