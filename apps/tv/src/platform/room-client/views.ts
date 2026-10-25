import type { TvViews as HostViews } from '@huddle/room-host';

import type { TvSetupView } from './index';

/** The host's setup view with the countdown's end on this TV's clock. */
export function setupView(setup: HostViews['setup']): TvSetupView | null {
  if (setup === null) return null;
  const { countdownRemainingMs, ...rest } = setup;
  return countdownRemainingMs === undefined ? rest : { ...rest, countdownEndsAt: Date.now() + countdownRemainingMs };
}

/**
 * The previous object when nothing but a clock moved, so screens and their
 * animations do not restart on every once-a-second sweep.
 */
export function stable<T>(previous: T | undefined, next: T): T {
  if (previous === undefined) return next;
  return JSON.stringify(withoutClocks(previous)) === JSON.stringify(withoutClocks(next)) ? previous : next;
}

function withoutClocks(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const { clockRemainingMs: _clock, countdownEndsAt: _countdown, ...rest } = value as Record<string, unknown>;
  return rest;
}
