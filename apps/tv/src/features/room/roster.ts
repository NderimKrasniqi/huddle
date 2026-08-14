import { ROOM_PLAYER_CAP } from '@huddle/domain';
import type { RosterSeat } from '../../models';

export type { RosterSeat } from '../../models';

/** A room position, either occupied by a roster seat or still available. */
export type RoomSeat =
  | { readonly kind: 'taken'; readonly seat: RosterSeat }
  | { readonly kind: 'empty'; readonly number: number };

/** Return the fixed-capacity room roster with available positions included. */
export function roomSeats(roster: readonly RosterSeat[]): readonly RoomSeat[] {
  const taken = roster.map((seat): RoomSeat => ({ kind: 'taken', seat }));
  const empty = Array.from(
    { length: Math.max(ROOM_PLAYER_CAP - roster.length, 0) },
    (_unused, position): RoomSeat => ({ kind: 'empty', number: roster.length + position + 1 }),
  );

  return [...taken, ...empty];
}

/** The semantic status associated with a roster seat. */
export type SeatSlot = 'justJoined' | 'host' | 'away' | 'present';

export function seatSlot(seated: RosterSeat, greeting: boolean): SeatSlot {
  if (greeting) {
    return 'justJoined';
  }

  if (seated.host) {
    return 'host';
  }

  return seated.away ? 'away' : 'present';
}

const SPOKEN_SLOT: Readonly<Record<SeatSlot, string>> = {
  justJoined: 'just joined',
  host: 'host',
  present: 'online',
  away: 'away',
};

/** Return the accessible semantic description of a roster seat. */
export function seatSpokenAs(seated: RosterSeat, greeting: boolean): string {
  return `${seated.nickname}, ${SPOKEN_SLOT[seatSlot(seated, greeting)]}`;
}

export type RoomCountLine = {
  readonly joined: number;
  readonly total: number;
  readonly note: string | undefined;
};

/** Return the room count and the only state-dependent note it needs. */
export function roomCountLine(
  joined: number,
  hostNickname: string | undefined,
): RoomCountLine {
  const note =
    joined === 0
      ? 'waiting for players…'
      : hostNickname === undefined
        ? undefined
        : `${hostNickname} can start whenever`;

  return { joined, total: ROOM_PLAYER_CAP, note };
}
