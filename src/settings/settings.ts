import { useCallback, useState } from 'react';
import type { LayoutKind } from '../domain/types';
import { LAYOUTS } from '../layout/layouts';
import type { KV } from '../storage/safeStorage';

/** 설정 (설정 창). 설치형 창 관련(항상 위)은 앱에도 전달된다. */
export interface Settings {
  restoreLastView: boolean; // 시작 시 마지막 화면(레이아웃·칸·크기) 복원
  defaultLayout: LayoutKind; // 복원하지 않을 때 시작 레이아웃
  hiddenSlotPlayback: 'keep' | 'pause'; // 레이아웃에서 숨긴 칸: 계속 재생 / 정지
  lowQualityOthers: boolean; // 선택하지 않은 칸은 낮은 화질 (트위치만)
  autoReplaceEnded: boolean; // 방송이 끝나면 라이브 중인 투네이션 즐겨찾기로 자동으로 바꾸기
  showLiveInfo: boolean; // 칸 위쪽 바에 방송 제목·시청자 수·방송한 시간
  videoClick: 'select' | 'player'; // 영상 클릭: 칸 선택(끌기 가능) / 플레이어 재생·정지
  soundMode: 'single' | 'mix'; // 선택한 칸만 소리 / 여러 칸 동시 듣기(칸별 볼륨)
  masterVolume: number; // 0~100
  donateMode: 'last' | 'modal' | 'pip'; // 후원창 기본 모드 (설치형)
  quickAmounts: number[]; // 빠른 후원 금액 (설치형)
  quickMessages: string[]; // 자주 쓰는 후원 메시지 (설치형)
  monthlyLimit: number; // 월 후원 한도 (원, 0이면 끔): 이번 달 합계가 넘으면 후원 전에 한 번 더 확인
  monthlyGoal: number; // 월 후원 목표 (원, 0이면 끔): 목표의 80%·100%에 이르면 알림
  liveRefreshMinutes: 0 | 1 | 3 | 5 | 10; // 즐겨찾기 라이브 자동 갱신 간격 (0 = 끔)
  liveNotify: boolean; // 즐겨찾기 방송 시작 알림
  theme: 'system' | 'light' | 'dark';
  skin: Skin; // 화면 스킨 (색·모서리·버튼 모양). 배치와 기능은 같다
  shortcuts: boolean; // 1~4 칸 선택 · M 소리 · F 전체 화면 · D 후원
  alwaysOnTop: boolean; // 창 항상 위 (설치형)
  quickPanel: 'left' | 'right' | 'off'; // 퀵패널 (즐겨찾기·최근 본 크리에이터) 위치
}

export type Skin = 'classic' | 'breeze';
/** 스킨 목록: 기본 = 지금까지의 모양, 브리즈 = 슬레이트 중립색·둥근 판·파랑→청록 포인트 (라이트 테마에서 색까지, 다크에서는 모양만) */
export const SKINS: { id: Skin; label: string; hint: string }[] = [
  { id: 'classic', label: '기본', hint: '투네이션 기본 모양' },
  { id: 'breeze', label: '브리즈', hint: '산뜻한 슬레이트 · 둥근 판 · 파랑→청록 포인트' },
];

export const SETTINGS_KEY = 'mv.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  restoreLastView: true,
  defaultLayout: 'wideSide', // 큰 화면(방송) + 오른쪽 후원 페이지
  hiddenSlotPlayback: 'pause', // 가볍게: 숨긴 칸은 정지
  lowQualityOthers: true, // 가볍게: 선택하지 않은 칸은 낮은 화질
  autoReplaceEnded: false,
  showLiveInfo: true,
  videoClick: 'select',
  soundMode: 'single',
  masterVolume: 100,
  donateMode: 'last',
  quickAmounts: [1000, 5000, 10000],
  quickMessages: [],
  monthlyLimit: 0,
  monthlyGoal: 0,
  liveRefreshMinutes: 0,
  liveNotify: false,
  theme: 'system',
  skin: 'breeze', // 기본 스킨: 브리즈
  shortcuts: true,
  alwaysOnTop: false,
  quickPanel: 'left',
};

const oneOf = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

export const LIVE_REFRESH_OPTIONS = [0, 1, 3, 5, 10] as const;
export const MAX_QUICK_AMOUNTS = 6;

/** 1~10,000,000 사이 정수만, 중복 제거, 최대 6개 */
/** 자주 쓰는 후원 메시지: 빈 줄을 빼고 100자까지, 최대 5개 */
export function cleanMessages(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((m): m is string => typeof m === 'string').map((m) => m.trim().slice(0, 100)).filter(Boolean))].slice(0, 5);
}

export function cleanAmounts(v: unknown): number[] {
  if (!Array.isArray(v)) return DEFAULT_SETTINGS.quickAmounts;
  const out: number[] = [];
  for (const n of v) if (Number.isInteger(n) && n >= 1 && n <= 10_000_000 && !out.includes(n)) out.push(n);
  return out.slice(0, MAX_QUICK_AMOUNTS);
}

/** 저장값을 항목별로 검증한다: 잘못된 항목만 기본값으로 */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const vol = r.masterVolume;
  return {
    restoreLastView: bool(r.restoreLastView, d.restoreLastView),
    defaultLayout: oneOf(r.defaultLayout, LAYOUTS, d.defaultLayout),
    hiddenSlotPlayback: oneOf(r.hiddenSlotPlayback, ['keep', 'pause'] as const, d.hiddenSlotPlayback),
    lowQualityOthers: bool(r.lowQualityOthers, d.lowQualityOthers),
    autoReplaceEnded: bool(r.autoReplaceEnded, d.autoReplaceEnded),
    showLiveInfo: bool(r.showLiveInfo, d.showLiveInfo),
    videoClick: oneOf(r.videoClick, ['select', 'player'] as const, d.videoClick),
    soundMode: oneOf(r.soundMode, ['single', 'mix'] as const, d.soundMode),
    masterVolume: typeof vol === 'number' && Number.isFinite(vol) && vol >= 0 && vol <= 100 ? Math.round(vol) : d.masterVolume,
    donateMode: oneOf(r.donateMode, ['last', 'modal', 'pip'] as const, d.donateMode),
    quickAmounts: r.quickAmounts === undefined ? d.quickAmounts : cleanAmounts(r.quickAmounts),
    quickMessages: cleanMessages(r.quickMessages),
    monthlyGoal: Number.isInteger(r.monthlyGoal) && (r.monthlyGoal as number) >= 0 && (r.monthlyGoal as number) <= 100_000_000 ? (r.monthlyGoal as number) : d.monthlyGoal,
    monthlyLimit: Number.isInteger(r.monthlyLimit) && (r.monthlyLimit as number) >= 0 && (r.monthlyLimit as number) <= 100_000_000 ? (r.monthlyLimit as number) : d.monthlyLimit,
    liveRefreshMinutes: oneOf(r.liveRefreshMinutes, LIVE_REFRESH_OPTIONS, d.liveRefreshMinutes),
    liveNotify: bool(r.liveNotify, d.liveNotify),
    theme: oneOf(r.theme, ['system', 'light', 'dark'] as const, d.theme),
    skin: oneOf(r.skin, ['classic', 'breeze'] as const, d.skin),
    shortcuts: bool(r.shortcuts, d.shortcuts),
    alwaysOnTop: bool(r.alwaysOnTop, d.alwaysOnTop),
    quickPanel: oneOf(r.quickPanel, ['left', 'right', 'off'] as const, d.quickPanel),
  };
}

export function loadSettings(kv: KV): Settings {
  try {
    return normalizeSettings(JSON.parse(kv.get(SETTINGS_KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(kv: KV, s: Settings): void {
  kv.set(SETTINGS_KEY, JSON.stringify(s));
}

/** 설정 읽기·바꾸기 (바꾸면 바로 저장) */
export function useSettings(kv: KV) {
  const [settings, setSettings] = useState(() => loadSettings(kv));
  const update = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((prev) => {
        const next = normalizeSettings({ ...prev, ...patch });
        saveSettings(kv, next);
        return next;
      }),
    [kv],
  );
  return [settings, update] as const;
}
