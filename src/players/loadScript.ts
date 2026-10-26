const loaded = new Map<string, Promise<void>>();

/** 같은 src는 한 번만 로드한다. */
export function loadScript(src: string): Promise<void> {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        loaded.delete(src);
        reject(new Error(`스크립트 로드 실패: ${src}`));
      };
      document.head.appendChild(el);
    });
    loaded.set(src, p);
  }
  return p;
}
