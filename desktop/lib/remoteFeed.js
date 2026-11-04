'use strict';
// 크리에이터 리모컨: 투네이션 실시간 후원 수신 (알림창 웹소켓).
// caprisontoon/remote01 의 electron/toonation.ts 와 src/api/toonation.ts 를 옮긴 것.
//   1) https://toon.at/widget/alertbox/<키> 페이지에서 "payload":"<값>" 을 읽는다
//   2) wss://ws.toon.at/<payload> 로 웹소켓 연결 (Origin https://toon.at)
//   3) 12초마다 ping, 끊기면 10초 뒤 재연결
//   4) 메시지 JSON { code, content } — code 101 = 후원

const TOONATION_WS = 'wss://ws.toon.at/';
const ALERTBOX_URL = 'https://toon.at/widget/alertbox/';
const PING_INTERVAL_MS = 12000;
const RECONNECT_MS = 10000;
const DONATION_CODE = 101;

function extractAlertboxKey(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const m = /widget\/alertbox\/([A-Za-z0-9_-]+)/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{8,}$/.test(s) ? s : null;
}

function parsePayload(html) {
  const m = /"payload"\s*:\s*"([A-Za-z0-9]+)"/.exec(String(html || ''));
  return m ? m[1] : null;
}

const str = (v) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
const num = (v) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/,/g, '')) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const pick = (o, keys) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};

/** 계정 ID는 앞 4자만 보이고 나머지는 가린다 */
function maskAccount(account) {
  if (!account) return '';
  const [local, domain] = account.split('@');
  const masked = local.length <= 4 ? `${local}***` : `${local.slice(0, 4)}***`;
  return domain ? `${masked}@${domain}` : masked;
}

/** 웹소켓 메시지를 리모컨의 Donation으로 바꾼다. 후원(101)이 아니면 null. */
function toDonation(msg, now = Date.now()) {
  if (!msg || Number(msg.code) !== DONATION_CODE || !msg.content || typeof msg.content !== 'object') return null;
  const c = msg.content;
  const nickname = str(pick(c, ['name', 'nickname', 'nick', 'user_name'])) ?? '익명';
  const account = str(pick(c, ['account', 'uid', 'user_id', 'id'])) ?? '';
  const cash = num(pick(c, ['amount', 'cash', 'price', 'money'])) ?? 0;
  const text = str(pick(c, ['message', 'comment', 'msg', 'text']));
  const video = pick(c, ['video_info', 'video', 'youtube']);
  const roulette = pick(c, ['roulette', 'roulette_result']);
  let kind = 'text';
  const extra = {};
  if (video && typeof video === 'object') {
    kind = 'video';
    extra.title = str(pick(video, ['title', 'name']));
    extra.url = str(pick(video, ['url', 'link']));
    extra.thumbnail = str(pick(video, ['thumbnail', 'thumb']));
    extra.platform = 'Youtube';
  } else if (roulette) {
    kind = 'roulette';
    extra.item = typeof roulette === 'object' ? str(pick(roulette, ['result', 'item', 'name'])) : str(roulette);
  }
  return {
    id: `live-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    donorId: account ? `live-${account}` : `live-${nickname}`,
    nickname,
    account: maskAccount(account),
    cash,
    createdAt: now,
    text,
    ...extra,
  };
}

class ToonationFeed {
  /** deps: onStatus, onDonation, onRaw, fetch, WebSocket (ws 패키지 모양), pageBase, wsBase */
  constructor(deps) {
    this.d = deps;
    this.ws = null;
    this.ping = undefined;
    this.retry = undefined;
    this.key = null;
    this.received = 0;
    this.stopped = true;
    this.pageBase = deps.pageBase || ALERTBOX_URL;
    this.wsBase = deps.wsBase || TOONATION_WS;
  }

  status(s) {
    this.d.onStatus(s);
  }

  async connect(input) {
    const key = extractAlertboxKey(input);
    if (!key) return { ok: false, error: '알림창 URL(https://toon.at/widget/alertbox/…) 또는 키를 확인해 주세요.' };
    this.disconnect();
    this.key = key;
    this.stopped = false;
    this.received = 0;
    return this.open();
  }

  disconnect() {
    this.stopped = true;
    clearInterval(this.ping);
    clearTimeout(this.retry);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.on('error', () => {}); // 닫는 중 오류로 프로세스가 죽지 않게
      this.ws.terminate();
    }
    this.ws = null;
    this.status({ state: 'off' });
  }

  scheduleRetry(message) {
    if (this.stopped) return;
    this.status({ state: 'error', message, retrying: true });
    clearTimeout(this.retry);
    this.retry = setTimeout(() => void this.open(), RECONNECT_MS);
  }

  stop(message) {
    this.stopped = true;
    this.status({ state: 'error', message, retrying: false });
    return { ok: false, error: message };
  }

  async open() {
    if (!this.key || this.stopped) return { ok: false, error: '연결이 중지되었습니다.' };
    this.status({ state: 'connecting' });
    let payload = null;
    try {
      const res = await this.d.fetch(this.pageBase + this.key, { headers: { 'User-Agent': 'Mozilla/5.0 TOONA-Remocon' } });
      // 키가 틀린 경우: 재시도해도 소용없으므로 멈춘다
      if (res.status === 404) return this.stop('알림창을 찾을 수 없습니다. 알림창 URL(키)을 다시 확인해 주세요.');
      if (!res.ok) throw new Error(`알림창 페이지 응답 ${res.status}`);
      payload = parsePayload(await res.text());
    } catch (e) {
      const message = `알림창 페이지를 불러오지 못했습니다: ${e && e.message}`;
      this.scheduleRetry(message);
      return { ok: false, error: message };
    }
    if (this.stopped) return { ok: false, error: '연결이 중지되었습니다.' };
    if (!payload) return this.stop('알림창 페이지에서 연결 정보(payload)를 찾지 못했습니다. 키가 맞는지 확인해 주세요.');

    return new Promise((resolve) => {
      const WS = this.d.WebSocket;
      const ws = new WS(this.wsBase + payload, { headers: { Origin: 'https://toon.at' } });
      this.ws = ws;
      let settled = false;
      ws.on('open', () => {
        settled = true;
        this.status({ state: 'connected', since: Date.now(), received: this.received });
        clearInterval(this.ping);
        this.ping = setInterval(() => ws.readyState === WS.OPEN && ws.ping('#ping'), PING_INTERVAL_MS);
        resolve({ ok: true });
      });
      ws.on('message', (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }
        this.d.onRaw(msg);
        const d = toDonation(msg);
        if (d) {
          this.received++;
          this.d.onDonation(d);
          this.status({ state: 'connected', since: Date.now(), received: this.received });
        }
      });
      ws.on('close', () => {
        clearInterval(this.ping);
        if (!settled) {
          settled = true;
          resolve({ ok: false, error: '웹소켓 연결이 거부되었습니다.' });
        }
        this.scheduleRetry('연결이 끊겼습니다. 10초 뒤 다시 연결합니다.');
      });
      ws.on('error', (err) => {
        if (!settled) {
          settled = true;
          resolve({ ok: false, error: `웹소켓 오류: ${err && err.message}` });
        }
      });
    });
  }
}

module.exports = { extractAlertboxKey, parsePayload, toDonation, maskAccount, ToonationFeed, ALERTBOX_URL, TOONATION_WS };
