'use strict';
// 웹(window.multiviewDesktop)의 요청 처리. 예외 대신 { ok, data | error }로 돌려준다.
const { NotLoggedInError } = require('./toonation');

function createHandlers({ client, openLogin, resolveYouTube, checkLive = async () => new Map(), logout = async () => {} }) {
  const wrap = (fn) => async () => {
    try {
      return { ok: true, data: await fn() };
    } catch (e) {
      return { ok: false, error: e instanceof NotLoggedInError ? 'NOT_LOGGED_IN' : String((e && e.message) || e) };
    }
  };
  return {
    status: wrap(async () => {
      const a = await client.getAccount();
      return { account: a ? { name: a.name, profile: a.profile } : null };
    }),
    login: wrap(async () => {
      openLogin();
      return {};
    }),
    logout: wrap(async () => {
      await logout();
      return {};
    }),
    favorites: wrap(async () => {
      const list = await client.getFavorites();
      const out = [];
      for (const f of list) {
        const channels = [];
        for (const c of f.channels || []) {
          const ch = { platform: c.platform, key: c.key };
          if (c.platform === 'youtube' && c.key && !c.key.startsWith('UC')) {
            const ytId = await resolveYouTube(c.key).catch(() => '');
            if (ytId) ch.ytId = ytId;
          }
          channels.push(ch);
        }
        out.push({ tag: f.tag, name: f.name, profile: f.profile, channels });
      }
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
    }),
  };
}

module.exports = { createHandlers };
