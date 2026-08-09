import type { RosterSeat } from './roster';

/**
 * "JUST JOINED!", as logic: which seats this television watched being taken.
 *
 * The handoff holds the treatment for about four seconds after a player lands
 * (its avatar pop-in) and then lets it settle, so the news is a fact about
 * *this screen's* last few seconds rather than anything the room holds. It is
 * worked out here, from the roster snapshots the subscription pushes, rather
 * than asked of the backend: the room has no reason to remember when a seat was
 * taken, and a `joinedAt` on the wire would be a server timestamp compared
 * against a television's own clock, which nothing in Huddle keeps in step.
 *
 * It is back on the seats it was written for. Boardwalk's television left the
 * pairing screen at the first join, which made a taken seat unreachable and
 * moved these four seconds onto the carousel's footer line — one greeting at a
 * time, on the one screen that had no seats. Soft Minimal's Room keeps the
 * roster up for as long as the room is between games, so the treatment goes
 * back where the handoff hangs it: on the arriving player's own avatar, which
 * also means two phones landing together are both greeted rather than the
 * newer one taking the older one's sentence.
 *
 * There is no clock here, for the same kind of reason there is no timestamp. The
 * four seconds are counted by whatever is drawing them; all this has to answer
 * is whether a seat *appeared* — whether the screen watched somebody take it, or
 * merely found them sitting there. A seat already taken when the screen started
 * watching is news to nobody: a relaunched app has not just seen ten people walk
 * in, and a room coming back from a game has not either.
 */

/** How long an arrival is greeted in pink: the handoff's "~4s". */
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

/**
 * Whether this seat is being greeted right now: an arrival whose four seconds
 * this screen has not already spent.
 *
 * The second half is the whole difference between a greeting and an
 * announcement of nothing, because being an Arrival is permanent and a greeting
 * is not. The four seconds cannot be counted by whatever is drawing them alone
 * — the Room is unmounted for the length of a game and mounted again when it
 * ends, so a mount would re-announce everybody who joined before the game, and
 * again on any blink that flashes the lobby. That is exactly the case the
 * paragraph above already refuses for an arrival: "a room coming back from a
 * game has not [seen ten people walk in] either."
 *
 * Which arrivals have been greeted is therefore held by the screen, above the
 * switch between the Room and a game, and passed in.
 *
 * `undefined` is the moment before the first roster lands, which greets nobody:
 * a screen that has not been told who is here has watched nobody arrive.
 */
export function isGreeting(
  seen: Arrivals | undefined,
  greeted: ReadonlySet<RosterSeat['playerId']>,
  playerId: RosterSeat['playerId'],
): boolean {
  return seen !== undefined && isArrival(seen, playerId) && !greeted.has(playerId);
}

/** Whether two sets hold the same players. */
function sameSet(
  one: ReadonlySet<RosterSeat['playerId']>,
  other: ReadonlySet<RosterSeat['playerId']>,
): boolean {
  return one.size === other.size && [...one].every((playerId) => other.has(playerId));
}
