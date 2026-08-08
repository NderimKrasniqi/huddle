import type { RosterSeat } from './host';

/**
 * Why a phone that was seated is suddenly back at the Join Screen, in the words
 * it gets shown there.
 *
 * A seat ends for reasons the phone did not cause and cannot read directly: the
 * player row is simply gone, and `players.session` answers `null` for a removed
 * player and a closed room alike. The room's roster is what tells the two apart.
 * A removal leaves the room standing — the Host who did it is still in it — so
 * the roster this phone was already watching still has people on it. A room
 * ended by its Host or expired under a quiet party takes every seat at once, so
 * the roster is empty. Both queries move on one Convex snapshot, so the roster
 * read the moment the seat vanished is the room as it was at that instant.
 *
 * There is no third reason to distinguish: the seated screen has no leave
 * control, so a seat is never given up on purpose. This is only asked once a
 * seat has actually been lost — the ordinary launch that never held one shows
 * the plain form with no notice.
 */
export function seatLossNotice(roster: readonly RosterSeat[]): string {
  return roster.length > 0
    ? 'The host removed you from the room.'
    : 'This room has closed.';
}
