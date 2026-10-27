'use strict';
// toon.at donator API client. Authentication is the cookie session created when the user signs in
// through the official login page (see openLoginWindow in main.js); we never handle passwords.
//
// Endpoints (from the donator SPA bundles at front.cdn.toona.xyz/assets/frontend/toonation/donator):
//   GET /dapi/donator/common                       → { Account, LocaleCode, ... } (Account null = logged out)
//   GET /dapi/donator/favorites/{page}/{n}/{sort}  → { list:[{tag,name,favorite,channel:[{url}],profile_default,...}], count, PageInfo }
//   GET /dapi/donator/favorites/{page}             → same, legacy page
//   GET /dapi/donator/search?searchText=&page=&hasCertificationUser=&perPage=
//   GET /dapi/donator/bookmark/{tag}/{1|0}          → add / remove favorite
//   GET https://api.toon.at/stream/lives/main       → public list of live creators with linkTag
//   Donation page: https://toon.at/donate/{tag}

const { parseChannelUrl, channelId } = require('./platforms');

const ORIGIN = 'https://toon.at';
const UPLOAD = 'https://cache.cdn.toona.xyz/prod/uploaded';
const ASSETS = 'https://front.cdn.toona.xyz/assets/frontend-assets/toonation/donator/assets';
// Account.AccountType → socialType (enum in the donator bundle: Twitch=1, Google=2, …)
const SOCIAL_TYPE = { twitch: 1, google: 2, youtube: 2, facebook: 3, kakao: 4, payco: 5, twitter: 6, mixer: 7, naver: 8, apple: 9 };
// Gauge colors per next membership title (copied from the donator home bundle).
const TITLE_COLORS = {
  동수저: '#DF9F57', 은수저: '#92A8C3', 금수저: '#FFD448',
  다이아: '#BCC5EA', 블루다이아: '#51B1FF', 그린다이아: '#29D383', 레드다이아: '#FF4245', 골드다이아: '#FFD448', 블랙다이아: '#303242',
  노블레스: '#BCC5EA', 블루노블레스: '#51B1FF', 그린노블레스: '#29D383', 레드노블레스: '#FF4245', 골드노블레스: '#FFD448', 블랙노블레스: '#303242',
  프라임: '#BCC5EA', 실버프라임: '#92A8C3', 골드프라임: '#FFD448', 블랙프라임: '#303242',
};

class NotLoggedInError extends Error {
  constructor() {
    super('NOT_LOGGED_IN');
  }
}

function decodeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** toon.at times come as .NET ticks, epoch ms/s, or date strings (KST without zone) → epoch ms. */
function parseToonTime(t) {
  if (t == null || t === '') return 0;
  const n = Number(t);
  if (Number.isFinite(n) && n > 0) {
    if (n > 6e17) return Math.round((n - 621355968000000000) / 10000); // .NET ticks
    if (n > 1e12) return n; // ms
    return n * 1000; // s
  }
  const s = String(t).trim();
  const d = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}+09:00`);
  return Number.isFinite(d) ? d : 0;
}

function profileUrl(item) {
  const pd = item.profile_default || item.profileDefault || item.profile_image || item.ProfileImage;
  if (pd && /^https?:/.test(pd)) return pd;
  if (pd && item.profile_image_enabled !== 0) return `${UPLOAD}/__streamer_profile__/${pd}.img`;
  return `${ASSETS}/images/ranking/ic_profile_empty.png`;
}

function collectChannelUrls(item) {
  const urls = [];
  const ch = item.channel || item.channels || item.Channel;
  if (Array.isArray(ch)) {
    for (const c of ch) {
      if (typeof c === 'string') urls.push(c);
      else if (c && (c.url || c.Url || c.link)) urls.push(c.url || c.Url || c.link);
    }
  } else if (typeof ch === 'string') {
    urls.push(ch);
  }
  return urls;
}

function normalizeCreator(item) {
  const tag = item.tag || item.linkTag || item.link_tag || item.LinkTag || item.aspx_donate_linktag;
  const channels = [];
  for (const url of collectChannelUrls(item)) {
    const ref = parseChannelUrl(url);
    if (ref && ref.key && !channels.some((c) => channelId(c) === channelId(ref))) channels.push(ref);
  }
  return {
    tag: tag ? String(tag) : '',
    name: decodeHtml(item.name || item.Name || item.nickname || item.StreamerName || item.creatorName || ''),
    profile: profileUrl(item),
    certified: item.certification_status === 1 || item.certification_status === 2 || item.certified === true,
    favorite: item.favorite === undefined ? true : !!item.favorite,
    channels,
  };
}

/** Finds the first array of creator-like objects in an arbitrary API payload. */
function findCreatorArray(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const seen = new Set();
  const stack = [payload];
  while (stack.length) {
    const cur = stack.shift();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      if (cur.length && cur.every((x) => x && typeof x === 'object') && cur.some((x) => x.tag || x.linkTag || x.link_tag || x.LinkTag)) return cur;
      cur.forEach((x) => stack.push(x));
    } else {
      Object.values(cur).forEach((x) => stack.push(x));
    }
  }
  return [];
}

class ToonationClient {
  constructor(ses) {
    this.ses = ses;
  }

  async request(path, { json = true, allowAnon = false } = {}) {
    const url = path.startsWith('http') ? path : `${ORIGIN}${path}`;
    const r = await this.ses.fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain, */*', Referer: `${ORIGIN}/donator` },
      bypassCustomProtocolHandlers: true,
    });
    // Electron's session.fetch may leave r.url empty; logged-out redirects are also caught by the HTML check below.
    let finalPath = '';
    try {
      finalPath = r.url ? new URL(r.url).pathname : '';
    } catch {
      /* ignore */
    }
    if (!allowAnon && /\/(donator\/)?login/.test(finalPath)) throw new NotLoggedInError();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`);
    const text = await r.text();
    if (!json) return text;
    const trimmed = text.trim();
    if (trimmed.startsWith('<')) {
      if (!allowAnon) throw new NotLoggedInError();
      return null;
    }
    return trimmed ? JSON.parse(trimmed) : null;
  }

  /** Returns the logged-in donator account or null. */
  async getAccount() {
    const j = await this.request('/dapi/donator/common', { allowAnon: true });
    const a = j && j.Account;
    if (!a) return null;
    // Same rules as the donator home's profile card (MembershipTitleCard): the equipped title image,
    // else the social account's profile photo, else the account icon, else the default title image.
    const titleImage = a.TitleHash ? `${UPLOAD}/__special_title_img__/${a.TitleHash}.img` : '';
    const icon = typeof a.Icon === 'string' && /^https?:/.test(a.Icon) ? a.Icon : '';
    const photo = titleImage ? '' : await this.getProfilePhoto(a.AccountType).catch(() => '');
    return {
      raw: a,
      idx: a.Idx ?? a.idx,
      name: decodeHtml(a.DisplayName || a.Nickname || a.NickName || a.nickname || a.Name || a.name || a.Username || '도네이터'),
      profile: titleImage || photo || icon || a.ProfileImage || a.profile_image || `${ASSETS}/images/default-title.png?v=2`,
      titleImage,
      level: a.Level ?? a.level ?? null,
      title: decodeHtml(a.Title || ''),
      cash: a.Cash ?? a.cash ?? null,
      point: a.Point ?? a.point ?? null,
    };
  }

  /**
   * Profile photo of the signed-in social account, as toon.at/donator gets it: the login token cookie
   * → GET /dapi/donator/social/accounts?itoken=… → [{ socialType, profileImgUrl, nickname, … }],
   * picking the entry whose socialType matches the account type (cached for 10 minutes).
   */
  async getProfilePhoto(accountType) {
    if (this._photo && Date.now() - this._photo.at < 10 * 60 * 1000 && this._photo.type === accountType) return this._photo.url;
    const cookies = await this.ses.cookies.get({ url: ORIGIN });
    const pick = (n) => (cookies.find((c) => c.name === n) || {}).value || '';
    // same order as the site: legacy cookie first, then the v2 cookie (values are already URL-encoded)
    const token = pick('__toonation_login_donator_accessToken') || pick('__toonation_login_donator_accessToken_v2');
    if (!token) return '';
    const j = await this.request(`/dapi/donator/social/accounts?itoken=${token}`);
    const list = (j && (Array.isArray(j.result) ? j.result : Array.isArray(j.data) ? j.data : Array.isArray(j) ? j : [])) || [];
    const want = SOCIAL_TYPE[String(accountType || '').toLowerCase()];
    const entry = list.find((x) => Number(x.socialType) === want && x.profileImgUrl) || (list.length === 1 ? list[0] : null) || list.find((x) => x.profileImgUrl);
    const url = entry && /^https?:/.test(entry.profileImgUrl || '') ? entry.profileImgUrl : '';
    this._photo = { at: Date.now(), type: accountType, url };
    return url;
  }

  /**
   * Membership progress shown as the ring around the profile picture on toon.at/donator
   * (GET /dapi/v2/Membership/donator/progress; the site requests /dapi/donator/sessionid first).
   * → { level, percent (0-100), nextTitle, color } or null
   */
  async getMembership() {
    await this.request('/dapi/donator/sessionid', { json: false }).catch(() => '');
    const j = await this.request('/dapi/v2/Membership/donator/progress');
    const d = (j && (j.data || j.result)) || null;
    if (!d) return null;
    const percent = Math.min(100, Math.max(0, Number(d.progressPercent) || 0));
    return { level: d.currentLevel ?? null, percent, nextTitle: d.nextTitle || '', color: TITLE_COLORS[d.nextTitle] || '#519cff' };
  }

  async getFavorites() {
    const all = [];
    const seen = new Set();
    let page = 1;
    let pageCount = 1;
    let mode = 'popup';
    while (page <= pageCount && page <= 60) {
      let j;
      try {
        j = mode === 'popup'
          ? await this.request(`/dapi/donator/favorites/${page}/5/1`)
          : await this.request(`/dapi/donator/favorites/${page}`);
      } catch (e) {
        if (e instanceof NotLoggedInError) throw e;
        if (mode === 'popup' && page === 1) {
          mode = 'legacy';
          continue;
        }
        throw e;
      }
      const list = (j && Array.isArray(j.list) ? j.list : findCreatorArray(j));
      for (const it of list) {
        const c = normalizeCreator(it);
        if (c.tag && !seen.has(c.tag)) {
          seen.add(c.tag);
          all.push(c);
        }
      }
      pageCount = (j && j.PageInfo && j.PageInfo.PageCount) || pageCount;
      if (!list.length) break;
      page++;
    }
    return all;
  }

  async search(keyword, perPage = 12) {
    const q = encodeURIComponent(keyword);
    const j = await this.request(`/dapi/donator/search?searchText=${q}&page=1&hasCertificationUser=0&perPage=${perPage}`);
    return findCreatorArray(j).map(normalizeCreator).filter((c) => c.tag);
  }

  async setFavorite(tag, on) {
    await this.request(`/dapi/donator/bookmark/${encodeURIComponent(tag)}/${on ? 1 : 0}`, { json: false });
  }

  /** Public list of live creators registered on Toonation (no login needed). */
  async getMainLives() {
    // Public endpoint: plain fetch (session.fetch rejects this cross-origin call with ERR_BLOCKED_BY_CLIENT).
    if (this._lives && Date.now() - this._lives.at < 60 * 1000) return this._lives.list;
    const r = await fetch('https://api.toon.at/stream/lives/main', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} lives`);
    const j = await r.json();
    const list = ((j && j.result) || []).map((l) => ({
      tag: String(l.linkTag),
      name: l.creatorName,
      title: l.title,
      viewers: l.viewers,
      category: l.categoryName,
      thumbnail: l.thumbnailImage,
      profile: l.creatorProfileImageUrl,
      ref: parseChannelUrl(l.channel),
    }));
    this._lives = { at: Date.now(), list };
    return list;
  }

  /**
   * Full live list shown on toon.at/donator?live (the page embeds live-streaming.toon.at, which
   * calls this JSON API). pageNo is 1-based; response is a Spring Page.
   * platform: '' | 1 (Twitch) | 2 (YouTube) | 8 (CHZZK)
   */
  async getLiveList({ page = 1, size = 20, creatorName = '', title = '', categoryName = '', platform = '', orderKey = 'VIEWERS', isDesc = true } = {}) {
    // orderKey: VIEWERS | STREAM_BEGIN (values from the live-streaming.toon.at bundle); search by creator, title or category
    const order = orderKey === 'STREAM_BEGIN' ? 'STREAM_BEGIN' : 'VIEWERS';
    const q = new URLSearchParams({ title, creatorName, categoryName, orderKey: order, isDesc: String(isDesc !== false), pageNo: String(page), pageSize: String(size), platformType: String(platform || '') });
    const r = await fetch(`https://live-streaming.toon.at/api/stream/live-stream-list?${q}`, { headers: { Accept: 'application/json', Referer: 'https://toon.at/donator?live' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} live-stream-list`);
    const j = await r.json();
    const d = (j && j.data) || {};
    const PLATFORM = { 1: 'twitch', 2: 'youtube', 8: 'chzzk' };
    const items = (d.content || []).map((l) => {
      const platformKey = PLATFORM[l.platformType] || '';
      let url = String(l.channel || '').replace(/^http:/, 'https:');
      if (platformKey === 'youtube' && l.v) url = `https://www.youtube.com/watch?v=${l.v}`;
      return {
        tag: String(l.linkTag || ''),
        name: decodeHtml(l.creatorName || ''),
        profile: l.creatorProfileImageUrl || '',
        title: l.title || '',
        thumbnail: String(l.thumbnailImage || '').replace('{width}x{height}', '320x180'),
        platform: platformKey,
        viewers: l.viewers || 0,
        category: l.categoryName || '',
        url,
        startedAt: l.streamStartTime || '',
        elapsedSec: l.streamElapsedTime || 0,
      };
    });
    return { items, page, size, totalPages: d.totalPages || 1, total: d.totalElements || items.length };
  }

  /**
   * Rolling banners of the toon.at/donator top area (public): GET /dapi/service/banner/get/list.
   * The site shows `donator_top` (1364×258) on wide screens and the same campaigns as
   * `donator_mobile` (720×160) on narrow ones; the widget is narrow, so it uses the mobile set.
   * exposure_from/exposure_to are .NET ticks (100 ns since 0001-01-01). Cached 30 minutes.
   */
  async getBanners(area = 'donator_mobile') {
    if (this._banners && this._banners.area === area && Date.now() - this._banners.at < 30 * 60 * 1000) return this._banners.list;
    const r = await fetch(`${ORIGIN}/dapi/service/banner/get/list?area_name=${area}`, { headers: { Referer: `${ORIGIN}/donator` } });
    if (!r.ok) throw new Error(`HTTP ${r.status} banners`);
    const j = JSON.parse(await r.text());
    const nowTicks = Date.now() * 10000 + 621355968000000000;
    const list = ((j && j.data && j.data[area]) || [])
      .filter((b) => b.image_path && /^https:\/\//.test(b.image_path))
      .filter((b) => (!b.exposure_from || b.exposure_from <= nowTicks) && (!b.exposure_to || b.exposure_to >= nowTicks))
      .sort((a, b) => (a.exposure_order || 0) - (b.exposure_order || 0))
      .map((b) => ({ id: b.idx, name: b.banner_name || '', image: b.image_path, link: /^https:\/\//.test(b.banner_link || '') ? b.banner_link : '' }));
    this._banners = { at: Date.now(), area, list };
    return list;
  }

  /**
   * My donation history (toon.at/donator/mypage/donation-history):
   * GET /dapi/donator/mypage/donation_history?page=N → { Data: [{ Time, LinkTag, StreamerName, Name, Cash,
   * DonationType, Message }], PageInfo: { PageCount } }
   */
  async getDonationHistory(page = 1) {
    const j = await this.request(`/dapi/donator/mypage/donation_history?page=${Math.max(1, page | 0)}`);
    const rows = (j && (j.Data || j.data || (Array.isArray(j) ? j : []))) || [];
    return {
      page,
      pageCount: (j && j.PageInfo && j.PageInfo.PageCount) || 1,
      items: rows.map((r) => ({
        at: parseToonTime(r.Time),
        tag: String(r.LinkTag || ''),
        creator: decodeHtml(r.StreamerName || ''),
        cash: Number(r.Cash) || 0,
        type: r.DonationType,
        message: decodeHtml(String(r.Message || '')).replace(/^video:/, ''),
      })),
    };
  }

  chargeUrl() {
    return `${ORIGIN}/donator/account/charge`;
  }

  donateUrl(tag) {
    return `${ORIGIN}/donate/${encodeURIComponent(tag)}`;
  }
}

module.exports = { ToonationClient, NotLoggedInError, normalizeCreator, decodeHtml, ORIGIN };
