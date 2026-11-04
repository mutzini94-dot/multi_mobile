'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { snap, touching, attachedGroup } = require('../lib/magnet');
const { isRemoteUrl, widgetUrl, allowRemoteWebview, detachBounds, REMOTE_PARTITION, REMOTE_URL } = require('../lib/remotePolicy');

test('자석: 가까운 창 가장자리에 붙고, 멀면 그대로', () => {
  const main = { x: 0, y: 0, width: 800, height: 600 };
  assert.deepStrictEqual(snap({ x: 810, y: 5, width: 200, height: 200 }, [main]), { x: 800, y: 0, width: 200, height: 200 });
  assert.deepStrictEqual(snap({ x: 900, y: 100, width: 200, height: 200 }, [main]), { x: 900, y: 100, width: 200, height: 200 });
  assert.deepStrictEqual(snap({ x: 100, y: 590, width: 200, height: 200 }, [main]).y, 600);
});

test('메인 창에 붙은 창은 (다른 창을 거쳐도) 같이 움직일 무리', () => {
  const main = { x: 0, y: 0, width: 800, height: 600 };
  const a = { x: 800, y: 0, width: 200, height: 200 };
  const b = { x: 800, y: 200, width: 200, height: 200 };
  const far = { x: 2000, y: 0, width: 200, height: 200 };
  assert.ok(touching(main, a));
  assert.deepStrictEqual(attachedGroup(main, new Map([['a', a], ['b', b], ['far', far]])).sort(), ['a', 'b']);
});

test('크리에이터 리모컨 주소·세션만 리모컨 브리지를 받는다', () => {
  assert.ok(isRemoteUrl(REMOTE_URL));
  assert.ok(isRemoteUrl('https://caprisontoon.github.io/remote01/#/widget/quick'));
  assert.ok(!isRemoteUrl('https://caprisontoon.github.io/other/'));
  assert.ok(!isRemoteUrl('https://caprisontoon.github.io.evil.com/remote01/'));
  assert.ok(!isRemoteUrl('http://caprisontoon.github.io/remote01/'));
  assert.ok(allowRemoteWebview({ src: REMOTE_URL, partition: REMOTE_PARTITION }));
  assert.ok(!allowRemoteWebview({ src: 'https://toon.at/', partition: REMOTE_PARTITION }));
  assert.ok(!allowRemoteWebview({ src: REMOTE_URL, partition: 'persist:mvweb' }));
});

test('분리 위젯 창 주소와 크기', () => {
  assert.strictEqual(widgetUrl('donations'), 'https://caprisontoon.github.io/remote01/?autologin=1#/widget/donations');
  assert.strictEqual(widgetUrl('../x'), null);
  assert.strictEqual(widgetUrl(''), null);
  assert.deepStrictEqual(detachBounds({ screenX: 10.4, screenY: 20, width: 100, height: 400, title: 't' }), { x: 10, y: 20, width: 150, height: 400 });
  assert.strictEqual(detachBounds({ screenX: 'a' }), null);
});
