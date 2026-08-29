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

  it('keeps the room invitation until browsing begins, even with a draft', () => {
    expect(tvSurface({ runtime: 'lobby', hasBrowsing: false, hasSetup: true })).toBe('room');
  });

  it('keeps a restored running room off the lobby while its game query is pending', () => {
    expect(tvSurface({
      runtime: 'lobby',
      hasBrowsing: false,
      runningPending: true,
      hasRunningGame: true,
    })).toBe('runtime-status');
  });
});
