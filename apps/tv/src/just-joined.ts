import type { RosterSeat } from './roster';

/**
 * "JUST JOINED!", as logic: which seats this television watched being taken.
 *
 * The handoff holds the treatment for about four seconds after a player lands
 * (its avatar pop-in) and then lets the seat settle, so the news is a fact about
 * *this screen's* last few seconds rather than anything the room holds. It is
 * worked out here, from the roster snapshots the subscription pushes, rather
 * than asked of the backend: the room has no reason to remember when a seat was
 * taken, and a `joinedAt` on the wire would be a server timestamp compared
 * against a television's own clock, which nothing in Huddle keeps in step.
 *
 * There is no clock here either, for the same kind of reason. The four seconds
 * are counted by the seat that is drawing them (`PlayerSeat`), from the moment
 * it appears; all this has to answer is whether a seat *appeared* — whether the
 * screen watched somebody take it, or merely found them sitting there. A seat
 * already taken when the screen started watching is news to nobody: a relaunched
 * app has not just seen ten people walk in, and a room coming back from a game
 * has not either.
 */

/** How long a new seat carries the pink treatment: the handoff's "~4s". */
export const JUST_JOINED_MS = 4_000;

/**
 * Who this screen has drawn, and which of them it watched arrive.
 *
 * Both are pruned to the roster they were folded from, which keeps them the size
 * of a room and makes a seat that goes and comes back an arrival all over again.
 */
export type Arrivals = {
  /** Everybody seated as of the last snapshot. */
  readonly seated: ReadonlySet<RosterSeat['playerId']>;
  /** Those of them who took their seat while this screen was watching. */
  readonly arrived: ReadonlySet<RosterSeat['playerId']>;
};

/**
 * The roster as it now stands, folded into what this screen has already seen.
 * Pass `undefined` for the first snapshot, which is the baseline — everyone on
 * it was simply found there.
 *
 * Returns what it was given, identically, whenever the snapshot seats nobody and
 * empties no seat, which most of them do: claiming a color and going away both
 * push a fresh roster. The screen folds this during render and stores the
 * result, so the unchanged answer being the *same* answer is what makes that
 * settle rather than loop.
 */
export function noteArrivals(seen: Arrivals | undefined, roster: readonly RosterSeat[]): Arrivals {
  const seated = new Set(roster.map(({ playerId }) => playerId));

  if (seen === undefined) {
    return { seated, arrived: new Set() };
  }

  const arrived = new Set(
    [...seated].filter((playerId) => !seen.seated.has(playerId) || seen.arrived.has(playerId)),
  );

  return sameSet(seen.seated, seated) && sameSet(seen.arrived, arrived)
    ? seen
    : { seated, arrived };
}

/** Whether this screen watched the player take the seat it is drawing. */
export function isArrival(seen: Arrivals, playerId: RosterSeat['playerId']): boolean {
  return seen.arrived.has(playerId);
}

/** Whether two sets hold the same players. */
function sameSet(
  one: ReadonlySet<RosterSeat['playerId']>,
  other: ReadonlySet<RosterSeat['playerId']>,
): boolean {
  return one.size === other.size && [...one].every((playerId) => other.has(playerId));
}
