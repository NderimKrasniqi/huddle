/**
 * Presence: how a room tells a phone that is still there from one that has gone
 * quiet.
 *
 * Both numbers live here because both sides keep one. The Phone beats
 * every `HEARTBEAT_INTERVAL_MS` for as long as it is in front of its owner, and
 * the room calls a player Away once it has heard nothing for `AWAY_AFTER_MS`.
 * Neither means anything without the other — the gap between them is the room's
 * tolerance for a beat that was late or lost — so they are pinned together, in
 * the one package both sides import.
 */

/**
 * How often a foregrounded Phone says it is still there.
 *
 * Short enough that `AWAY_AFTER_MS` can absorb a run of lost beats without
 * calling somebody away who is sitting right in front of the television, and
 * long enough that a full room costs the backend a handful of mutations a
 * second — docs/project-scope.md budgets roughly ten rooms, not thousands.
 */
export const HEARTBEAT_INTERVAL_MS = 3_000;

/**
 * Silence after which the room calls a player Away.
 *
 * The scope's rule is that a phone backgrounded for 10 seconds is marked away
 * within a further 5, and this number is what makes both halves true. A phone
 * goes quiet at some moment *between* two beats, so the room acts somewhere
 * between `AWAY_AFTER_MS - HEARTBEAT_INTERVAL_MS` and `AWAY_AFTER_MS` after its
 * owner walked off:
 *
 * - never premature, because the earlier end of that window is the 10 seconds
 *   the scope allows a player to be gone before anybody says so;
 * - never late, because the later end is inside the 15 seconds the scope gives
 *   the room to notice, with a couple of seconds spare for the scheduled check
 *   and the push to the TV.
 *
 * `presence.test.ts` holds both bounds to those sentences, so the promise is
 * checkable without a phone and a stopwatch.
 */
export const AWAY_AFTER_MS = 13_000;
