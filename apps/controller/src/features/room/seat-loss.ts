import type { RosterSeat } from '../../models';

/**
 * Why a phone that was seated is suddenly back at the Join Screen, in the words
 * it gets shown there.
 *
 * A seat ends for reasons the phone did not cause and cannot read directly: the
 * player row is simply gone, and `players.session` answers `null` for a removed
 * player and a closed room alike. The room's roster is what tells the two apart.
 * A removal leaves the room standing — the Host who did it is still in it — so
 * the roster this phone was already watching still has people on it. A room
 * ended by expiry takes every seat at once, so the roster is empty. Both queries
 * move on one Convex snapshot, so the roster read the moment the seat vanished
 * is the room as it was at that instant.
 *
 * **There is now a third reason, and it is the one this must never speak for.**
 * This module used to say outright that a seat is never given up on purpose,
 * because the seated screen had no leave control. It has one now. A phone that
 * tapped Leave knows exactly why it is back at the form, and telling it "the
 * host removed you" would be false — worse than saying nothing, because it
 * invents a slight.
 *
 * That case does not reach here at all, and the shape is deliberate: the phone
 * that leaves clears its own session and returns to the form itself, so this is
 * only ever asked about a seat that vanished *without this phone asking*. The
 * guard is at the call site rather than in a parameter here, because a
 * `wasDeliberate` argument would mean this function could be asked the one
 * question it has no answer for.
 */
export function seatLossNotice(roster: readonly RosterSeat[]): string {
  return roster.length > 0
    ? 'The host removed you from the room.'
    : 'This room has closed.';
}
