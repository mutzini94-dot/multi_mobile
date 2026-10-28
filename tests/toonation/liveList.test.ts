import { fetchLiveList, liveListUrl } from '../../src/toonation/liveList';

const row = (o: object) => ({ title: '방송', channel: '', creatorName: '이름', creatorProfileImageUrl: 'https://p/x.png', thumbnailImage: 'https://t/{width}x{height}.jpg', categoryName: '게임', platformType: 1, viewers: 10, linkTag: 'tag1', v: null, ...o });

test('liveListUrl: toon.at/donator?live 페이지가 쓰는 API 주소', () => {
  const u = new URL(liveListUrl({ page: 2, size: 20, q: '칠', order: 'STREAM_BEGIN', platform: 'twitch' }));
  expect(u.origin + u.pathname).toBe('https://live-streaming.toon.at/api/stream/live-stream-list');
  expect(Object.fromEntries(u.searchParams)).toMatchObject({ creatorName: '칠', pageNo: '2', pageSize: '20', orderKey: 'STREAM_BEGIN', isDesc: 'true', platformType: '1' });
});

test('fetchLiveList: 유튜브·트위치 방송을 Creator로 바꾸고 치지직·잘못된 항목은 뺀다', async () => {
  const UC = 'UC' + 'a'.repeat(22);
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: {
    content: [
      row({ creatorName: '트위치', channel: 'http://www.twitch.tv/Some_One', platformType: 1, linkTag: 'tw1' }),
      row({ creatorName: '유튜브 &amp; 친구', channel: `https://youtube.com/channel/${UC}/live`, platformType: 2, linkTag: 'yt1', thumbnailImage: 'https://img.youtube.com/vi/x/hqdefault.jpg' }),
      row({ creatorName: '치지직', channel: 'https://chzzk.naver.com/abc', platformType: 8 }),
      row({ creatorName: '아이디없음', channel: 'https://www.twitch.tv/abcd', linkTag: '' }),
    ],
    totalPages: 3, totalElements: 50,
  } }), { status: 200 }));
  const r = await fetchLiveList({ page: 1, size: 20, q: '', order: 'VIEWERS', platform: '' }, fetchImpl as unknown as typeof fetch);
  expect(r.totalPages).toBe(3);
  expect(r.items.map((i) => [i.creator.name, i.creator.platform, i.creator.channel, i.creator.donateId, i.creator.source])).toEqual([
    ['트위치', 'twitch', 'some_one', 'tw1', 'toonation'],
    ['유튜브 & 친구', 'youtube', UC, 'yt1', 'toonation'],
  ]);
  expect(r.items[0].creator.live).toEqual({ title: '방송', viewers: 10 });
  expect(r.items[0].thumbnail).toBe('https://t/320x180.jpg');
});

test('fetchLiveList: HTTP 오류는 예외', async () => {
  const fetchImpl = vi.fn(async () => new Response('x', { status: 503 }));
  await expect(fetchLiveList({ page: 1, size: 20, q: '', order: 'VIEWERS', platform: '' }, fetchImpl as unknown as typeof fetch)).rejects.toThrow('503');
});

test('fetchLiveList: 유튜브는 라이브 영상 ID(v)를 함께 담는다 (채널 임베드가 안 되는 채널 대비)', async () => {
  const UC = 'UC' + 'b'.repeat(22);
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { content: [
    row({ channel: `https://youtube.com/channel/${UC}/live`, platformType: 2, v: 'm8HaYP0qcRM' }),
    row({ channel: `https://youtube.com/channel/${UC.replace('b', 'c')}/live`, platformType: 2, v: '<bad>' }),
  ], totalPages: 1 } }), { status: 200 }));
  const r = await fetchLiveList({ page: 1, size: 20, q: '', order: 'VIEWERS', platform: '' }, fetchImpl as unknown as typeof fetch);
  expect(r.items.map((i) => i.creator.videoId)).toEqual(['m8HaYP0qcRM', undefined]);
});
