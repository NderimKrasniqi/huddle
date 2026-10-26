export type TvSurface = 'game' | 'runtime-status' | 'setup' | 'carousel' | 'room';

type TvSurfaceInput = {
  readonly runtime: 'game' | 'finished' | 'paused' | 'unavailable' | 'lobby';
  readonly hasBrowsing: boolean;
  readonly hasSetup?: boolean;
  readonly runningPending?: boolean;
  readonly hasRunningGame?: boolean;
};

export function tvSurface(input: TvSurfaceInput): TvSurface {
  if (input.runtime === 'game' || input.runtime === 'finished') return 'game';
  if (input.runtime === 'paused' || input.runtime === 'unavailable') return 'runtime-status';
  if (input.runningPending === true && input.hasRunningGame === true) return 'runtime-status';
  if (!input.hasBrowsing) return 'room';
  if (input.hasSetup) return 'setup';
  return 'carousel';
}
