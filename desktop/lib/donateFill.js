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

// 시그니처 고르기: 후원 페이지의 '시그니처' 탭에서 이름이 같은 시그니처를 고른다 (후원 버튼은 사용자가 직접).
// 투네이션 화면: 목록 항목은 이미지 부분(SignatureImage)을 눌러야 반응한다.
//   - 탭의 목록: 이미지를 누르면 바로 선택 (같은 것을 다시 누르면 해제되므로 한 번만)
//   - 전체보기 창: 이미지를 누르면 표시만 되고, '사용하기'(넓은 화면)나 '선택하기'(모바일)를 눌러야 적용된다. 검색은 돋보기·Enter
// 한 번에 한 단계씩 하고 결과를 돌려준다. 'ok'(후원금액이 시그니처 금액이 됐거나 목록에 그 시그니처만 남음) · 'no-signature-tab' → 끝, 그 밖은 다시 실행.
// key: 이번 요청을 구분 (페이지에 남긴 진행 표시가 이전 요청과 섞이지 않게)
/** 전체보기 검색어: 투네이션 검색은 특수문자(𝄖 . [ 등)가 든 이름을 찾지 못해, 이름의 첫 낱말(글자·숫자)만 쓴다 */
function signatureSearchQuery(name) {
  const words = String(name).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
  return words[0] || String(name).trim();
}

function selectSignatureScript(name, tag, cash, key) {
  if (typeof name !== 'string' || !name.trim() || name.length > 50) throw new Error('잘못된 시그니처 이름');
  if (typeof tag !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(tag)) throw new Error('잘못된 후원 아이디');
  if (!Number.isInteger(cash) || cash < 1 || cash > 100_000_000) throw new Error('잘못된 금액');
  const N = JSON.stringify(name.trim());
  const Q = JSON.stringify(signatureSearchQuery(name));
  const C = JSON.stringify(cash.toLocaleString('en-US'));
  const K = JSON.stringify(String(key).slice(0, 40));
  const path = JSON.stringify(`/donate/${tag}`);
  return `(() => {
    if (!decodeURIComponent(location.pathname).startsWith(${path})) return 'waiting';
    const N = ${N}, Q = ${Q}, C = ${C}, K = ${K};
    const st = window.__mvSig && window.__mvSig.k === K ? window.__mvSig : (window.__mvSig = { k: K });
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0;
    // 이름 옆 말풍선에 이름이 한 번 더 들어 있다
    const match = (i) => { const t = ((i.querySelector('[class*=SignatureName]') || i).textContent || '').trim(); return t === N || t === N + N; };
    const image = (i) => i.querySelector('[class*=SignatureImage]');
    const popupItems = () => [...document.querySelectorAll('[class*=SignatureItem][class*=PopupItem]')].filter(vis);
    const mainItems = () => [...document.querySelectorAll('#baselayout [class*=SignatureItem]')].filter((i) => vis(i) && !/PopupItem/.test(i.className));
    const search = () => [...document.querySelectorAll('input[type=search]')].find((i) => vis(i) && i.placeholder === '시그니처 검색');
    const submit = () => [...document.querySelectorAll('[class*=PopupSubmitButton]')].find(vis);
    const amountOk = () => {
      let b = [...document.querySelectorAll('#baselayout *')].find((e) => e.children.length === 0 && e.textContent.trim() === '후원금액');
      for (let i = 0; i < 3 && b; i++, b = b.parentElement) if ((b.innerText || '').replace(/\\s/g, '').includes(C + '캐시')) return true;
      return false;
    };
    const popupOpen = popupItems().length > 0 || !!search() || !!submit();
    if (st.applied && !popupOpen) {
      const m = mainItems();
      if (amountOk() || (m.length === 1 && match(m[0]))) return 'ok';
      return 'waiting';
    }
    if (popupOpen) {
      const item = popupItems().find(match);
      if (item) {
        if (!/(^|\\s)_SelectedItem_/.test(image(item).className)) { image(item).click(); return 'focused'; }
        // 넓은 화면은 항목 안 '사용하기', 모바일은 아래 '선택하기'
        const go = [...item.querySelectorAll('button')].find(vis) || submit();
        if (!go) return 'waiting';
        st.applied = true;
        go.click();
        return 'applied';
      }
      const s = search();
      if (!s) {
        // 모바일: 위쪽 돋보기 버튼을 눌러야 검색 칸이 나온다
        const open = [...document.querySelectorAll('button.ScreenButton')].filter(vis).find((b) => { const d = b.querySelector('path'); return !!d && (d.getAttribute('d') || '').startsWith('M15.5 14h'); });
        if (open) { open.click(); return 'search-open'; }
        return 'waiting';
      }
      // 검색어를 넣은 다음 차례에 검색한다 (같은 순간에 누르면 페이지가 이전 검색어로 찾는다)
      if (s.value !== Q) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(s, Q);
        s.dispatchEvent(new Event('input', { bubbles: true }));
        st.searched = null;
        return 'typed';
      }
      if (st.searched !== Q) {
        for (const t of ['keydown', 'keypress', 'keyup']) s.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        const box = s.closest('.Input');
        const icon = box && box.querySelector(':scope > .InputContainer > span');
        if (icon) icon.click();
        st.searched = Q;
        return 'searched';
      }
      return 'waiting';
    }
    const tab = [...document.querySelectorAll('#baselayout .TabItem')].find((t) => t.textContent.trim() === '시그니처');
    if (!tab) return document.querySelector('#baselayout .TabItem') ? 'no-signature-tab' : 'waiting';
    if (!tab.classList.contains('Selected')) { tab.click(); return 'tab'; }
    const item = mainItems().find(match);
    if (item) { st.applied = true; image(item).click(); return 'applied'; }
    const all = [...document.querySelectorAll('#baselayout button')].find((b) => vis(b) && b.textContent.includes('전체보기'));
    if (all) { all.click(); return 'popup'; }
    return 'waiting';
  })()`;
}

const DONE = new Set(['ok', 'no-signature-tab']);

/** 후원창이 뜨고 페이지가 그려질 때까지 시그니처 고르기를 되풀이한다 (view: 지금 후원창 WebContentsView를 돌려주는 함수) */
async function selectSignature(view, name, tag, cash, { tries = 30, interval = 400 } = {}) {
  const code = selectSignatureScript(name, tag, cash, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  let last = 'timeout';
  for (let i = 0; i < tries; i++) {
    const v = view();
    if (!v) last = 'no-view';
    else {
      const r = await v.webContents.executeJavaScript(code).catch(() => 'waiting');
      if (DONE.has(r)) return r;
      last = `timeout:${r}`; // 끝내 못 고르면 어느 단계에서 멈췄는지도 알린다
    }
    await new Promise((res) => setTimeout(res, interval));
  }
  return last;
}

module.exports = { fillAmountScript, fillMessageScript, selectSignatureScript, selectSignature, signatureSearchQuery };
