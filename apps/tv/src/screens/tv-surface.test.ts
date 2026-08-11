import { describe, expect, it } from 'vitest';

import { tvSurface } from './tv-surface';

describe('TV surface', () => {
  it('renders a decoded game before lobby surfaces', () => {
    expect(tvSurface({ runtime: 'game', hasBrowsing: true })).toBe('game');
  });

  it('keeps a finished game on the module surface for its results screen', () => {
    expect(tvSurface({ runtime: 'finished', hasBrowsing: true })).toBe('game');
  });

  it.each(['paused', 'unavailable'] as const)('fails closed for a %s runtime', (runtime) => {
    expect(tvSurface({ runtime, hasBrowsing: true })).toBe('runtime-status');
  });

  it('shows the room until a host browses', () => {
    expect(tvSurface({ runtime: 'lobby', hasBrowsing: false })).toBe('room');
  });

  it('shows the carousel once browsing exists', () => {
    expect(tvSurface({ runtime: 'lobby', hasBrowsing: true })).toBe('carousel');
  });
});
