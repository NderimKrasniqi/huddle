import type { api } from '@huddle/convex';
import { ROOM_PLAYER_CAP } from '@huddle/game-core';
import type { FunctionReturnType } from 'convex/server';

/**
 * The pairing screen's roster: how many seats it draws, how wide they lie, what
 * each one has to say, and what the line under them reads.
 *
 * It sits beside the screen rather than inside it because it is the part of the
 * roster that can be checked without a television — the seats have to fit the
 * stage at a full room, and the count has to read correctly at nought, one and
 * ten players.
 */

/**
 * One taken seat, taken from the query that serves it — the TV draws what the
 * backend says a seat is, and never its own idea of one.
 */
export type RosterSeat = FunctionReturnType<typeof api.players.roster>[number];

/**
 * Seat measurements, per the handoff's pairing footer ("4 dashed avatar circles
 * (72px)"). The name label under a seat is Boardwalk's smallest TV body size,
 * and its line is reserved whether or not a player is sitting there — a seat
 * that grew when someone joined would nudge the whole screen upward mid-party.
 */
export const seat = {
  /** The avatar circle's diameter. */
  size: 72,
  /** Space between seats. */
  gap: 16,
  /** Space between the circle and the nickname under it. */
  nameGap: 8,
  /** The nickname's reserved line. */
  nameLine: 22,
  /**
   * The presence dot's diameter, sitting on the avatar's lower-right (the
   * handoff's green online dot). Eighteen leaves a 12px core inside Boardwalk's
   * 3px ink border — the size the phone's own status dot is drawn at.
   */
  statusDot: 18,
  /** How far the dot is tucked in from the seat's corner, onto the circle's edge. */
  statusInset: 2,
} as const;

/**
 * The news a seat carries, over and above the player sitting in it: they have
 * this second arrived, or they are the one running the room.
 *
 * One channel rather than two, because a 72px circle has one thing to say at a
 * time and both of these are stand-ins for a pill the §3 lobby card will draw
 * properly (docs/design/design-handoff.md). The screen decides what each looks
 * like; the choice between them is here, where it can be checked.
 */
export type SeatHighlight = 'justJoined' | 'host';

/**
 * What this player's seat has to say right now.
 *
 * An arrival comes first. The room's first player is the Host and a new arrival
 * at the same moment, and for those four seconds the news is that somebody is
 * here at all — they are still the Host when the pink settles, and by then
 * nothing else is competing for the circle.
 */
export function seatHighlight(player: RosterSeat, justJoined: boolean): SeatHighlight | undefined {
  if (justJoined) {
    return 'justJoined';
  }

  return player.host ? 'host' : undefined;
}

/**
 * Empty seats the footer keeps drawing while the room is nearly empty — the
 * handoff's four dashed circles, which say "there is room for you" better than
 * any sentence could.
 */
const MIN_SEATS = 4;

/** How many seats the footer draws for `joined` players: one each, never fewer than four. */
export function footerSeatCount(joined: number): number {
  return Math.max(joined, MIN_SEATS);
}

/** How wide a row of `count` seats lies at the TV's design size. */
export function footerSeatsWidth(count: number): number {
  return count * seat.size + Math.max(count - 1, 0) * seat.gap;
}

/**
 * The line under the seats.
 *
 * The handoff writes the empty room's copy in full — "0 of 10 joined — waiting
 * for players…" — and once somebody is in, the count carries the line alone:
 * the waiting half has stopped being the news (at ten players it is plainly
 * false), and the seats it shares a row with have claimed the width it used.
 */
export function rosterFooterText(joined: number): string {
  const count = `${joined} of ${ROOM_PLAYER_CAP} joined`;
  return joined === 0 ? `${count} — waiting for players…` : count;
}
