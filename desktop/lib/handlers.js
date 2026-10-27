'use strict';
// 웹(window.multiviewDesktop)의 요청 처리. 예외 대신 { ok, data | error }로 돌려준다.
const { NotLoggedInError } = require('./toonation');

function createHandlers({ client, openLogin, resolveYouTube }) {
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
      return out;
    }),
  };
}

module.exports = { createHandlers };
