// 설치형(desktop/lib/handlers.js)을 안드로이드 앱용으로 옮긴 사본 (ESM). 네트워크 요청은 앱이 대신 보낸다(nativeFetch: CORS 없이, 앱의 투네이션 로그인 쿠키로).
// 원본을 고치면 여기도 같이 고친다.
// 웹(window.multiviewDesktop)의 요청 처리. 예외 대신 { ok, data | error }로 돌려준다.
import { NotLoggedInError } from './toonClient.js';

// 내 후원 내역: 이만큼 지난 내역까지만 모은다 (월별·크리에이터별 합계, 이번 달 한도에 충분)
const HISTORY_SPAN_MS = 400 * 24 * 60 * 60 * 1000;
const HISTORY_MAX_PAGES = 20;

/** 여러 쪽에 걸친 후원 내역을 최근 13개월치까지 모은다 (필요한 필드만) */
async function collectHistory(client, now) {
  const out = [];
  for (let page = 1; page <= HISTORY_MAX_PAGES; page++) {
    const r = await client.getDonationHistory(page);
    let old = false;
    for (const i of r.items || []) {
      if (!(i.at > 0)) continue;
      if (now - i.at > HISTORY_SPAN_MS) {
        old = true;
        continue;
      }
      out.push({ at: i.at, tag: String(i.tag || ''), creator: String(i.creator || ''), cash: Number(i.cash) || 0 });
    }
    if (old || page >= (r.pageCount || 1) || !(r.items || []).length) break;
  }
  return out;
}

const DONATE_TAG_RE = /^[A-Za-z0-9_-]{1,64}$/;

function createHandlers({ client, openLogin, resolveYouTube, checkLive = async () => new Map(), logout = async () => {}, now = () => Date.now() }) {
  /** 즐겨찾기·검색 결과를 웹에 넘길 형식으로: 필요한 필드만, 유튜브 핸들은 UC로, 라이브 여부 */
  async function toBridgeCreators(list) {
    const out = [];
    for (const f of list || []) {
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
      const st = live.get(`${c.platform}:${c.key}`);
      if (!st) continue;
      c.live = !!st.live;
      if (st.live) Object.assign(c, { title: st.title || '', viewers: Number(st.viewers) || 0 });
    }
    return out;
  }
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
      return { account: a ? { name: a.name, profile: a.profile, cash: Number.isFinite(Number(a.cash)) && a.cash !== null ? Number(a.cash) : null } : null };
    }),
    login: wrap(async () => {
      openLogin();
      return {};
    }),
    history: wrap(() => collectHistory(client, now())),
    logout: wrap(async () => {
      await logout();
      return {};
    }),
    favorites: wrap(async () => toBridgeCreators(await client.getFavorites())),
    // 투네이션 크리에이터 검색 (로그인 필요): 즐겨찾기와 같은 형식
    search: async (q) => {
      const query = typeof q === 'string' ? q.trim() : '';
      if (!query || query.length > 30) return { ok: false, error: 'BAD_QUERY' };
      return wrap(async () => toBridgeCreators(await client.search(query)))();
    },
    // 크리에이터 시그니처 목록 (로그인 없이도)
    signatures: async (tag) => {
      if (typeof tag !== 'string' || !DONATE_TAG_RE.test(tag)) return { ok: false, error: 'BAD_TAG' };
      return wrap(() => client.getSignatures(tag))();
    },
    // 투네이션 즐겨찾기 추가·해제
    bookmark: async (p) => {
      const tag = p && typeof p.tag === 'string' ? p.tag : '';
      if (!DONATE_TAG_RE.test(tag)) return { ok: false, error: 'BAD_TAG' };
      return wrap(async () => {
        await client.setFavorite(tag, !!(p && p.on));
        return {};
      })();
    },
  };
}

export { createHandlers, collectHistory };
