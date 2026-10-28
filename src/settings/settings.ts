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
  videoClick: 'select' | 'player'; // 영상 클릭: 칸 선택(끌기 가능) / 플레이어 재생·정지
  soundMode: 'single' | 'mix'; // 선택한 칸만 소리 / 여러 칸 동시 듣기(칸별 볼륨)
  masterVolume: number; // 0~100
  donateMode: 'last' | 'modal' | 'pip'; // 후원창 기본 모드 (설치형)
  quickAmounts: number[]; // 빠른 후원 금액 (설치형)
  liveRefreshMinutes: 0 | 1 | 3 | 5 | 10; // 즐겨찾기 라이브 자동 갱신 간격 (0 = 끔)
  liveNotify: boolean; // 즐겨찾기 방송 시작 알림
  theme: 'system' | 'light' | 'dark';
  shortcuts: boolean; // 1~4 칸 선택 · M 소리 · F 전체 화면 · D 후원
  alwaysOnTop: boolean; // 창 항상 위 (설치형)
}

export const SETTINGS_KEY = 'mv.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  restoreLastView: true,
  defaultLayout: 'quad',
  hiddenSlotPlayback: 'keep',
  lowQualityOthers: false,
  autoReplaceEnded: false,
  videoClick: 'select',
  soundMode: 'single',
  masterVolume: 100,
  donateMode: 'last',
  quickAmounts: [1000, 5000, 10000],
  liveRefreshMinutes: 0,
  liveNotify: false,
  theme: 'system',
  shortcuts: true,
  alwaysOnTop: false,
};

const oneOf = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

export const LIVE_REFRESH_OPTIONS = [0, 1, 3, 5, 10] as const;
export const MAX_QUICK_AMOUNTS = 6;

/** 1~10,000,000 사이 정수만, 중복 제거, 최대 6개 */
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
    videoClick: oneOf(r.videoClick, ['select', 'player'] as const, d.videoClick),
    soundMode: oneOf(r.soundMode, ['single', 'mix'] as const, d.soundMode),
    masterVolume: typeof vol === 'number' && Number.isFinite(vol) && vol >= 0 && vol <= 100 ? Math.round(vol) : d.masterVolume,
    donateMode: oneOf(r.donateMode, ['last', 'modal', 'pip'] as const, d.donateMode),
    quickAmounts: r.quickAmounts === undefined ? d.quickAmounts : cleanAmounts(r.quickAmounts),
    liveRefreshMinutes: oneOf(r.liveRefreshMinutes, LIVE_REFRESH_OPTIONS, d.liveRefreshMinutes),
    liveNotify: bool(r.liveNotify, d.liveNotify),
    theme: oneOf(r.theme, ['system', 'light', 'dark'] as const, d.theme),
    shortcuts: bool(r.shortcuts, d.shortcuts),
    alwaysOnTop: bool(r.alwaysOnTop, d.alwaysOnTop),
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
