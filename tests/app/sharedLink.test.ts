import { findSharedCreator, parseSharedLink } from '../../src/app/sharedLink';
import type { LivePage } from '../../src/toonation/liveList';
import { mkCreator } from '../helpers/fixtures';

test('공유 링크 읽기: 트위치 채널 · 유튜브 영상·라이브·쇼츠·채널·핸들 (앞뒤 글자가 있어도)', () => {
  expect(parseSharedLink('지금 방송 중! https://www.twitch.tv/Some_Streamer?sr=a')).toEqual({ platform: 'twitch', channel: 'some_streamer' });
  expect(parseSharedLink('https://m.twitch.tv/videos/123')).toBeNull();
  expect(parseSharedLink('https://youtu.be/abcdefghijk?si=x')).toEqual({ platform: 'youtube', videoId: 'abcdefghijk' });
  expect(parseSharedLink('https://www.youtube.com/watch?v=abcdefghijk&t=1')).toEqual({ platform: 'youtube', videoId: 'abcdefghijk' });
  expect(parseSharedLink('https://youtube.com/live/abcdefghijk?feature=share')).toEqual({ platform: 'youtube', videoId: 'abcdefghijk' });
  expect(parseSharedLink('https://youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa')).toEqual({ platform: 'youtube', channel: 'UCaaaaaaaaaaaaaaaaaaaaaa' });
  expect(parseSharedLink('https://www.youtube.com/@핸들')).toMatchObject({ platform: 'youtube' });
  expect(parseSharedLink('그냥 글자')).toBeNull();
  expect(parseSharedLink('https://example.com/x')).toBeNull();
});

const page = (items: ReturnType<typeof mkCreator>[]): LivePage => ({ items: items.map((creator) => ({ creator, thumbnail: '', category: '' })), page: 1, totalPages: 1, total: items.length });

test('트위치: 아는 크리에이터 먼저, 없으면 투네이션 라이브 목록에서 같은 채널', async () => {
  const known = [mkCreator(1, { channel: 'mine' })];
  const lives = vi.fn(async () => page([mkCreator(2, { channel: 'live_one', donateId: 'don_live' })]));
  expect(await findSharedCreator({ platform: 'twitch', channel: 'mine' }, { known, lives })).toBe(known[0]);
  expect(await findSharedCreator({ platform: 'twitch', channel: 'live_one' }, { known, lives })).toMatchObject({ donateId: 'don_live' });
  expect(await findSharedCreator({ platform: 'twitch', channel: 'nobody' }, { known, lives })).toBeNull();
});

test('유튜브 영상: oEmbed의 채널 이름으로 투네이션 라이브 목록에서 찾고 영상 ID를 붙인다', async () => {
  const yt = mkCreator(3, { name: '유튜버', platform: 'youtube', channel: 'UCbbbbbbbbbbbbbbbbbbbbbb', donateId: 'don_yt' });
  const lives = vi.fn(async () => page([yt]));
  const fetchJson = vi.fn(async () => ({ author_name: '유튜버' }));
  const c = await findSharedCreator({ platform: 'youtube', videoId: 'abcdefghijk' }, { known: [], lives, fetchJson });
  expect(c).toMatchObject({ donateId: 'don_yt', videoId: 'abcdefghijk' });
  expect(lives).toHaveBeenCalledWith(expect.objectContaining({ q: '유튜버', platform: 'youtube' }));
  // 못 찾으면 null (후원 대상을 짐작하지 않는다)
  expect(await findSharedCreator({ platform: 'youtube', videoId: 'zzzzzzzzzzz' }, { known: [], lives: async () => page([]), fetchJson })).toBeNull();
});
