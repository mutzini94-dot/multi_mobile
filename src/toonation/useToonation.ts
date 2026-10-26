import { useCallback, useEffect, useRef, useState } from 'react';
import type { Creator } from '../domain/types';
import { favoritesFromToonation, type ToonationAccount, type ToonationBridge, type ToonationFavorite } from './bridge';

export type ToonationStatus = 'idle' | 'checking' | 'no-extension' | 'logged-out' | 'waiting-login' | 'loading' | 'ready' | 'error';

export interface ToonationState {
  status: ToonationStatus;
  account: ToonationAccount | null;
  creators: Creator[];
  error?: string;
}

interface Options {
  pollMs?: number; // 로그인 창을 연 뒤 상태 확인 간격
  maxWaitMs?: number; // 로그인 대기 최대 시간
}

const IDLE: ToonationState = { status: 'idle', account: null, creators: [] };

/** 연동 확장을 통해 투네이션 계정과 즐겨찾기를 가져온다. */
export function useToonation(bridge: ToonationBridge, { pollMs = 2000, maxWaitMs = 180000 }: Options = {}) {
  const [state, setState] = useState<ToonationState>(IDLE);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopPolling();
    };
  }, []);

  const set = (s: ToonationState) => alive.current && setState(s);

  const loadFavorites = useCallback(async (account: ToonationAccount) => {
    set({ status: 'loading', account, creators: [] });
    try {
      const list = await bridgeRef.current.request<ToonationFavorite[]>('favorites');
      set({ status: 'ready', account, creators: favoritesFromToonation(list) });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'NOT_LOGGED_IN') set({ status: 'logged-out', account: null, creators: [] });
      else set({ status: 'error', account, creators: [], error: msg });
    }
  }, []);

  /** 확장 설치·로그인 여부를 확인하고, 로그인 상태면 즐겨찾기를 불러온다. */
  const refresh = useCallback(async () => {
    stopPolling();
    set({ ...IDLE, status: 'checking' });
    let account: ToonationAccount | null;
    try {
      account = (await bridgeRef.current.request<{ account: ToonationAccount | null }>('status')).account;
    } catch (e) {
      const msg = (e as Error).message;
      set(msg === 'NO_EXTENSION' ? { ...IDLE, status: 'no-extension' } : { ...IDLE, status: 'error', error: msg });
      return;
    }
    if (!account) set({ ...IDLE, status: 'logged-out' });
    else await loadFavorites(account);
  }, [loadFavorites]);

  /** 공식 로그인 창을 열고, 로그인이 감지될 때까지 상태를 확인한다. */
  const login = useCallback(async () => {
    stopPolling();
    try {
      await bridgeRef.current.request('login');
    } catch (e) {
      const msg = (e as Error).message;
      set(msg === 'NO_EXTENSION' ? { ...IDLE, status: 'no-extension' } : { ...IDLE, status: 'error', error: msg });
      return;
    }
    set({ ...IDLE, status: 'waiting-login' });
    const started = Date.now();
    let busy = false;
    pollRef.current = setInterval(async () => {
      if (busy) return;
      if (Date.now() - started >= maxWaitMs) {
        stopPolling();
        set({ ...IDLE, status: 'logged-out' });
        return;
      }
      busy = true;
      try {
        const { account } = await bridgeRef.current.request<{ account: ToonationAccount | null }>('status');
        if (account && pollRef.current) {
          stopPolling();
          await loadFavorites(account);
        }
      } catch {
        // 다음 주기에 다시 확인
      } finally {
        busy = false;
      }
    }, pollMs);
  }, [loadFavorites, pollMs, maxWaitMs]);

  return { state, refresh, login };
}
