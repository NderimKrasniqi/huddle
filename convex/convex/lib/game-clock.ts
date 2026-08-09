import type { GameDeadline } from '@huddle/game-core';

import type { Id } from '../_generated/dataModel';

/** A scheduler clock kept alongside the room's game document. */
export type RoomClock = {
  readonly deadline?: Id<'_scheduled_functions'>;
  readonly deadlineAt?: number;
};

/** Normalize a remaining duration without allowing a negative pause. */
export function remainingMs(deadlineAt: number | undefined, now: number): number | undefined {
  return deadlineAt === undefined ? undefined : Math.max(0, deadlineAt - now);
}

/** Validate the time fields before they reach a Convex scheduler. */
export function isValidDeadline(deadline: GameDeadline | undefined): deadline is GameDeadline {
  return (
    deadline !== undefined &&
    typeof deadline.beat === 'string' &&
    deadline.beat.length > 0 &&
    Number.isFinite(deadline.afterMs) &&
    deadline.afterMs >= 0
  );
}
