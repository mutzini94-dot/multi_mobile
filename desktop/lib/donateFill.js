'use strict';
// 빠른 후원: 투네이션 후원 페이지의 "후원금액" 칸만 채운다 (toon-widget의 fillDonate와 같은 방식).
// 후원 버튼은 사용자가 직접 누른다.

function fillAmountScript(amount) {
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000_000) throw new Error('잘못된 금액');
  const text = JSON.stringify(amount.toLocaleString('en-US'));
  return `(() => {
    const setVal = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const visible = (el) => el && el.getBoundingClientRect().height > 0;
    const label = [...document.querySelectorAll('#baselayout *')].find((e) => e.children.length === 0 && e.textContent.trim() === '후원금액');
    let box = label, input = null;
    for (let i = 0; i < 6 && box && !input; i++) { box = box.parentElement; input = box && [...box.querySelectorAll('input[type=text]')].find(visible); }
    if (!input) return false;
    input.focus(); setVal(input, ${text}); input.blur();
    return true;
  })()`;
}

// 자주 쓰는 후원 메시지: 후원 페이지의 메시지 칸(보이는 textarea)만 채운다 (toon-widget fillDonate의 message와 같은 방식)
function fillMessageScript(message) {
  if (typeof message !== 'string' || !message.trim() || message.length > 300) throw new Error('잘못된 메시지');
  const text = JSON.stringify(message.trim());
  return `(() => {
    const visible = (el) => el && el.getBoundingClientRect().height > 0;
    const ta = [...document.querySelectorAll('#baselayout textarea')].find(visible);
    if (!ta) return false;
    const v = ${text}.slice(0, ta.maxLength > 0 ? ta.maxLength : 1000);
    ta.focus();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, v);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    ta.blur();
    return true;
  })()`;
}

// 시그니처 고르기: 후원 페이지의 '시그니처' 탭에서 이름이 같은 시그니처를 누른다 (후원 버튼은 사용자가 직접).
// 한 번에 한 단계씩 하고 결과를 돌려준다: 'tab'(탭을 열었다) · 'popup'(전체보기를 열었다) · 'searched'(검색했다) ·
// 'picked'(모바일 목록에서 눌렀다, 다음에 '선택하기') · 'waiting' → 다시 실행,
// 'ok'(골랐다) · 'no-signature-tab'(시그니처가 없는 크리에이터) → 끝. 다른 크리에이터 페이지면 'waiting' (아직 넘어가는 중).
function selectSignatureScript(name, tag) {
  if (typeof name !== 'string' || !name.trim() || name.length > 50) throw new Error('잘못된 시그니처 이름');
  if (typeof tag !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(tag)) throw new Error('잘못된 후원 아이디');
  const N = JSON.stringify(name.trim());
  const path = JSON.stringify(`/donate/${tag}`);
  return `(() => {
    if (!decodeURIComponent(location.pathname).startsWith(${path})) return 'waiting';
    const N = ${N};
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0;
    // 이름 옆 말풍선에 이름이 한 번 더 들어 있다
    const match = (i) => { const t = ((i.querySelector('[class*=SignatureName]') || i).textContent || '').trim(); return t === N || t === N + N; };
    // 모바일 화면의 시그니처 목록 창: 누른 뒤 '선택하기'를 눌러야 적용된다
    const choose = () => [...document.querySelectorAll('button')].find((b) => vis(b) && b.textContent.trim() === '선택하기');
    if (window.__mvSigPicked === N && choose()) { window.__mvSigPicked = null; choose().click(); return 'ok'; }
    const pick = (item) => { item.click(); window.__mvSigPicked = N; return choose() ? 'picked' : 'ok'; };
    const search = [...document.querySelectorAll('input[type=search]')].find((i) => i.placeholder === '시그니처 검색' && vis(i));
    if (search) {
      if (search.value !== N) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, N);
        search.dispatchEvent(new Event('input', { bubbles: true }));
        search.dispatchEvent(new Event('change', { bubbles: true }));
        return 'searched';
      }
      // 전체보기 창의 항목은 문서 뒤쪽에 있다
      const item = [...document.querySelectorAll('[class*=SignatureItem]')].filter(vis).reverse().find(match);
      if (!item) return 'waiting';
      item.click();
      // 창을 닫아야 고른 시그니처가 적용된다
      let box = search, close = null;
      for (let i = 0; i < 10 && box && !close; i++) { box = box.parentElement; close = box && [...box.querySelectorAll('button')].find((b) => vis(b) && b.textContent.trim() === '닫기'); }
      if (close) close.click();
      return 'ok';
    }
    const tab = [...document.querySelectorAll('#baselayout .TabItem')].find((t) => t.textContent.trim() === '시그니처');
    if (!tab) return document.querySelector('#baselayout .TabItem') ? 'no-signature-tab' : 'waiting';
    if (!tab.classList.contains('Selected')) { tab.click(); return 'tab'; }
    const item = [...document.querySelectorAll('#baselayout [class*=SignatureItem]')].filter(vis).find(match);
    if (item) return pick(item);
    const all = [...document.querySelectorAll('#baselayout button')].find((b) => vis(b) && b.textContent.includes('전체보기'));
    if (all) { all.click(); return 'popup'; }
    return 'waiting';
  })()`;
}

const DONE = new Set(['ok', 'no-signature-tab']);

/** 후원창이 뜨고 페이지가 그려질 때까지 시그니처 고르기를 되풀이한다 (view: 지금 후원창 WebContentsView를 돌려주는 함수) */
async function selectSignature(view, name, tag, { tries = 30, interval = 400 } = {}) {
  const code = selectSignatureScript(name, tag);
  let last = 'timeout';
  for (let i = 0; i < tries; i++) {
    const v = view();
    if (!v) last = 'no-view';
    else {
      const r = await v.webContents.executeJavaScript(code).catch(() => 'waiting');
      if (DONE.has(r)) return r;
      last = 'timeout';
    }
    await new Promise((res) => setTimeout(res, interval));
  }
  return last;
}

module.exports = { fillAmountScript, fillMessageScript, selectSignatureScript, selectSignature };
