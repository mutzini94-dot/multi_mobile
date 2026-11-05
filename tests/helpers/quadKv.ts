import { SETTINGS_KEY } from '../../src/settings/settings';
import { safeStorage, type KV } from '../../src/storage/safeStorage';

/** 4분할로 시작하는 저장소: 기본 레이아웃(큰 화면+1)이 아닌 4칸 화면을 전제로 한 테스트용 */
export function quadKv(): KV {
  const kv = safeStorage(undefined);
  kv.set(SETTINGS_KEY, JSON.stringify({ defaultLayout: 'quad' }));
  return kv;
}
