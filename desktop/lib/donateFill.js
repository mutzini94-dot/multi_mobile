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

module.exports = { fillAmountScript, fillMessageScript };
