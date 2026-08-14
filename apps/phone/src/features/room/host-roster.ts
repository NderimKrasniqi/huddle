import type { RosterSeat } from '../../models';

/** Semantic status values for a phone roster row. */
export type RosterRowSlot = 'host' | 'just-joined' | 'present' | 'away';

/** Resolve a roster row's status, keeping Host ownership authoritative. */
export function rosterRowSlot(seat: RosterSeat, greeting = false): RosterRowSlot {
  if (seat.host) {
    return 'host';
  }

  if (greeting) {
    return 'just-joined';
  }

  return seat.away ? 'away' : 'present';
}

const SPOKEN_SLOT: Readonly<Record<RosterRowSlot, string>> = {
  host: 'host',
  'just-joined': 'just joined',
  present: 'online',
  away: 'away',
};

/** Return the accessible semantic description of a roster row. */
export function rosterRowSpokenAs(seat: RosterSeat, greeting = false): string {
  return `${seat.nickname}, ${SPOKEN_SLOT[rosterRowSlot(seat, greeting)]}`;
}

/** Return the room count and, when applicable, the start-status note. */
export function rosterFooterLine(joined: number, canStart: boolean): string {
  const count = `${joined} ${joined === 1 ? 'player' : 'players'} in`;

  return canStart ? `${count} — you can start anytime` : count;
}
