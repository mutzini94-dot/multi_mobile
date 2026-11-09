/**
 * 유튜브 영상이 세로(쇼츠·세로 라이브)인지 API 키 없이 알아낸다.
 * 1) oar2 썸네일: 업로드한 쇼츠는 영상 방향 그대로다 (세로 1080×1920). 없으면 120×90 대체 이미지.
 * 2) hqdefault 썸네일(480×360, 라이브도 있음): 세로 영상은 양옆이 검은 여백이므로 내용 영역의 비율을 잰다.
 *    i.ytimg.com은 CORS를 허용(Access-Control-Allow-Origin: *)하므로 캔버스로 픽셀을 읽을 수 있다.
 * 알 수 없으면 null.
 */
const cache = new Map<string, Promise<boolean | null>>();

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    if (cors) img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  });
}

/**
 * 썸네일 픽셀(RGBA)에서 검은 여백을 뺀 내용 영역의 가로:세로로 판단한다.
 * 한 열(행)에 검지 않은 픽셀이 8% 이상이면 내용으로 본다. 내용 폭/높이가 0.8 미만이면 세로.
 */
export function orientationFromPixels(data: Uint8ClampedArray, w: number, h: number): boolean | null {
  const lit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return Math.max(data[i], data[i + 1], data[i + 2]) > 28;
  };
  const cols: number[] = [];
  for (let x = 0; x < w; x++) {
    let n = 0;
    for (let y = 0; y < h; y++) if (lit(x, y)) n++;
    if (n / h >= 0.08) cols.push(x);
  }
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (lit(x, y)) n++;
    if (n / w >= 0.08) rows.push(y);
  }
  if (!cols.length || !rows.length) return null;
  const cw = cols[cols.length - 1] - cols[0] + 1;
  const ch = rows[rows.length - 1] - rows[0] + 1;
  return cw / ch < 0.8;
}

async function detect(videoId: string): Promise<boolean | null> {
  const oar = await loadImage(`https://i.ytimg.com/vi/${videoId}/oar2.jpg`, false);
  if (oar && oar.naturalWidth > 120 && oar.naturalHeight > 90) return oar.naturalHeight > oar.naturalWidth; // 쇼츠
  // 라이브 썸네일은 시간이 지나면 바뀌고, CORS 없이 캐시된 사본은 캔버스로 읽을 수 없어 매번 새로 받는다
  const hq = await loadImage(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg?mv=${Date.now()}`, true);
  if (!hq || !hq.naturalWidth) return null;
  try {
    const w = 96;
    const h = Math.round((w * hq.naturalHeight) / hq.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(hq, 0, 0, w, h);
    return orientationFromPixels(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch {
    return null; // 캔버스를 읽지 못함
  }
}

export function detectVertical(videoId: string): Promise<boolean | null> {
  if (!ID_RE.test(videoId) || typeof Image === 'undefined') return Promise.resolve(null);
  let p = cache.get(videoId);
  if (!p) {
    p = detect(videoId);
    cache.set(videoId, p);
  }
  return p;
}
