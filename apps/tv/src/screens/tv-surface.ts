export type TvSurface = 'game' | 'runtime-status' | 'setup' | 'carousel' | 'room';

export type TvSurfaceInput = {
  readonly runtime: 'game' | 'finished' | 'paused' | 'unavailable' | 'lobby';
  readonly hasBrowsing: boolean;
  readonly hasSetup?: boolean;
  /** A restored room must not flash its lobby while its running query is pending. */
  readonly runningPending?: boolean;
  readonly hasRunningGame?: boolean;
};

/** Chooses the TV renderer without React, Convex, or registry state. */
export function tvSurface(input: TvSurfaceInput): TvSurface {
  if (input.runtime === 'game' || input.runtime === 'finished') return 'game';
  if (input.runtime === 'paused' || input.runtime === 'unavailable') return 'runtime-status';
  if (input.runningPending === true && input.hasRunningGame === true) return 'runtime-status';
  // A setup projection is useful only after the Host has begun browsing. Keep
  // the invitation authoritative while the browse subscription is unresolved
  // (or a legacy room has a draft without a browse index).
  if (!input.hasBrowsing) return 'room';
  if (input.hasSetup) return 'setup';
  return 'carousel';
}
