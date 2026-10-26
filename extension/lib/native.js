'use strict';
// Transport for the shared core (lib/platforms.js, lib/toonation.js), same shape as the Android
// www/core/native.js. Runs in the extension service worker, where host_permissions lift CORS.
//   toon.at  → credentials: 'include'. Chrome still leaves out toon.at's Partitioned session cookies, so
//              background.js copies them (getCookie below) into a Cookie header with a declarativeNetRequest rule.
//   others   → credentials: 'omit' (public APIs; the user's YouTube/Twitch cookies are not sent).
// Forbidden headers (User-Agent, Referer, Cookie) cannot be set from fetch; that session rule also sets Referer.

self.Native = (function () {
  const FORBIDDEN = /^(user-agent|referer|cookie|origin)$/i;

  async function http(url, { method = 'GET', headers = {}, body = null, timeout = 15000 } = {}) {
    const safe = {};
    for (const [k, v] of Object.entries(headers || {})) if (!FORBIDDEN.test(k)) safe[k] = v;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const toon = /^https:\/\/([a-z0-9-]+\.)*toon\.at\//i.test(url);
    try {
      return await fetch(url, { method, headers: safe, body, signal: ctrl.signal, credentials: toon ? 'include' : 'omit', cache: 'no-store' });
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * "name=value; name=value" — the cookies a toon.at tab would send to `url`. toon.at's session and login token
   * cookies are Partitioned (CHIPS, keyed to the https://toon.at top-level site), so they live in that partition;
   * a partitioned cookie wins over an unpartitioned one of the same name.
   */
  async function getCookie(url) {
    const host = new URL(url).hostname;
    const [plain, partitioned] = await Promise.all([
      chrome.cookies.getAll({ domain: host }),
      chrome.cookies.getAll({ domain: host, partitionKey: { topLevelSite: 'https://toon.at' } }).catch(() => []),
    ]);
    const applies = (c) => (c.hostOnly ? c.domain === host : host === c.domain.replace(/^\./, '') || host.endsWith(c.domain.startsWith('.') ? c.domain : `.${c.domain}`));
    const byName = new Map();
    for (const c of [...plain, ...partitioned]) if (applies(c) && (c.path || '/') === '/') byName.set(c.name, c.value);
    return [...byName].map(([n, v]) => `${n}=${v}`).join('; ');
  }

  return { http, getCookie };
})();
