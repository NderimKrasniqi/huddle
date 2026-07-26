import { ROOM_PLAYER_CAP } from '@huddle/game-core';

/**
 * The pairing screen's roster: how many seats it draws, how wide they lie, and
 * what the line under them says.
 *
 * It sits beside the screen rather than inside it because it is the part of the
 * roster that can be checked without a television — the seats have to fit the
 * stage at a full room, and the count has to read correctly at nought, one and
 * ten players.
 */

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
} as const;

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
