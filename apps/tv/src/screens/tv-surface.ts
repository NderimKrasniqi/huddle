export type TvSurface = 'game' | 'runtime-status' | 'setup' | 'carousel' | 'room';

export type TvSurfaceInput = {
  readonly runtime: 'game' | 'finished' | 'paused' | 'unavailable' | 'lobby';
  readonly hasBrowsing: boolean;
  readonly hasSetup?: boolean;
};

/** Chooses the TV renderer without React, Convex, or registry state. */
export function tvSurface(input: TvSurfaceInput): TvSurface {
  if (input.runtime === 'game' || input.runtime === 'finished') return 'game';
  if (input.runtime === 'paused' || input.runtime === 'unavailable') return 'runtime-status';
  if (input.hasSetup) return 'setup';
  return input.hasBrowsing ? 'carousel' : 'room';
}
