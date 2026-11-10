import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';

/**
 * 안드로이드 앱의 휴대폰 뒤로가기: handler가 true면 앱 안에서 처리한 것(전체 화면·채팅·창 닫기 등),
 * false면 앱을 뒤로 보낸다(백그라운드, 끄지 않는다). 웹(브라우저)에서는 아무 일도 하지 않는다 (브라우저는 popstate로).
 */
export function onNativeBack(handler: () => boolean): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const listener = NativeApp.addListener('backButton', () => {
    if (!handler()) void NativeApp.minimizeApp();
  });
  return () => {
    void listener.then((l) => l.remove());
  };
}
