import type { api } from '@huddle/convex';
import { ROOM_PLAYER_CAP } from '@huddle/game-core';
import type { FunctionReturnType } from 'convex/server';

/**
 * The Room screen's player grid: how the seats are laid out, what each one's
 * status slot says, and how the line under them counts the room
 * (`docs/design/reference/screens/01-room.png`).
 *
 * It sits beside the screen rather than inside it because it is the part of the
 * roster that can be checked without a television — the grid has to fit the
 * stage at a full room, the slot has an order of precedence, and the count has
 * to read correctly at nought, one and ten players.
 *
 * What a seat has to say came *back* here. Boardwalk's television left the
 * pairing screen at the first join, so a seat with a player in it was never
 * drawn and every treatment that needed one had been deleted; Soft Minimal's
 * Room keeps the code, the QR and the roster on one screen for as long as the
 * room is between games, so the seats are the surface the room's news belongs
 * on again.
 */

/**
 * One taken seat, taken from the query that serves it — the TV draws what the
 * backend says a seat is, and never its own idea of one.
 */
export type RosterSeat = FunctionReturnType<typeof api.players.roster>[number];

/**
 * Seat measurements at the TV's 1280×720 design size.
 *
 * The board draws a 6×2 grid of twelve; `ROOM_PLAYER_CAP` is ten, so the grid
 * is 5×2 — a rectangle rather than a row of six with four stragglers under it.
 * The column is wider than the circle it holds because the thing under the
 * circle is a nickname, and a name that wraps is a row of seats at two
 * different heights.
 */
export const seat = {
  /** The avatar circle's diameter — the board's disc measures 88–90. */
  avatar: 88,
  /**
   * The column a seat occupies. Sized by the widest thing that goes in it,
   * which is not the nickname — it is the `JUST JOINED!` chip. At 140 that chip
   * wrapped to two lines and pushed its own seat out of the row; a status slot
   * is one line by construction, so the column is what gives.
   */
  width: 152,
  /**
   * Space between columns. 6 rather than a round number because the *pitch* is
   * what the board fixes, at 158 — and 152 + 6 is that, which puts 70pt between
   * one disc and the next exactly as the board does. The column being wider
   * than the disc is the chip's doing, not a change of spacing.
   */
  columnGap: 6,
  /** Space between the two rows; the board's row pitch is 177. */
  rowGap: 18,
  /** Space between the circle and the nickname. */
  nameGap: 13,
  /** The nickname's line. */
  nameLine: 22,
  /** Space between the nickname and the status slot. */
  statusGap: 16,
  /** The status slot's line — a HOST label, a dot, an AWAY or JUST JOINED chip. */
  statusLine: 20,
} as const;

/** How many seats stand side by side; `ROOM_PLAYER_CAP` over two rows. */
export const SEATS_PER_ROW = 5;

/** The height of one seat: circle, nickname and status slot with their gaps. */
export const SEAT_HEIGHT =
  seat.avatar + seat.nameGap + seat.nameLine + seat.statusGap + seat.statusLine;

/** How wide a row of `SEATS_PER_ROW` seats lies at the TV's design size. */
export function roomGridWidth(): number {
  return SEATS_PER_ROW * seat.width + (SEATS_PER_ROW - 1) * seat.columnGap;
}

/** How tall the grid stands, at the two rows `ROOM_PLAYER_CAP` needs. */
export function roomGridHeight(): number {
  const rows = Math.ceil(ROOM_PLAYER_CAP / SEATS_PER_ROW);

  return rows * SEAT_HEIGHT + (rows - 1) * seat.rowGap;
}

/**
 * The Room screen's vertical stack, top to bottom.
 *
 * Every number was measured off `docs/design/reference/screens/01-room.png` as
 * that file stood before 2026-08-09, and used as drawn. That was possible
 * because the board's pixels were square — its QR bitmap measured 95×93, and a
 * QR is square by construction — so a board pixel was a design point and
 * nothing needed rescaling. What did *not* carry over was the frame: the
 * mockup's screen was 1272×768, an aspect of 1.656, while the stage is 16:9.
 * That board's layout ran to y 725 and the stage is 720, so the whole
 * difference was five points, taken out of `gridGap` — the largest gap on the
 * screen and the least missed.
 *
 * **That file is no longer that board.** It was replaced with a 1672×941
 * re-export — the screen alone, at the stage's own 16:9 — and the replacement
 * is a recomposition rather than a rescale: it gives the hero more room and the
 * roster less. Measured against it (÷1.30625 for board px to design point) the
 * numbers below are wrong by more than rounding — disc 70 against 88, column
 * pitch 124 against 158, row pitch 145 against 177, tile 105 against 84 — and
 * the wordmark no longer sits behind the title. Four numbers do agree exactly:
 * the wordmark's top at 32, the title's 48-point line, and the 22 and 20 of a
 * seat's two text lines. The full table is in
 * `docs/design/soft-minimal-handoff.md`.
 *
 * Nothing here was changed to match, because adopting that geometry redraws the
 * Room screen and no one has yet seen it drawn. What is below is what the
 * television has been shipping; treat it as the current design, and the board as
 * the open question.
 *
 * It lives here rather than in the screen's `StyleSheet` so the total is
 * testable. The first draft carried the sum in a comment instead, and the
 * comment was 18pt wrong.
 */
export const roomLayout = {
  /** The wordmark's own band. It is *behind* the title rather than above it. */
  headerTop: 32,
  wordmark: 39,
  /**
   * Where the content column starts — above the wordmark's baseline, because
   * the board overlaps the two. `Grab your phone!` is centred on the stage and
   * the wordmark sits in the left gutter beside it, so stacking them (which is
   * what a plain header row does) pushes the whole screen 30pt down.
   */
  titleTop: 55,
  titleLine: 48,
  /** Down to the code tiles and the QR beside them. */
  heroGap: 21,
  /** A code tile: 86 wide on the board and very nearly square. */
  tile: 84,
  tileCaptionGap: 24,
  captionLine: 30,
  /** Down to the `PLAYERS IN THE ROOM` rule. */
  dividerGap: 24,
  dividerLine: 20,
  /** Down to the grid. The board's 41, less the five the 16:9 frame costs. */
  gridGap: 26,
  /** Down to the count. */
  countGap: 12,
  countLine: 30,
} as const;

/**
 * The hero's height: the code tiles over their caption.
 *
 * The QR stands beside it and is deliberately the shorter of the two, so this
 * one column decides the row — a QR that grew past the code it accompanies
 * would be a QR that had become the hero.
 *
 * The 2026-08-09 board keeps that true — 87 against the tile column's 89 — but
 * only just, and an export earlier the same day had it the other way round at
 * 108.7 against 93.4, which would have returned a hero 15pt short. Two points of
 * margin is the whole of the guarantee, so a board that grows the QR again is
 * worth measuring rather than eyeballing.
 */
export function roomHeroHeight(): number {
  return roomLayout.tile + roomLayout.tileCaptionGap + roomLayout.captionLine;
}

/**
 * How tall the whole Room screen stands, at the two rows a full room needs.
 *
 * Measured from the top of the stage to the bottom of the count line. The
 * wordmark is not a term: it sits in the left gutter *behind* the title's band
 * rather than above it, so it adds no height (`titleTop` already clears it).
 */
export function roomScreenHeight(): number {
  const { titleTop, titleLine, heroGap } = roomLayout;
  const { dividerGap, dividerLine, gridGap, countGap, countLine } = roomLayout;

  return (
    titleTop +
    titleLine +
    heroGap +
    roomHeroHeight() +
    dividerGap +
    dividerLine +
    gridGap +
    roomGridHeight() +
    countGap +
    countLine
  );
}

/** A place in the grid: somebody's, or nobody's yet. */
export type RoomSeat =
  | { readonly kind: 'taken'; readonly seat: RosterSeat }
  | {
      readonly kind: 'empty';
      /** Its place in the room, 1-based — what the dashed circle prints. */
      readonly number: number;
    };

/**
 * Every place in the room, taken ones first.
 *
 * The grid is always `ROOM_PLAYER_CAP` places rather than growing with the
 * party: the dashed circles are the invitation, and a room that drew only the
 * seats it had filled would stop inviting anybody in exactly when it still had
 * room for them. They are numbered because the board numbers them — an empty
 * circle says "there is room", and `7` says how much.
 *
 * A roster longer than the cap is drawn in full rather than truncated. It
 * cannot happen — `joinRoom` enforces the cap inside a serializable transaction
 * — but a television that silently dropped a player would be a worse bug than
 * one that ran off the bottom of the stage, which is what an eleventh seat
 * would do: the grid's width is pinned to `SEATS_PER_ROW`, so the overflow is a
 * third row, not a wider one.
 */
export function roomSeats(roster: readonly RosterSeat[]): readonly RoomSeat[] {
  const taken = roster.map((seated): RoomSeat => ({ kind: 'taken', seat: seated }));
  const empty = Array.from(
    { length: Math.max(ROOM_PLAYER_CAP - roster.length, 0) },
    (_unused, position): RoomSeat => ({ kind: 'empty', number: roster.length + position + 1 }),
  );

  return [...taken, ...empty];
}

/**
 * What a seat's status slot says (the board: a crown and `HOST`, a green dot, a
 * blue `AWAY` chip — and the handoff's four seconds of `JUST JOINED!`).
 */
export type SeatSlot = 'justJoined' | 'host' | 'away' | 'present';

/**
 * What this seat has to say, in the order the room needs to hear it.
 *
 * An arrival's four seconds come first, including the Host's own: the room's
 * first player is both at once, and for those four seconds the news is that
 * somebody is here at all. That is the precedence Boardwalk's carousel footer
 * line gave an arrival over the browsing sentence, kept as the surface moved.
 *
 * After that the order is the Host roster's (`apps/controller/src/host-roster.ts`)
 * rather than a second opinion about the same question: the Host's slot wins
 * over their own away-ness, so away-ness is never what a slot gives up on a row
 * that could meaningfully be away.
 */
export function seatSlot(seated: RosterSeat, greeting: boolean): SeatSlot {
  if (greeting) {
    return 'justJoined';
  }

  if (seated.host) {
    return 'host';
  }

  return seated.away ? 'away' : 'present';
}

/** What each slot reads as aloud, for anything that cannot see the grid. */
const SPOKEN_SLOT: Readonly<Record<SeatSlot, string>> = {
  justJoined: 'just joined',
  host: 'host',
  present: 'online',
  away: 'away',
};

/**
 * The seat as a screen reader takes it: the nickname, and what its slot says.
 *
 * The three that are not the Host's label differ in colour and in very little
 * else — a green dot against a grey one, a blue chip — and a television that
 * says who is away in a hue alone says it to some of the room.
 */
export function seatSpokenAs(seated: RosterSeat, greeting: boolean): string {
  return `${seated.nickname}, ${SPOKEN_SLOT[seatSlot(seated, greeting)]}`;
}

/**
 * The line under the grid: how full the room is, and what that means.
 *
 * Returned in parts rather than as a sentence because the board sets the count
 * itself in the accent and the rest in muted text, and a screen that had to
 * find the number inside a finished string would be parsing its own copy.
 */
export type RoomCountLine = {
  readonly joined: number;
  readonly total: number;
  /** What follows the count, if the room has anything to add. */
  readonly note: string | undefined;
};

/**
 * How the room is getting on, per the board's "6 of 12 joined — Sam can start
 * whenever" (at the twelve the board draws and the ten the room actually caps
 * at).
 *
 * The note is dropped rather than made up when there is nothing true to say. An
 * empty room is waiting for players; a room with a Host in it can be started by
 * them whenever they like; a room whose first roster has landed without a Host
 * — which the backend does not produce, but which a screen must survive — says
 * only the count.
 */
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
