import type { Creator } from '../../src/domain/types';

export const mkCreator = (n: number, over: Partial<Creator> = {}): Creator => ({
  key: `twitch:chan_${n}`,
  name: `크리에이터${n}`,
  donateId: `don${n}`,
  platform: 'twitch',
  channel: `chan_${n}`,
  source: 'manual',
  ...over,
});
