// 설치형(desktop/lib/platforms.js)을 안드로이드 앱용으로 옮긴 사본 (ESM). 네트워크 요청은 앱이 대신 보낸다(nativeFetch: CORS 없이, 앱의 투네이션 로그인 쿠키로).
// 원본을 고치면 여기도 같이 고친다.
import { nativeFetch } from './nativeFetch';
// Streaming-platform helpers: URL parsing and live-status lookups for CHZZK, Twitch and YouTube.
// These are the three platforms toon.at lists for a creator's channels (see the favorites popup).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const TWITCH_PUBLIC_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

const TWITCH_RESERVED = new Set([
  'directory', 'videos', 'settings', 'subscriptions', 'inventory', 'wallet', 'drops', 'search',
  'downloads', 'jobs', 'p', 'turbo', 'friends', 'messages', 'payments', 'login', 'signup', 'following',
]);

const PLATFORM_LABEL = { chzzk: '치지직', twitch: 'Twitch', youtube: 'YouTube', soop: 'SOOP' };

function toUrl(raw) {
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

/**
 * Parses a browser / channel URL into a platform channel reference.
 * Returns { platform, key, kind: 'channel'|'video', videoId?, url } or null.
 * `key` is normalized: chzzk channel id, lower-case twitch login, YouTube UC id or '@handle'.
 */
function parseChannelUrl(raw) {
  const u = toUrl(raw);
  if (!u) return null;
  const host = u.hostname.replace(/^(www|m)\./, '').toLowerCase();
  const seg = decodeURIComponent(u.pathname).split('/').filter(Boolean);

  if (host === 'chzzk.naver.com') {
    const id = seg[0] === 'live' || seg[0] === 'video' ? (seg[0] === 'live' ? seg[1] : null) : seg[0];
    if (id && /^[0-9a-f]{32}$/i.test(id)) return { platform: 'chzzk', key: id.toLowerCase(), kind: 'channel', url: `https://chzzk.naver.com/${id}` };
    return null;
  }
  if (host === 'twitch.tv') {
    const login = seg[0] && seg[0].toLowerCase();
    if (login && /^[a-z0-9_]{2,25}$/.test(login) && !TWITCH_RESERVED.has(login) && seg[1] !== 'videos' && seg[1] !== 'clip') {
      return { platform: 'twitch', key: login, kind: 'channel', url: `https://twitch.tv/${login}` };
    }
    return null;
  }
  if (host === 'youtu.be' && seg[0]) {
    return { platform: 'youtube', key: null, kind: 'video', videoId: seg[0], url: `https://www.youtube.com/watch?v=${seg[0]}` };
  }
  if (host === 'youtube.com') {
    if (seg[0] === 'watch' && u.searchParams.get('v')) {
      const v = u.searchParams.get('v');
      return { platform: 'youtube', key: null, kind: 'video', videoId: v, url: `https://www.youtube.com/watch?v=${v}` };
    }
    if (seg[0] === 'live' && seg[1]) {
      return { platform: 'youtube', key: null, kind: 'video', videoId: seg[1], url: `https://www.youtube.com/watch?v=${seg[1]}` };
    }
    if (seg[0] === 'channel' && /^UC[\w-]{22}$/.test(seg[1] || '')) {
      return { platform: 'youtube', key: seg[1], kind: 'channel', url: `https://www.youtube.com/channel/${seg[1]}` };
    }
    if (seg[0] && seg[0].startsWith('@')) {
      return { platform: 'youtube', key: seg[0].toLowerCase(), kind: 'channel', url: `https://www.youtube.com/${seg[0]}` };
    }
    if ((seg[0] === 'c' || seg[0] === 'user') && seg[1]) {
      return { platform: 'youtube', key: `${seg[0]}/${seg[1]}`.toLowerCase(), kind: 'channel', url: `https://www.youtube.com/${seg[0]}/${seg[1]}` };
    }
    return null;
  }
  if (/(^|\.)sooplive\.(co\.kr|com)$|(^|\.)afreecatv\.com$/.test(host)) {
    // SOOP (formerly AfreecaTV): play.sooplive.com/{id}/{broadNo}, ch.sooplive.com/{id}, bj.afreecatv.com/{id}
    if (seg[0] && /^[a-z0-9_]{3,20}$/i.test(seg[0])) {
      return { platform: 'soop', key: seg[0].toLowerCase(), kind: 'channel', url: `https://ch.sooplive.com/${seg[0]}` };
    }
  }
  return null;
}

function channelId(ref) {
  return ref && ref.key ? `${ref.platform}:${ref.key}` : null;
}

async function fetchText(url, opts = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await nativeFetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function jsonUnescape(s) {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s;
  }
}

// ---------- CHZZK ----------
async function chzzkStatus(id) {
  const j = JSON.parse(await fetchText(`https://api.chzzk.naver.com/polling/v2/channels/${id}/live-status`));
  const c = j.content || {};
  return {
    live: c.status === 'OPEN',
    title: c.liveTitle || '',
    viewers: c.concurrentUserCount || 0,
    category: c.liveCategoryValue || '',
    url: `https://chzzk.naver.com/live/${id}`,
  };
}

/** HLS playback URL of a live CHZZK stream (empty for offline or age-restricted streams). */
async function chzzkPlayback(id) {
  const j = JSON.parse(await fetchText(`https://api.chzzk.naver.com/service/v3/channels/${id}/live-detail`));
  const c = j.content || {};
  let media = [];
  try {
    media = JSON.parse(c.livePlaybackJson || '{}').media || [];
  } catch {
    /* no playback info */
  }
  const m = media.find((x) => x.mediaId === 'HLS') || media[0];
  return { hls: (m && m.path) || '', title: c.liveTitle || '', adult: !!c.adult, live: c.status === 'OPEN' };
}

async function chzzkChannel(id) {
  const j = JSON.parse(await fetchText(`https://api.chzzk.naver.com/service/v1/channels/${id}`));
  const c = j.content || {};
  return { name: c.channelName || '', image: c.channelImageUrl || '' };
}

// ---------- Twitch (public GQL, batched) ----------
async function twitchStatuses(logins) {
  const out = new Map();
  for (let i = 0; i < logins.length; i += 35) {
    const chunk = logins.slice(i, i + 35);
    const query = `{ users(logins: ${JSON.stringify(chunk)}) { login displayName profileImageURL(width: 70) stream { title viewersCount game { displayName } } } }`;
    const j = JSON.parse(await fetchText('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-ID': TWITCH_PUBLIC_CLIENT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }));
    for (const u of (j.data && j.data.users) || []) {
      if (!u) continue;
      const s = u.stream;
      out.set(u.login.toLowerCase(), {
        live: !!s,
        title: (s && s.title) || '',
        viewers: (s && s.viewersCount) || 0,
        category: (s && s.game && s.game.displayName) || '',
        name: u.displayName,
        image: u.profileImageURL,
        url: `https://twitch.tv/${u.login}`,
      });
    }
  }
  return out;
}

// ---------- YouTube (page scraping; no API key needed) ----------
function parseYouTubePage(html) {
  const out = { live: false, title: '', channelId: '', author: '', videoId: '', viewers: 0 };
  const vd = html.indexOf('"videoDetails":{');
  if (vd >= 0) {
    const block = html.slice(vd, vd + 2500);
    out.videoId = (block.match(/"videoId":"([\w-]{11})"/) || [])[1] || '';
    out.title = jsonUnescape((block.match(/"title":"((?:[^"\\]|\\.)*)"/) || [])[1] || '');
    out.live = /"isLive":true/.test(block);
    out.channelId = (html.slice(vd, vd + 20000).match(/"channelId":"(UC[\w-]{22})"/) || [])[1] || '';
    out.author = jsonUnescape((html.slice(vd, vd + 40000).match(/"author":"((?:[^"\\]|\\.)*)"/) || [])[1] || '');
    const vc = html.match(/"originalViewCount":"(\d+)"/);
    if (out.live && vc) out.viewers = Number(vc[1]);
  }
  if (!out.channelId) {
    out.channelId = (html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) || [])[1]
      || (html.match(/"externalId":"(UC[\w-]{22})"/) || [])[1] || '';
  }
  if (!out.author) {
    out.author = jsonUnescape((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || '');
  }
  return out;
}

async function youtubeStatus(key) {
  const base = key.startsWith('UC') ? `https://www.youtube.com/channel/${key}` : `https://www.youtube.com/${key}`;
  const p = parseYouTubePage(await fetchText(`${base}/live`, { headers: { Cookie: 'CONSENT=YES+1' } }));
  return {
    live: p.live,
    title: p.live ? p.title : '',
    viewers: p.viewers,
    category: '',
    channelId: p.channelId,
    name: p.author,
    url: p.live && p.videoId ? `https://www.youtube.com/watch?v=${p.videoId}` : base,
  };
}

async function youtubeVideo(videoId) {
  const p = parseYouTubePage(await fetchText(`https://www.youtube.com/watch?v=${videoId}`, { headers: { Cookie: 'CONSENT=YES+1' } }));
  return p;
}

async function youtubeChannelId(handleKey) {
  const p = parseYouTubePage(await fetchText(`https://www.youtube.com/${handleKey}`, { headers: { Cookie: 'CONSENT=YES+1' } }));
  return { channelId: p.channelId, name: p.author };
}

// ---------- batched live check ----------
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (e) {
        results[idx] = { error: String(e && e.message || e) };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------- SOOP ----------
/** Live status from the SOOP station API (one call: nickname, profile, broadcast info). */
async function soopStatus(id) {
  const j = JSON.parse(await fetchText(`https://chapi.sooplive.com/api/${encodeURIComponent(id)}/station`));
  const b = j.broad || null;
  return {
    live: !!(b && b.broad_no),
    title: (b && b.broad_title) || '',
    viewers: (b && Number(b.current_sum_viewer)) || 0,
    category: '',
    broadNo: (b && String(b.broad_no)) || '',
    name: (j.station && j.station.user_nick) || id,
    image: j.profile_image ? String(j.profile_image).replace(/^\/\//, 'https://') : '',
    url: b && b.broad_no ? `https://play.sooplive.com/${id}/${b.broad_no}` : `https://ch.sooplive.com/${id}`,
  };
}

/** refs: [{platform,key}] → Map(channelId → status) */
async function checkLive(refs) {
  const out = new Map();
  const uniq = [...new Map(refs.filter((r) => r && r.key).map((r) => [channelId(r), r])).values()];
  const twitch = uniq.filter((r) => r.platform === 'twitch');
  const others = uniq.filter((r) => r.platform === 'chzzk' || r.platform === 'youtube' || r.platform === 'soop');

  const tasks = [];
  if (twitch.length) {
    tasks.push(twitchStatuses(twitch.map((r) => r.key)).then((m) => {
      for (const r of twitch) if (m.has(r.key)) out.set(channelId(r), m.get(r.key));
    }).catch((e) => console.warn('[live] twitch', e.message)));
  }
  tasks.push(mapLimit(others, 4, async (r) => {
    const s = r.platform === 'chzzk' ? await chzzkStatus(r.key) : r.platform === 'soop' ? await soopStatus(r.key) : await youtubeStatus(r.key);
    out.set(channelId(r), s);
  }));
  await Promise.all(tasks);
  return out;
}

export { UA, PLATFORM_LABEL, parseChannelUrl, channelId, checkLive, chzzkStatus, chzzkChannel, chzzkPlayback, twitchStatuses, youtubeStatus, soopStatus, youtubeVideo, youtubeChannelId, fetchText };
