export type TvSurface = 'game' | 'runtime-status' | 'carousel' | 'room';

export type TvSurfaceInput = {
  readonly runtime: 'game' | 'paused' | 'unavailable' | 'lobby';
  readonly hasBrowsing: boolean;
};

/** Chooses the TV renderer without React, Convex, or registry state. */
export function tvSurface(input: TvSurfaceInput): TvSurface {
  if (input.runtime === 'game') return 'game';
  if (input.runtime === 'paused' || input.runtime === 'unavailable') return 'runtime-status';
  return input.hasBrowsing ? 'carousel' : 'room';
}
