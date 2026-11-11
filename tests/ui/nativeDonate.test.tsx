import { render, waitFor } from '@testing-library/react';

const plugin = vi.hoisted(() => ({ showDonate: vi.fn(async () => {}), hideDonate: vi.fn(async () => {}) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true }, registerPlugin: () => plugin }));

import { PageView } from '../../src/ui/PageView';
import { makeDonatePage } from '../../src/domain/pages';

test('안드로이드 앱: 후원 페이지는 iframe 대신 앱 웹뷰로 띄우고(자리 좌표 전달), 닫으면 내린다', async () => {
  const { container, unmount } = render(<PageView page={makeDonatePage()} url="https://toon.at/donate/abc" embed="iframe" nativeDonate />);
  expect(container.querySelector('iframe')).toBeNull();
  await waitFor(() => expect(plugin.showDonate).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://toon.at/donate/abc' })));
  unmount();
  expect(plugin.hideDonate).toHaveBeenCalled();
});
