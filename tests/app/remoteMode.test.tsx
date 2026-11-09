import { render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';
import { MODE_KEY } from '../../src/app/remoteMode';
import { localFavorites } from '../../src/favorites/favorites';
import type { ToonationBridge } from '../../src/toonation/bridge';
import { quadKv } from '../helpers/quadKv';

vi.mock('../../src/players/StreamPlayer', () => ({ StreamPlayer: () => <div data-testid="player" /> }));

test('크리에이터 리모컨은 없앴다: 전환 스위치가 없고, 예전에 크리에이터 리모컨으로 두었어도 멀티뷰가 뜬다', () => {
  const kv = quadKv();
  kv.set(MODE_KEY, 'creator');
  const request = vi.fn(async () => {
    throw new Error('NOT_LOGGED_IN');
  });
  const win = { open: vi.fn(), screen: {} as Screen, location: { hash: '', href: 'http://localhost:5230/' } as Location, navigator: {} as Navigator };
  render(<App favorites={localFavorites(kv)} kv={kv} win={win} bridge={{ request } as unknown as ToonationBridge} desktop={null} quickPollMs={600000} />);
  expect(screen.queryByRole('radiogroup', { name: '리모컨 전환' })).toBeNull();
  expect(screen.queryByTitle('크리에이터 리모컨')).toBeNull();
  expect(document.querySelector('.app__body')).not.toHaveAttribute('hidden');
  expect(document.querySelectorAll('.tile').length).toBeGreaterThan(0);
});
