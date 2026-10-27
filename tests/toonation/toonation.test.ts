import { createBridge, favoritesFromToonation, type ToonationFavorite } from '../../src/toonation/bridge';

const UC = 'UC' + 'b'.repeat(22);

describe('favoritesFromToonation', () => {
  test('채널마다 한 줄, 후원 아이디는 tag, 출처는 toonation', () => {
    const list: ToonationFavorite[] = [
      {
        tag: 'tagA',
        name: '크리에이터A',
        profile: 'https://img/a.png',
        channels: [
          { platform: 'twitch', key: 'Some_One' },
          { platform: 'youtube', key: UC },
          { platform: 'chzzk', key: 'f'.repeat(32) },
        ],
      },
    ];
    expect(favoritesFromToonation(list)).toEqual([
      { key: 'twitch:some_one', name: '크리에이터A', donateId: 'tagA', platform: 'twitch', channel: 'some_one', source: 'toonation', profile: 'https://img/a.png' },
      { key: `youtube:${UC}`, name: '크리에이터A', donateId: 'tagA', platform: 'youtube', channel: UC, source: 'toonation', profile: 'https://img/a.png' },
    ]);
  });

  test('유튜브 @핸들은 확장이 변환한 ytId를 쓰고, 변환 실패면 건너뛴다', () => {
    const out = favoritesFromToonation([
      { tag: 't', name: 'B', profile: '', channels: [{ platform: 'youtube', key: '@b', ytId: UC }, { platform: 'youtube', key: '@c' }] },
    ]);
    expect(out.map((c) => c.channel)).toEqual([UC]);
  });

  test('tag가 이상하거나 이름이 비면 건너뛰고, 긴 이름은 30자로 자른다', () => {
    const out = favoritesFromToonation([
      { tag: '../x', name: 'A', profile: '', channels: [{ platform: 'twitch', key: 'aaaa' }] },
      { tag: 't1', name: '', profile: '', channels: [{ platform: 'twitch', key: 'bbbb' }] },
      { tag: 't2', name: '가'.repeat(40), profile: '', channels: [{ platform: 'twitch', key: 'cccc' }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('가'.repeat(30));
  });

  test('profile이 http(s)가 아니면 비운다', () => {
    const out = favoritesFromToonation([{ tag: 't', name: 'A', profile: 'javascript:alert(1)', channels: [{ platform: 'twitch', key: 'aaaa' }] }]);
    expect(out[0].profile).toBeUndefined();
  });

  test('형식이 깨진 항목은 무시한다', () => {
    expect(favoritesFromToonation([null, { tag: 't' }, 'x'] as unknown as ToonationFavorite[])).toEqual([]);
  });
});

describe('favoritesFromToonation 라이브', () => {
  test('라이브 여부·제목·시청자 수를 옮기고, 라이브 중인 채널을 맨 위로 (나머지 순서는 유지)', () => {
    const out = favoritesFromToonation([
      { tag: 'a', name: 'A', profile: '', channels: [{ platform: 'twitch', key: 'aaaa', live: false }] },
      { tag: 'b', name: 'B', profile: '', channels: [{ platform: 'twitch', key: 'bbbb' }] },
      { tag: 'c', name: 'C', profile: '', channels: [{ platform: 'twitch', key: 'cccc', live: true, title: '방송 중', viewers: 12 }] },
      { tag: 'd', name: 'D', profile: '', channels: [{ platform: 'twitch', key: 'dddd', live: true, title: '', viewers: 3 }] },
    ]);
    expect(out.map((c) => c.name)).toEqual(['C', 'D', 'A', 'B']);
    expect(out[0].live).toEqual({ title: '방송 중', viewers: 12 });
    expect(out[2].live).toBeUndefined();
  });

  test('제목이 너무 길면 100자로 자르고, 시청자 수가 숫자가 아니면 0', () => {
    const out = favoritesFromToonation([
      { tag: 'c', name: 'C', profile: '', channels: [{ platform: 'twitch', key: 'cccc', live: true, title: 'x'.repeat(300), viewers: 'many' as unknown as number }] },
    ]);
    expect(out[0].live).toEqual({ title: 'x'.repeat(100), viewers: 0 });
  });
});

describe('createBridge', () => {
  /** 확장 content script 흉내: mv-page 요청에 mv-ext로 응답 */
  function fakeExtension(win: Window, handler: (type: string) => unknown) {
    const listener = (e: MessageEvent) => {
      if (e.data?.source !== 'mv-page') return;
      const { id, type } = e.data;
      Promise.resolve(handler(type)).then((res) =>
        win.postMessage({ source: 'mv-ext', id, ...(res as object) }, '*'),
      );
    };
    win.addEventListener('message', listener);
    return () => win.removeEventListener('message', listener);
  }

  test('확장이 응답하면 결과를 돌려준다', async () => {
    const off = fakeExtension(window, (type) => (type === 'status' ? { ok: true, data: { account: { name: '나' } } } : { ok: false, error: 'X' }));
    const bridge = createBridge(window, 500);
    await expect(bridge.request('status')).resolves.toEqual({ account: { name: '나' } });
    await expect(bridge.request('favorites')).rejects.toThrow('X');
    off();
  });

  test('확장이 없으면 NO_EXTENSION', async () => {
    const bridge = createBridge(window, 50);
    await expect(bridge.request('status')).rejects.toThrow('NO_EXTENSION');
  });

  test('다른 요청 id의 응답은 무시한다', async () => {
    const bridge = createBridge(window, 100);
    const p = bridge.request('status');
    window.postMessage({ source: 'mv-ext', id: 'other', ok: true, data: 1 }, '*');
    await expect(p).rejects.toThrow('NO_EXTENSION');
  });
});
