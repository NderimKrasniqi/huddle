import type { RosterSeat } from '../../models';

export function seatLossNotice(roster: readonly RosterSeat[]): string {
  return roster.length > 0
    ? 'The host removed you from the room.'
    : 'This room has closed.';
}
