import { describe, expect, it } from 'vitest';

import { seatedSurface, type SeatedSurfaceInput } from './seated-surface';

const lobbyHost: SeatedSurfaceInput = {
  runtime: 'lobby',
  youAreHost: true,
  picking: false,
  strandedRuntime: false,
  hasGameToBrowse: true,
};

describe('seated phone surface', () => {
  it('gives a decoded game precedence over local lobby state', () => {
    expect(seatedSurface({ ...lobbyHost, runtime: 'game', picking: true })).toBe('game');
  });

  it.each(['paused', 'unavailable'] as const)('fails closed for a %s runtime', (runtime) => {
    expect(seatedSurface({ ...lobbyHost, runtime, picking: true })).toBe('runtime-status');
  });

  it('keeps players on the waiting surface', () => {
    expect(seatedSurface({ ...lobbyHost, youAreHost: false, picking: true })).toBe('waiting');
  });

  it('opens the picker only for a host with an installed game', () => {
    expect(seatedSurface({ ...lobbyHost, picking: true })).toBe('picker');
    expect(seatedSurface({ ...lobbyHost, picking: true, hasGameToBrowse: false })).toBe('room');
  });

  it('keeps a stranded host in the recovery-capable room', () => {
    expect(seatedSurface({ ...lobbyHost, picking: true, strandedRuntime: true })).toBe('room');
  });
});
