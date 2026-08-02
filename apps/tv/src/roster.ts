import type { api } from '@huddle/convex';
import { ROOM_PLAYER_CAP } from '@huddle/game-core';
import type { FunctionReturnType } from 'convex/server';

/**
 * The pairing screen's roster: how many seats it draws, how wide they lie, and
 * what the line under them reads.
 *
 * It sits beside the screen rather than inside it because it is the part of the
 * roster that can be checked without a television — the seats have to fit the
 * stage at a full room, and the count has to read correctly at nought, one and
 * ten players.
 *
 * What a seat has to *say* is no longer part of it. The carousel replaces this
 * screen at the first join, so a seat with a player in it is never drawn and the
 * treatments that needed one — the claimed-color circle, the Host's tangerine
 * shadow, an arrival's punch one, the away dimming — were deleted rather than
 * kept drawing for nobody ("Delete the TV's unreachable seat code" in
 * docs/implementation-plan.md).
 */

/**
 * One taken seat, taken from the query that serves it — the TV draws what the
 * backend says a seat is, and never its own idea of one.
 */
export type RosterSeat = FunctionReturnType<typeof api.players.roster>[number];

/**
 * Seat measurements, per the handoff's pairing footer ("4 dashed avatar circles
 * (72px)"). The nickname's line is still reserved under every circle, though
 * nothing draws a nickname on this screen any more: it is part of the seat box
 * the footer was measured at, and taking it back would move the row rather than
 * tidy it (see the `seat` style in the screen).
 */
export const seat = {
  /** The avatar circle's diameter. */
  size: 72,
  /** Space between seats. */
  gap: 16,
  /** Space between the circle and the line reserved under it. */
  nameGap: 8,
  /** The reserved line under a circle. */
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
 * the waiting half is omitted.
 */
export function rosterFooterText(joined: number): string {
  const count = `${joined} of ${ROOM_PLAYER_CAP} joined`;
  return joined === 0 ? `${count} — waiting for players…` : count;
}
