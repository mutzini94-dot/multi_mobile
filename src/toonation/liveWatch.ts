import { useEffect, useRef } from 'react';
import type { Creator } from '../domain/types';

/** 이전 목록에서 꺼져 있다가 지금 켜진 방송. 처음 불러온 목록·새 즐겨찾기는 알리지 않는다. */
export function newlyLive(prev: Creator[], next: Creator[]): Creator[] {
  const wasLive = new Map(prev.map((c) => [c.key, !!c.live]));
  return next.filter((c) => c.live && wasLive.get(c.key) === false);
}

interface Options {
  minutes: number; // 0이면 자동 갱신 끔 (설정: 라이브 자동 갱신)
  active: boolean; // 연동·로그인 상태일 때만
  refresh(): void;
  creators: Creator[];
  notifyOn: boolean; // 설정: 즐겨찾기 방송 시작 알림
  notify(c: Creator): void;
}

/** 투네이션 즐겨찾기 라이브 상태를 N분마다 다시 가져오고, 방송이 새로 시작되면 알린다. */
export function useLiveWatch({ minutes, active, refresh, creators, notifyOn, notify }: Options) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    if (!active || minutes <= 0) return;
    const id = setInterval(() => refreshRef.current(), minutes * 60_000);
    return () => clearInterval(id);
  }, [minutes, active]);

  const prev = useRef<Creator[]>(creators);
  useEffect(() => {
    if (creators === prev.current) return;
    if (notifyOn) newlyLive(prev.current, creators).forEach((c) => notifyRef.current(c));
    prev.current = creators;
  }, [creators, notifyOn]);
}

/** 브라우저·설치형 앱의 데스크톱 알림 (권한이 있을 때만) */
export function showLiveNotification(c: Creator): void {
  const N = globalThis.Notification;
  if (!N || N.permission !== 'granted') return;
  new N(`${c.name} 방송 시작`, { body: c.live?.title || '', tag: `mv-live:${c.key}` });
}
