import type { TvViews as HostViews } from '@huddle/room-host';

import type { TvSetupView } from './index';

export function setupView(setup: HostViews['setup']): TvSetupView | null {
  if (setup === null) return null;
  const { countdownRemainingMs, ...rest } = setup;
  return countdownRemainingMs === undefined ? rest : { ...rest, countdownEndsAt: Date.now() + countdownRemainingMs };
}

export function stable<T>(previous: T | undefined, next: T): T {
  if (previous === undefined) return next;
  return JSON.stringify(withoutClocks(previous)) === JSON.stringify(withoutClocks(next)) ? previous : next;
}

function withoutClocks(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const { clockRemainingMs: _clock, countdownEndsAt: _countdown, ...rest } = value as Record<string, unknown>;
  return rest;
}
