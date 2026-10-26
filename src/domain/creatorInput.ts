import { creatorKey, type Creator, type Platform } from './types';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface CreatorInput {
  name: string;
  donateId: string;
  platform: Platform;
  channel: string;
}

export const DONATE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const YOUTUBE_CHANNEL_RE = /^UC[A-Za-z0-9_-]{22}$/;
const TWITCH_LOGIN_RE = /^[a-z0-9_]{4,25}$/;

const fail = (error: string): Result<never> => ({ ok: false, error });

/** URL처럼 보이면 경로 조각 배열을, 아니면 null을 돌려준다. */
function urlSegments(input: string, host: string): string[] | null {
  if (!input.includes(host)) return null;
  try {
    const url = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
    return url.pathname.split('/').filter(Boolean);
  } catch {
    return null;
  }
}

export function normalizeChannel(platform: Platform, input: string): Result<string> {
  const raw = input.trim();
  if (platform === 'youtube') {
    const segs = urlSegments(raw, 'youtube.com');
    const candidate = segs ? (segs[0] === 'channel' ? segs[1] ?? '' : '') : raw;
    return YOUTUBE_CHANNEL_RE.test(candidate)
      ? { ok: true, value: candidate }
      : fail('유튜브는 채널 ID(UC로 시작)를 입력해 주세요');
  }
  if (platform === 'twitch') {
    const segs = urlSegments(raw, 'twitch.tv');
    const candidate = (segs ? segs[0] ?? '' : raw).toLowerCase();
    return TWITCH_LOGIN_RE.test(candidate)
      ? { ok: true, value: candidate }
      : fail('트위치 아이디를 확인해 주세요 (영문·숫자·_ 4~25자)');
  }
  return fail('지원하지 않는 플랫폼입니다');
}

export function normalizeDonateId(input: string): Result<string> {
  const raw = input.trim();
  const segs = urlSegments(raw, 'toon.at');
  const candidate = segs ? (segs[0] === 'donate' ? segs[1] ?? '' : '') : raw;
  return DONATE_ID_RE.test(candidate)
    ? { ok: true, value: candidate }
    : fail('투네이션 후원 아이디를 확인해 주세요');
}

export function makeCreator(input: CreatorInput, source: Creator['source']): Result<Creator> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1 || name.length > 30) return fail('이름은 1~30자로 입력해 주세요');
  if (input.platform !== 'youtube' && input.platform !== 'twitch') return fail('지원하지 않는 플랫폼입니다');
  const channel = normalizeChannel(input.platform, String(input.channel ?? ''));
  if (!channel.ok) return channel;
  const donateId = normalizeDonateId(String(input.donateId ?? ''));
  if (!donateId.ok) return donateId;
  return {
    ok: true,
    value: {
      key: creatorKey(input.platform, channel.value),
      name,
      donateId: donateId.value,
      platform: input.platform,
      channel: channel.value,
      source,
    },
  };
}
