export type SeatedSurface = 'game' | 'runtime-status' | 'waiting' | 'picker' | 'room';

export type SeatedSurfaceInput = {
  readonly runtime: 'game' | 'paused' | 'unavailable' | 'lobby';
  readonly youAreHost: boolean;
  readonly picking: boolean;
  readonly strandedRuntime: boolean;
  readonly hasGameToBrowse: boolean;
};

/** Selects a seated surface without React or Convex state. */
export function seatedSurface(input: SeatedSurfaceInput): SeatedSurface {
  if (input.runtime === 'game') return 'game';
  if (input.runtime === 'paused' || input.runtime === 'unavailable') return 'runtime-status';
  if (!input.youAreHost) return 'waiting';
  if (input.picking && !input.strandedRuntime && input.hasGameToBrowse) return 'picker';
  return 'room';
}
